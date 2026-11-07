import pytest
from fastapi.testclient import TestClient

from app.agents import intake
from app.agents.intake import Answer, ClarifyQuestion, build_brief
from app.agents.schemas import SearchItem
from app.guard import get_guard
from app.main import app


@pytest.fixture
def client():
    blocked: list[str] = []

    async def fake_guard(*texts):
        if any("forbidden" in t for t in texts):
            blocked.append("x")
            from fastapi import HTTPException

            raise HTTPException(400, "blocked")

    app.dependency_overrides[get_guard] = lambda: fake_guard
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_clarify_returns_questions(client, monkeypatch):
    async def fake(settings, topic):
        return [ClarifyQuestion(question="Which region?", suggestions=["EU", "US"])]

    monkeypatch.setattr(intake, "clarify", fake)
    res = client.post("/api/clarify", json={"topic": "EV adoption"})
    assert res.status_code == 200
    assert res.json()["questions"][0]["suggestions"] == ["EU", "US"]


def test_plan_uses_answers_in_brief(client, monkeypatch):
    seen = {}

    async def fake(settings, brief, depth):
        seen["brief"] = brief
        return [SearchItem(query="ev sales europe", reason="regional data")]

    monkeypatch.setattr(intake, "make_plan", fake)
    res = client.post(
        "/api/plan",
        json={
            "topic": "EV adoption",
            "depth": "quick",
            "answers": [{"question": "Which region?", "answer": "Europe"}],
        },
    )
    assert res.status_code == 200
    assert "Europe" in seen["brief"]


def test_guard_blocks_topic(client):
    res = client.post("/api/clarify", json={"topic": "something forbidden"})
    assert res.status_code == 400


def test_edited_plan_is_bounded(client):
    too_many = [{"query": f"query number {i}", "reason": "r"} for i in range(9)]
    res = client.post(
        "/api/research", json={"topic": "EV adoption", "depth": "quick", "searches": too_many}
    )
    assert res.status_code == 422


def test_edited_plan_rejects_tiny_query(client):
    res = client.post(
        "/api/research",
        json={"topic": "EV adoption", "depth": "quick", "searches": [{"query": "a", "reason": ""}]},
    )
    assert res.status_code == 422


def test_build_brief():
    assert build_brief("T", []) == "T"
    brief = build_brief("T", [Answer(question="Q?", answer="A"), Answer(question="Z?", answer="")])
    assert "Q? A" in brief and "Z?" not in brief
