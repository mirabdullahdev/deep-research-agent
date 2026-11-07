import re

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.config import Settings, get_settings
from app.guard import get_guard
from app.limits import REFUSALS, LimitStore, get_identity, network_key
from app.main import app
from app.routes import research

VISITOR = "visitor-aaaaaaaaaaaa"
OTHER = "visitor-bbbbbbbbbbbb"


def settings(**overrides) -> Settings:
    base = {"rate_limit_enabled": True, "runs_per_visitor": 1, "runs_per_ip_per_day": 3}
    return Settings(**{**base, **overrides})


def test_second_run_for_same_visitor_is_refused(isolated_limits: LimitStore):
    s = settings()
    run_id, reason = isolated_limits.reserve_run(VISITOR, "1.1.1.1", s)
    assert run_id and reason is None
    isolated_limits.finish(run_id, 0.1, refund=False)

    assert isolated_limits.reserve_run(VISITOR, "1.1.1.1", s) == (None, "visitor")
    assert isolated_limits.reserve_run(OTHER, "1.1.1.1", s)[1] is None


def test_refund_frees_the_slot(isolated_limits: LimitStore):
    s = settings()
    run_id, _ = isolated_limits.reserve_run(VISITOR, "1.1.1.1", s)
    isolated_limits.finish(run_id, 0.0, refund=True)
    assert isolated_limits.reserve_run(VISITOR, "1.1.1.1", s)[1] is None


def test_ip_cap_blocks_new_visitors_on_the_same_network(isolated_limits: LimitStore):
    s = settings(runs_per_ip_per_day=2, max_concurrent_runs=10)
    for n in range(2):
        assert isolated_limits.reserve_run(f"visitor-{n:0>12}", "9.9.9.9", s)[1] is None
    assert isolated_limits.reserve_run(OTHER, "9.9.9.9", s) == (None, "ip")
    assert isolated_limits.reserve_run(OTHER, "8.8.8.8", s)[1] is None


def test_global_budget_stops_everyone(isolated_limits: LimitStore):
    s = settings(global_budget_usd=0.2)
    run_id, _ = isolated_limits.reserve_run(VISITOR, "1.1.1.1", s)
    isolated_limits.finish(run_id, 0.25, refund=False)
    assert isolated_limits.reserve_run(OTHER, "2.2.2.2", s) == (None, "budget")
    assert isolated_limits.reserve_plan(OTHER, "2.2.2.2", s) == "budget"


def test_concurrent_run_cap(isolated_limits: LimitStore):
    s = settings(max_concurrent_runs=1)
    assert isolated_limits.reserve_run(VISITOR, "1.1.1.1", s)[1] is None
    assert isolated_limits.reserve_run(OTHER, "2.2.2.2", s) == (None, "busy")


def test_planning_requests_are_rate_limited_per_network(isolated_limits: LimitStore):
    s = settings(plans_per_ip_per_hour=2)
    assert isolated_limits.reserve_plan(VISITOR, "1.1.1.1", s) is None
    assert isolated_limits.reserve_plan(VISITOR, "1.1.1.1", s) is None
    assert isolated_limits.reserve_plan(VISITOR, "1.1.1.1", s) == "rate"
    assert isolated_limits.reserve_plan(OTHER, "2.2.2.2", s) is None


def test_global_plan_volume_is_capped(isolated_limits: LimitStore):
    s = settings(plans_global_per_day=2, plans_per_ip_per_hour=50)
    assert isolated_limits.reserve_plan(VISITOR, "1.1.1.1", s) is None
    assert isolated_limits.reserve_plan(OTHER, "2.2.2.2", s) is None
    assert isolated_limits.reserve_plan("visitor-cccccccccccc", "3.3.3.3", s) == "rate"


def test_planning_is_refused_once_the_visitor_has_used_their_run(isolated_limits: LimitStore):
    s = settings()
    run_id, _ = isolated_limits.reserve_run(VISITOR, "1.1.1.1", s)
    isolated_limits.finish(run_id, 0.1, refund=False)
    assert isolated_limits.reserve_plan(VISITOR, "1.1.1.1", s) == "visitor"


def test_refusal_wording_reveals_no_rules_or_numbers():
    for code, message in REFUSALS.values():
        assert code in ("used", "unavailable")
        assert not re.search(r"\d|\$|\bone\b|\bonce\b|\blimit|\bcap\b|budget|per ", message, re.I)


def test_ipv6_addresses_share_one_allowance_per_64_block():
    assert network_key("2001:db8:1:2::1") == network_key("2001:db8:1:2:ffff::9")
    assert network_key("2001:db8:1:2::1") != network_key("2001:db8:1:3::1")
    assert network_key("203.0.113.9") == "203.0.113.9"


