import pytest
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


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_documentation_endpoints_are_not_exposed(path):
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("path", ["/api/plan", "/api/research"])
def test_the_two_api_endpoints_exist(path):
    assert client.post(path, json={}).status_code == 422


@pytest.mark.parametrize("path", ["/api/clarify", "/api/usage", "/api/admin", "/", "/metrics"])
def test_nothing_else_is_exposed(path):
    assert client.get(path).status_code == 404
    assert client.post(path, json={}).status_code in (404, 405)
