import asyncio
import logging
import time
from collections.abc import AsyncIterator

from app.agents import usage_log
from app.agents.budget import Budget
from app.agents.deps import Deps
from app.agents.depth import DEEP
from app.agents.errors import GENERIC_ERROR, UserFacingError
from app.agents.graph import build_graph
from app.agents.llm import OpenAILLM
from app.agents.search import TavilySearch
from app.config import Settings

MAX_PARALLEL_RESEARCHERS = 8
RUN_TIMEOUT_SECONDS = 600
log = logging.getLogger(__name__)
_graph = build_graph()


def build_deps(settings: Settings, emit) -> Deps:
    budget = Budget(cap_usd=DEEP.budget_usd)
    return Deps(
        planner=OpenAILLM(settings.worker_model, settings.openai_api_key, budget, "low", 3000),
        worker=OpenAILLM(settings.worker_model, settings.openai_api_key, budget, "minimal", 6000),
        writer=OpenAILLM(settings.writer_model, settings.openai_api_key, budget, "low", 16000),
        search=TavilySearch(settings.tavily_api_key),
        budget=budget,
        depth=DEEP,
        emit=emit,
        gate=asyncio.Semaphore(MAX_PARALLEL_RESEARCHERS),
    )


async def run_research(
    topic: str, make_deps=None, settings=None, steps=None
) -> AsyncIterator[dict]:
    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    deps = (make_deps or build_deps)(settings, queue.put_nowait)
    started = time.monotonic()
    status = "ok"

    async def work() -> None:
        nonlocal status
        try:
            state = {
                "topic": topic,
                "findings": [],
                "asked": [],
                "steps": steps or [],
                "searches": [],
                "round": 0,
            }
            config = {"configurable": {"deps": deps}, "recursion_limit": 50}
            out = await asyncio.wait_for(
                _graph.ainvoke(state, config=config), timeout=RUN_TIMEOUT_SECONDS
            )
            queue.put_nowait(
                {
                    "type": "done",
                    "report": out["report"],
                    "spent_usd": round(deps.budget.spent_usd, 4),
                    "tokens_in": deps.budget.tokens_in,
                    "tokens_out": deps.budget.tokens_out,
                }
            )
        except Exception as exc:
            status = f"error: {type(exc).__name__}: {exc}"
            if isinstance(exc, UserFacingError):
                detail = str(exc)
            else:
                log.exception("research run failed")
                detail = GENERIC_ERROR
            queue.put_nowait({"type": "error", "detail": detail})
        finally:
            if make_deps is None:
                usage_log.record(
                    "research",
                    deps.budget,
                    topic=topic,
                    seconds=round(time.monotonic() - started, 1),
                    status=status,
                )
            queue.put_nowait(None)

    task = asyncio.create_task(work())
    try:
        while (event := await queue.get()) is not None:
            yield event
    finally:
        task.cancel()
