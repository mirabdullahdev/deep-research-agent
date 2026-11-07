from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_research_rejects_short_topic():
    res = client.post("/api/research", json={"topic": "a"})
    assert res.status_code == 422
