import ipaddress
import re
import sqlite3
import threading
import time
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from app.config import Settings, get_settings

HOUR = 3_600
DAY = 86_400
STALE_RUN_SECONDS = 900
PLAN_COST_USD = 0.001

USED = "Your testing allowance for this demo has been used. Thank you for trying it out."
UNAVAILABLE = "The demo is not accepting new research right now. Please check back later."

REFUSALS = {
    "visitor": ("used", USED),
    "ip": ("unavailable", UNAVAILABLE),
    "budget": ("unavailable", UNAVAILABLE),
    "busy": ("unavailable", UNAVAILABLE),
    "rate": ("unavailable", UNAVAILABLE),
}


def refuse(reason: str) -> HTTPException:
    code, message = REFUSALS[reason]
    return HTTPException(429, {"code": code, "message": message})


def network_key(raw: str) -> str:
    try:
        addr = ipaddress.ip_address(raw)
    except ValueError:
        return raw
    if addr.version == 6:
        return str(ipaddress.ip_network(f"{addr}/64", strict=False))
    return str(addr)


class LimitStore:
    def __init__(self, path: str):
        db_path = Path(path)
        if not db_path.is_absolute():
            db_path = Path(__file__).resolve().parents[1] / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(db_path, check_same_thread=False, isolation_level=None)
        self.lock = threading.Lock()
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=NORMAL")
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS runs ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, visitor TEXT NOT NULL, ip TEXT NOT NULL, "
            "ts REAL NOT NULL, status TEXT NOT NULL, spent REAL NOT NULL DEFAULT 0)"
        )
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "ip TEXT NOT NULL, ts REAL NOT NULL)"
        )
        for statement in (
            "CREATE INDEX IF NOT EXISTS runs_visitor ON runs (visitor)",
            "CREATE INDEX IF NOT EXISTS runs_ip_ts ON runs (ip, ts)",
            "CREATE INDEX IF NOT EXISTS plans_ip_ts ON plans (ip, ts)",
            "CREATE INDEX IF NOT EXISTS plans_ts ON plans (ts)",
        ):
            self.db.execute(statement)

    @contextmanager
    def _transaction(self):
        with self.lock:
            self.db.execute("BEGIN IMMEDIATE")
            try:
                yield
                self.db.execute("COMMIT")
            except BaseException:
                self.db.execute("ROLLBACK")
                raise

    def _scalar(self, sql: str, args: tuple = ()) -> float:
        return self.db.execute(sql, args).fetchone()[0]

    def _spent(self) -> float:
        runs = self._scalar("SELECT COALESCE(SUM(spent), 0) FROM runs")
        return runs + self._scalar("SELECT COUNT(*) FROM plans") * PLAN_COST_USD

    def _run_refusal(self, visitor: str, ip: str, s: Settings, now: float) -> str | None:
        if self._spent() >= s.global_budget_usd:
            return "budget"
        used = self._scalar(
            "SELECT COUNT(*) FROM runs WHERE visitor = ? AND status != 'refunded'", (visitor,)
        )
        if used >= s.runs_per_visitor:
            return "visitor"
        today = self._scalar(
            "SELECT COUNT(*) FROM runs WHERE ip = ? AND ts > ? AND status != 'refunded'",
            (ip, now - DAY),
        )
        if today >= s.runs_per_ip_per_day:
            return "ip"
        live = self._scalar(
            "SELECT COUNT(*) FROM runs WHERE status = 'active' AND ts > ?",
            (now - STALE_RUN_SECONDS,),
        )
        if live >= s.max_concurrent_runs:
            return "busy"
        return None

    def reserve_plan(self, visitor: str, ip: str, s: Settings) -> str | None:
        now = time.time()
        with self._transaction():
            reason = self._run_refusal(visitor, ip, s, now)
            if reason in ("visitor", "ip", "budget"):
                return reason
            hourly = self._scalar(
                "SELECT COUNT(*) FROM plans WHERE ip = ? AND ts > ?", (ip, now - HOUR)
            )
            daily = self._scalar("SELECT COUNT(*) FROM plans WHERE ts > ?", (now - DAY,))
            if hourly >= s.plans_per_ip_per_hour or daily >= s.plans_global_per_day:
                return "rate"
            self.db.execute("INSERT INTO plans (ip, ts) VALUES (?, ?)", (ip, now))
            return None

    def reserve_run(self, visitor: str, ip: str, s: Settings) -> tuple[int | None, str | None]:
        now = time.time()
        with self._transaction():
            reason = self._run_refusal(visitor, ip, s, now)
            if reason:
                return None, reason
            cur = self.db.execute(
                "INSERT INTO runs (visitor, ip, ts, status) VALUES (?, ?, ?, 'active')",
                (visitor, ip, now),
            )
            return cur.lastrowid, None

    def finish(self, run_id: int, spent: float, refund: bool) -> None:
        with self._transaction():
            self.db.execute(
                "UPDATE runs SET status = ?, spent = ? WHERE id = ?",
                ("refunded" if refund else "done", spent, run_id),
            )


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
    raw = request.client.host if request.client else "unknown"
    hops = settings.trusted_proxies
    if hops > 0:
        parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",")]
        parts = [p for p in parts if p]
        if len(parts) >= hops:
            raw = parts[-hops]
    ip = network_key(raw)
    valid = x_visitor_id and re.fullmatch(r"[A-Za-z0-9-]{16,64}", x_visitor_id)
    return (x_visitor_id if valid else f"ip:{ip}"), ip
