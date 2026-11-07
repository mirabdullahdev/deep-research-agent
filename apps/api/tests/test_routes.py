import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.agents import intake
from app.guard import get_guard
from app.main import app


@pytest.fixture
def client():
    async def fake_guard(*texts):
        if any("forbidden" in t for t in texts):
            raise HTTPException(400, "blocked")

    app.dependency_overrides[get_guard] = lambda: fake_guard
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_plan_returns_steps(client, monkeypatch):
    async def fake(settings, topic):
        return ["Map the market.", "Compare the leaders."]

    monkeypatch.setattr(intake, "make_plan", fake)
    res = client.post("/api/plan", json={"topic": "EV adoption", "depth": "quick"})
    assert res.status_code == 200
    assert res.json()["steps"] == ["Map the market.", "Compare the leaders."]


def test_guard_blocks_topic(client):
    res = client.post("/api/plan", json={"topic": "something forbidden"})
    assert res.status_code == 400


def test_guard_blocks_edited_steps(client):
    res = client.post(
        "/api/research",
        json={"topic": "EV adoption", "steps": ["Do something forbidden here"]},
    )
    assert res.status_code == 400


def test_too_many_steps_rejected(client):
    steps = [f"Look into angle number {i}" for i in range(8)]
    res = client.post("/api/research", json={"topic": "EV adoption", "steps": steps})
    assert res.status_code == 422


def test_tiny_step_rejected(client):
    res = client.post("/api/research", json={"topic": "EV adoption", "steps": ["a"]})
    assert res.status_code == 422


def test_short_topic_rejected(client):
    assert client.post("/api/plan", json={"topic": "a"}).status_code == 422
