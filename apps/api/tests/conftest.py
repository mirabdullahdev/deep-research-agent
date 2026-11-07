import pytest

from app.agents import usage_log


@pytest.fixture(autouse=True)
def isolate_usage_log(tmp_path, monkeypatch):
    monkeypatch.setattr(usage_log, "LOG", tmp_path / "usage.jsonl")
