from operator import add
from typing import Annotated, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.types import Send

from app.agents import prompts
from app.agents.deps import Deps
from app.agents.schemas import Extraction, Finding, Gaps, Plan, SearchItem
from app.agents.text import plain, strip_citations


class State(TypedDict):
    topic: str
    steps: list[str]
    searches: list[SearchItem]
    asked: Annotated[list[str], add]
    findings: Annotated[list[Finding], add]
    round: int
    report: str


def _deps(config: RunnableConfig) -> Deps:
    return config["configurable"]["deps"]


def _usage(deps: Deps) -> dict:
    b = deps.budget
    return {"type": "usage", "spent_usd": round(b.spent_usd, 4), "cap_usd": b.cap_usd}


async def plan(state: State, config: RunnableConfig) -> dict:
    deps = _deps(config)
    deps.emit({"type": "stage", "stage": "planning"})
    brief = f"Topic: {state['topic']}"
    if state["steps"]:
        approved = "\n".join(f"- {s}" for s in state["steps"])
        brief += f"\n\nApproved research plan:\n{approved}"
    result = await deps.planner.structured(
        Plan, prompts.PLANNER.format(n=deps.depth.questions), brief
    )
    searches = [s for s in result.searches if s.query.strip()][: deps.depth.questions]
    deps.emit({"type": "plan", "searches": [s.model_dump() for s in searches]})
    deps.emit(_usage(deps))
    return {"searches": searches, "round": 0}


def fan_out(state: State) -> list[Send]:
    return [
        Send("research", {"topic": state["topic"], "search": s}) for s in state["searches"]
    ]


async def research(payload: dict, config: RunnableConfig) -> dict:
    deps = _deps(config)
    item: SearchItem = payload["search"]
    query = item.query
    deps.emit({"type": "agent", "event": "start", "question": query, "reason": item.reason})

    async with deps.gate:
        try:
            sources = await deps.search.search(query, deps.depth.results_per_question)
            for s in sources:
                deps.emit({"type": "source", "question": query, "url": s.url, "title": s.title})
            if not sources:
                deps.emit({"type": "agent", "event": "done", "question": query, "findings": 0})
                return {"asked": [query], "findings": []}

            deps.emit({"type": "agent", "event": "reading", "question": query})
            by_url = {s.url: s for s in sources}
            blocks = "\n\n".join(f"URL: {s.url}\nTitle: {s.title}\n{s.text}" for s in sources)
            result = await deps.worker.structured(
                Extraction,
                prompts.EXTRACTOR.format(n=6),
                f"Topic: {payload['topic']}\nSearch: {query}\nWhy it matters: {item.reason}"
                f"\n\nSources:\n{blocks}",
            )
        except Exception as exc:
            deps.emit({"type": "agent", "event": "error", "question": query, "detail": str(exc)})
            return {"asked": [query], "findings": []}

    findings = [
        Finding(question=query, claim=f.claim, url=f.source_url, title=by_url[f.source_url].title)
        for f in result.findings
        if f.source_url in by_url
    ]
    deps.emit({"type": "agent", "event": "done", "question": query, "findings": len(findings)})
    deps.emit(_usage(deps))
    return {"asked": [query], "findings": findings}


async def reflect(state: State, config: RunnableConfig) -> dict:
    deps = _deps(config)
    round_no = state["round"] + 1
    if round_no > deps.depth.reflection_rounds or not deps.budget.can_afford_another_round():
        return {"searches": [], "round": round_no}

    deps.emit({"type": "stage", "stage": "reflecting"})
    notes = "\n".join(f"- ({f.question}) {f.claim}" for f in state["findings"])
    asked = "\n".join(f"- {q}" for q in state["asked"])
    result = await deps.worker.structured(
        Gaps,
        prompts.REFLECTOR.format(n=3),
        f"Topic: {state['topic']}\n\nAlready run:\n{asked}\n\nFindings so far:\n{notes}",
    )
    fresh = [s for s in result.follow_ups if s.query.strip() and s.query not in state["asked"]]
    follow_ups = fresh[:3]
    deps.emit({"type": "gaps", "searches": [s.model_dump() for s in follow_ups]})
    deps.emit(_usage(deps))
    return {"searches": follow_ups, "round": round_no}


def after_reflect(state: State) -> list[Send] | str:
    if state["searches"]:
        return fan_out(state)
    return "write"


async def write(state: State, config: RunnableConfig) -> dict:
    deps = _deps(config)
    if not state["findings"]:
        raise RuntimeError("No usable sources were found for this topic.")

    deps.emit({"type": "stage", "stage": "writing"})
    numbering: dict[str, int] = {}
    titles: dict[str, str] = {}
    for f in state["findings"]:
        numbering.setdefault(f.url, len(numbering) + 1)
        titles[f.url] = f.title

    grouped: dict[str, list[str]] = {}
    for f in state["findings"]:
        grouped.setdefault(f.question, []).append(f"- {f.claim} (source: {f.title})")
    notes = "\n\n".join(f"### {q}\n" + "\n".join(lines) for q, lines in grouped.items())

    parts: list[str] = []
    async for delta in deps.writer.stream(
        prompts.WRITER.format(words=deps.depth.report_words),
        f"Topic: {state['topic']}\n\nFindings:\n\n{notes}",
    ):
        parts.append(delta)
        deps.emit({"type": "report", "delta": delta})
    body = plain(strip_citations("".join(parts))).strip()

    sources = [{"n": n, "url": url, "title": titles[url]} for url, n in numbering.items()]
    deps.emit({"type": "sources", "sources": sources})
    deps.emit(_usage(deps))
    return {"report": body}
