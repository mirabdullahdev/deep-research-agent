import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.guard import get_guard
from app.limits import MESSAGES, LimitStore
from app.main import app
from app.routes import research

VISITOR = "visitor-aaaaaaaaaaaa"
OTHER = "visitor-bbbbbbbbbbbb"


def settings(**overrides) -> Settings:
    base = {"rate_limit_enabled": True, "runs_per_visitor": 1, "runs_per_ip_per_day": 3}
    return Settings(**{**base, **overrides})


def test_second_run_for_same_visitor_is_refused(isolated_limits: LimitStore):
    s = settings()
    run_id, reason = isolated_limits.reserve(VISITOR, "1.1.1.1", s)
    assert run_id and reason is None
    isolated_limits.finish(run_id, 0.1, refund=False)

    assert isolated_limits.reserve(VISITOR, "1.1.1.1", s) == (None, "visitor")
    assert isolated_limits.reserve(OTHER, "1.1.1.1", s)[1] is None


def test_refund_frees_the_slot(isolated_limits: LimitStore):
    s = settings()
    run_id, _ = isolated_limits.reserve(VISITOR, "1.1.1.1", s)
    isolated_limits.finish(run_id, 0.0, refund=True)
    assert isolated_limits.reserve(VISITOR, "1.1.1.1", s)[1] is None


def test_ip_cap_blocks_new_visitors_on_the_same_network(isolated_limits: LimitStore):
    s = settings(runs_per_ip_per_day=2)
    for n in range(2):
        assert isolated_limits.reserve(f"visitor-{n:0>12}", "9.9.9.9", s)[1] is None
    assert isolated_limits.reserve(OTHER, "9.9.9.9", s) == (None, "ip")
    assert isolated_limits.reserve(OTHER, "8.8.8.8", s)[1] is None


def test_global_budget_stops_everyone(isolated_limits: LimitStore):
    s = settings(global_budget_usd=0.2)
    run_id, _ = isolated_limits.reserve(VISITOR, "1.1.1.1", s)
    isolated_limits.finish(run_id, 0.25, refund=False)
    assert isolated_limits.reserve(OTHER, "2.2.2.2", s) == (None, "budget")


@pytest.fixture
def client(monkeypatch):
    async def fake_guard(*texts):
        return None

    async def fake_run(topic, depth, settings=None, steps=None):
        yield {"type": "usage", "spent_usd": 0.05, "cap_usd": 0.5}
        yield {"type": "done", "report": "ok", "spent_usd": 0.1, "tokens_in": 1, "tokens_out": 1}

    app.dependency_overrides[get_guard] = lambda: fake_guard
    app.dependency_overrides[get_settings] = lambda: settings()
    monkeypatch.setattr(research, "run_research", fake_run)
    yield TestClient(app)
    app.dependency_overrides.pop(get_guard, None)
    app.dependency_overrides.pop(get_settings, None)


BODY = {"topic": "EV adoption", "steps": ["Map the market.", "Compare the leaders."]}


def test_route_allows_one_run_then_refuses(client):
    headers = {"X-Visitor-Id": VISITOR}
    assert client.post("/api/research", json=BODY, headers=headers).status_code == 200

    again = client.post("/api/research", json=BODY, headers=headers)
    assert again.status_code == 429
    assert again.json()["detail"] == MESSAGES["visitor"]


def test_plan_is_refused_early_once_the_run_is_used(client, monkeypatch):
    async def fake_plan(settings, topic):
        return ["Map the market."], ""

    monkeypatch.setattr(research.intake, "make_plan", fake_plan)
    headers = {"X-Visitor-Id": VISITOR}
    plan = {"topic": "EV adoption"}
    assert client.post("/api/plan", json=plan, headers=headers).status_code == 200
    client.post("/api/research", json=BODY, headers=headers)
    assert client.post("/api/plan", json=plan, headers=headers).status_code == 429


def test_failed_run_does_not_use_up_the_attempt(client, monkeypatch):
    async def failing_run(topic, depth, settings=None, steps=None):
        yield {"type": "error", "detail": "search provider down"}

    headers = {"X-Visitor-Id": VISITOR}
    monkeypatch.setattr(research, "run_research", failing_run)
    assert client.post("/api/research", json=BODY, headers=headers).status_code == 200

    async def good_run(topic, depth, settings=None, steps=None):
        yield {"type": "done", "report": "ok", "spent_usd": 0.1, "tokens_in": 1, "tokens_out": 1}

    monkeypatch.setattr(research, "run_research", good_run)
    assert client.post("/api/research", json=BODY, headers=headers).status_code == 200


def test_limit_can_be_switched_off_for_local_work(client):
    app.dependency_overrides[get_settings] = lambda: settings(rate_limit_enabled=False)
    headers = {"X-Visitor-Id": VISITOR}
    for _ in range(3):
        assert client.post("/api/research", json=BODY, headers=headers).status_code == 200


def test_missing_visitor_header_falls_back_to_the_ip(client):
    assert client.post("/api/research", json=BODY).status_code == 200
    assert client.post("/api/research", json=BODY).status_code == 429