def request_with(forwarded: str | None, client: str = "10.0.0.1") -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": (client, 1234)})


def test_forwarded_header_is_ignored_unless_proxies_are_trusted():
    _, ip = get_identity(request_with("6.6.6.6"), settings(), None)
    assert ip == "10.0.0.1"


def test_spoofed_forwarded_entries_are_ignored_behind_a_trusted_proxy():
    req = request_with("6.6.6.6, 203.0.113.7")
    _, ip = get_identity(req, settings(trusted_proxies=1), None)
    assert ip == "203.0.113.7"


def test_malformed_visitor_ids_fall_back_to_the_network():
    visitor, ip = get_identity(request_with(None), settings(), "bad id; drop table")
    assert visitor == f"ip:{ip}"


@pytest.fixture
def client(monkeypatch):
    async def fake_guard(*texts):
        return None

    async def fake_run(topic, settings=None, steps=None):
        yield {"type": "usage", "spent_usd": 0.05, "cap_usd": 0.5}
        yield {"type": "done", "report": "ok", "spent_usd": 0.1, "tokens_in": 1, "tokens_out": 1}

    app.dependency_overrides[get_guard] = lambda: fake_guard
    app.dependency_overrides[get_settings] = lambda: settings()
    monkeypatch.setattr(research, "run_research", fake_run)
    yield TestClient(app)
    app.dependency_overrides.pop(get_guard, None)
    app.dependency_overrides.pop(get_settings, None)


BODY = {"topic": "EV adoption", "steps": ["Map the market.", "Compare the leaders."]}
HEADERS = {"X-Visitor-Id": VISITOR}


def test_route_allows_one_deep_run_then_refuses_neutrally(client):
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 200

    again = client.post("/api/research", json=BODY, headers=HEADERS)
    assert again.status_code == 429
    assert again.json()["detail"]["code"] == "used"
    assert "testing allowance" in again.json()["detail"]["message"]


def test_unknown_fields_from_the_client_are_ignored(client, monkeypatch):
    seen = {}

    async def spy(topic, settings=None, steps=None):
        seen.update(topic=topic, steps=steps)
        yield {"type": "done", "report": "ok", "spent_usd": 0.1, "tokens_in": 1, "tokens_out": 1}

    monkeypatch.setattr(research, "run_research", spy)
    extra = {**BODY, "depth": "quick", "budget": 99, "model": "gpt-5-pro"}
    assert client.post("/api/research", json=extra, headers=HEADERS).status_code == 200
    assert seen == {"topic": BODY["topic"], "steps": BODY["steps"]}


def test_plan_is_refused_early_once_the_run_is_used(client, monkeypatch):
    async def fake_plan(settings, topic):
        return ["Map the market."], ""

    monkeypatch.setattr(research.intake, "make_plan", fake_plan)
    plan = {"topic": "EV adoption"}
    assert client.post("/api/plan", json=plan, headers=HEADERS).status_code == 200
    client.post("/api/research", json=BODY, headers=HEADERS)
    assert client.post("/api/plan", json=plan, headers=HEADERS).status_code == 429


def test_cheap_failure_does_not_use_up_the_attempt(client, monkeypatch):
    async def failing_run(topic, settings=None, steps=None):
        yield {"type": "error", "detail": "search provider down"}

    monkeypatch.setattr(research, "run_research", failing_run)
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 200

    async def good_run(topic, settings=None, steps=None):
        yield {"type": "done", "report": "ok", "spent_usd": 0.1, "tokens_in": 1, "tokens_out": 1}

    monkeypatch.setattr(research, "run_research", good_run)
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 200


def test_failure_after_real_spend_is_not_refunded(client, monkeypatch):
    async def costly_failure(topic, settings=None, steps=None):
        yield {"type": "usage", "spent_usd": 0.2, "cap_usd": 0.5}
        yield {"type": "error", "detail": "late failure"}

    monkeypatch.setattr(research, "run_research", costly_failure)
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 200
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 429


def test_limit_can_be_switched_off_for_local_work(client):
    app.dependency_overrides[get_settings] = lambda: settings(rate_limit_enabled=False)
    for _ in range(3):
        assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 200


def test_missing_visitor_header_falls_back_to_the_network(client):
    assert client.post("/api/research", json=BODY).status_code == 200
    assert client.post("/api/research", json=BODY).status_code == 429


def test_moderation_rejection_does_not_consume_the_run(client):
    async def blocking_guard(*texts):
        from fastapi import HTTPException

        raise HTTPException(400, "blocked")

    app.dependency_overrides[get_guard] = lambda: blocking_guard
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 400

    async def open_guard(*texts):
        return None

    app.dependency_overrides[get_guard] = lambda: open_guard
    assert client.post("/api/research", json=BODY, headers=HEADERS).status_code == 200
