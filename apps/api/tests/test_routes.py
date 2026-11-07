import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.agents import intake
from app.agents.schemas import Outline
from app.config import Settings
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
        return ["Map the market.", "Compare the leaders."], ""

    monkeypatch.setattr(intake, "make_plan", fake)
    res = client.post("/api/plan", json={"topic": "EV adoption"})
    assert res.status_code == 200
    assert res.json() == {"steps": ["Map the market.", "Compare the leaders."], "reply": ""}


def test_plan_returns_reply_for_small_talk(client, monkeypatch):
    async def fake(settings, topic):
        return [], "Doing well. What would you like to research?"

    monkeypatch.setattr(intake, "make_plan", fake)
    res = client.post("/api/plan", json={"topic": "hi how are you"})
    assert res.json() == {"steps": [], "reply": "Doing well. What would you like to research?"}


class FakeOutlineLLM:
    def __init__(self, outline):
        self.outline = outline

    async def structured(self, schema, system, user):
        return self.outline


async def test_make_plan_small_talk_has_no_steps(monkeypatch):
    outline = Outline(research=False, reply="Hello! What shall we research?", steps=["x"])
    monkeypatch.setattr(intake, "OpenAILLM", lambda *a, **k: FakeOutlineLLM(outline))
    steps, reply = await intake.make_plan(Settings(), "hi")
    assert steps == [] and reply == "Hello! What shall we research?"


async def test_make_plan_research_keeps_five_steps(monkeypatch):
    outline = Outline(research=True, reply="", steps=[f"Step {i} of the plan" for i in range(7)])
    monkeypatch.setattr(intake, "OpenAILLM", lambda *a, **k: FakeOutlineLLM(outline))
    steps, reply = await intake.make_plan(Settings(), "EV adoption")
    assert len(steps) == 5 and reply == ""


async def test_make_plan_falls_back_when_no_reply(monkeypatch):
    outline = Outline(research=False, reply=" ", steps=[])
    monkeypatch.setattr(intake, "OpenAILLM", lambda *a, **k: FakeOutlineLLM(outline))
    steps, reply = await intake.make_plan(Settings(), "thanks")
    assert steps == [] and reply == intake.FALLBACK_REPLY


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
