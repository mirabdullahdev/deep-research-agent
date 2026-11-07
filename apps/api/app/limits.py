import re
import sqlite3
import threading
import time
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Header, Request

from app.config import Settings, get_settings

DAY = 86_400

MESSAGES = {
    "visitor": "You have already used your research run. This demo allows one run per visitor.",
    "ip": "This network has reached today's limit for the demo. Please try again tomorrow.",
    "budget": "The demo's research budget has been used up. Thanks for stopping by.",
}


class LimitStore:
    def __init__(self, path: str):
        db_path = Path(path)
        if not db_path.is_absolute():
            db_path = Path(__file__).resolve().parents[1] / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.lock = threading.Lock()
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS runs ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, visitor TEXT NOT NULL, ip TEXT NOT NULL, "
            "ts REAL NOT NULL, status TEXT NOT NULL, spent REAL NOT NULL DEFAULT 0)"
        )
        self.db.commit()

    def _count(self, column: str, value: str, since: float = 0) -> int:
        row = self.db.execute(
            f"SELECT COUNT(*) FROM runs WHERE {column} = ? AND ts > ? AND status != 'refunded'",
            (value, since),
        ).fetchone()
        return row[0]

    def _refusal(self, visitor: str, ip: str, s: Settings) -> str | None:
        spent = self.db.execute("SELECT COALESCE(SUM(spent), 0) FROM runs").fetchone()[0]
        if spent >= s.global_budget_usd:
            return "budget"
        if self._count("visitor", visitor) >= s.runs_per_visitor:
            return "visitor"
        if self._count("ip", ip, time.time() - DAY) >= s.runs_per_ip_per_day:
            return "ip"
        return None

    def refusal(self, visitor: str, ip: str, s: Settings) -> str | None:
        with self.lock:
            return self._refusal(visitor, ip, s)

    def reserve(self, visitor: str, ip: str, s: Settings) -> tuple[int | None, str | None]:
        with self.lock:
            reason = self._refusal(visitor, ip, s)
            if reason:
                return None, reason
            cur = self.db.execute(
                "INSERT INTO runs (visitor, ip, ts, status) VALUES (?, ?, ?, 'active')",
                (visitor, ip, time.time()),
            )
            self.db.commit()
            return cur.lastrowid, None

    def finish(self, run_id: int, spent: float, refund: bool) -> None:
        with self.lock:
            self.db.execute(
                "UPDATE runs SET status = ?, spent = ? WHERE id = ?",
                ("refunded" if refund else "done", spent, run_id),
            )
            self.db.commit()


@lru_cache
def _store(path: str) -> LimitStore:
    return LimitStore(path)


def get_store(settings: Annotated[Settings, Depends(get_settings)]) -> LimitStore:
    return _store(settings.limits_db)


def get_identity(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    x_visitor_id: Annotated[str | None, Header()] = None,
) -> tuple[str, str]:
    ip = request.client.host if request.client else "unknown"
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
    valid = x_visitor_id and re.fullmatch(r"[A-Za-z0-9-]{16,64}", x_visitor_id)
    return (x_visitor_id if valid else f"ip:{ip}"), ip
