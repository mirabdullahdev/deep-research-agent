import json
import time
from pathlib import Path

from app.agents.budget import Budget

LOG = Path(__file__).resolve().parents[2] / "logs" / "usage.jsonl"


def record(kind: str, budget: Budget, **extra) -> None:
    entry = {"time": time.strftime("%Y-%m-%d %H:%M:%S"), "kind": kind, **extra, **budget.summary()}
    try:
        LOG.parent.mkdir(exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError:
        pass
