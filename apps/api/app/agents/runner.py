import asyncio
from collections.abc import AsyncIterator

from app.agents.budget import Budget
from app.agents.deps import Deps
from app.agents.depth import DEPTHS
from app.agents.graph import build_graph
from app.agents.llm import OpenAILLM
from app.agents.search import TavilySearch
from app.config import Settings

MAX_PARALLEL_RESEARCHERS = 4
_graph = build_graph()


def build_deps(settings: Settings, depth: str, emit) -> Deps:
    cfg = DEPTHS[depth]
    budget = Budget(cap_usd=cfg.budget_usd)
    return Deps(
        planner=OpenAILLM(settings.worker_model, settings.openai_api_key, budget, "low"),
        worker=OpenAILLM(settings.worker_model, settings.openai_api_key, budget, "minimal"),
        writer=OpenAILLM(settings.writer_model, settings.openai_api_key, budget, "low"),
        search=TavilySearch(settings.tavily_api_key),
        budget=budget,
        depth=cfg,
        emit=emit,
        gate=asyncio.Semaphore(MAX_PARALLEL_RESEARCHERS),
    )


async def run_research(
    topic: str, depth: str, make_deps=None, settings=None, steps=None
) -> AsyncIterator[dict]:
    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    deps = (make_deps or build_deps)(settings, depth, queue.put_nowait)

    async def work() -> None:
        try:
            out = await _graph.ainvoke(
                {
                    "topic": topic,
                    "findings": [],
                    "asked": [],
                    "steps": steps or [],
                    "searches": [],
                    "round": 0,
                },
                config={"configurable": {"deps": deps}, "recursion_limit": 50},
            )
            queue.put_nowait(
                {
                    "type": "done",
                    "report": out["report"],
                    "follow_ups": out["follow_ups"],
                    "spent_usd": round(deps.budget.spent_usd, 4),
                    "tokens_in": deps.budget.tokens_in,
                    "tokens_out": deps.budget.tokens_out,
                }
            )
        except Exception as exc:
            queue.put_nowait({"type": "error", "detail": str(exc)})
        finally:
            queue.put_nowait(None)

    task = asyncio.create_task(work())
    try:
        while (event := await queue.get()) is not None:
            yield event
    finally:
        task.cancel()
