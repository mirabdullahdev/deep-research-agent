import pytest

from app.agents import usage_log
from app.limits import LimitStore, get_store
from app.main import app


@pytest.fixture(autouse=True)
def isolate_usage_log(tmp_path, monkeypatch):
    monkeypatch.setattr(usage_log, "LOG", tmp_path / "usage.jsonl")


@pytest.fixture(autouse=True)
def isolated_limits(tmp_path):
    store = LimitStore(str(tmp_path / "limits.db"))
    app.dependency_overrides[get_store] = lambda: store
    yield store
    app.dependency_overrides.pop(get_store, None)
