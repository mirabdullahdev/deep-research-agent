import re
from operator import add
from typing import Annotated, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.types import Send

from app.agents import prompts
from app.agents.deps import Deps
from app.agents.schemas import Extraction, Finding, Gaps, Plan


class State(TypedDict):
    topic: str
    questions: list[str]
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
    result = await deps.planner.structured(
        Plan,
        prompts.PLANNER.format(n=deps.depth.questions),
        f"Topic: {state['topic']}",
    )
    questions = [q.strip() for q in result.questions if q.strip()][: deps.depth.questions]
    deps.emit({"type": "plan", "questions": questions})
    deps.emit(_usage(deps))
    return {"questions": questions, "round": 0}


def fan_out(state: State) -> list[Send]:
    return [
        Send("research", {"topic": state["topic"], "question": q}) for q in state["questions"]
    ]


async def research(payload: dict, config: RunnableConfig) -> dict:
    deps = _deps(config)
    question = payload["question"]
    deps.emit({"type": "agent", "event": "start", "question": question})

    async with deps.gate:
        try:
            sources = await deps.search.search(question, deps.depth.results_per_question)
            for s in sources:
                deps.emit({"type": "source", "question": question, "url": s.url, "title": s.title})
            if not sources:
                deps.emit({"type": "agent", "event": "done", "question": question, "findings": 0})
                return {"asked": [question], "findings": []}

            deps.emit({"type": "agent", "event": "reading", "question": question})
            by_url = {s.url: s for s in sources}
            blocks = "\n\n".join(f"URL: {s.url}\nTitle: {s.title}\n{s.text}" for s in sources)
            result = await deps.worker.structured(
                Extraction,
                prompts.EXTRACTOR.format(n=6),
                f"Topic: {payload['topic']}\nQuestion: {question}\n\nSources:\n{blocks}",
            )
        except Exception as exc:
            deps.emit({"type": "agent", "event": "error", "question": question, "detail": str(exc)})
            return {"asked": [question], "findings": []}

    findings = [
        Finding(
            question=question,
            claim=f.claim,
            url=f.source_url,
            title=by_url[f.source_url].title,
        )
        for f in result.findings
        if f.source_url in by_url
    ]
    deps.emit({"type": "agent", "event": "done", "question": question, "findings": len(findings)})
    deps.emit(_usage(deps))
    return {"asked": [question], "findings": findings}


async def reflect(state: State, config: RunnableConfig) -> dict:
    deps = _deps(config)
    round_no = state["round"] + 1
    if round_no > deps.depth.reflection_rounds or not deps.budget.can_afford_another_round():
        return {"questions": [], "round": round_no}

    deps.emit({"type": "stage", "stage": "reflecting"})
    notes = "\n".join(f"- ({f.question}) {f.claim}" for f in state["findings"])
    asked = "\n".join(f"- {q}" for q in state["asked"])
    result = await deps.worker.structured(
        Gaps,
        prompts.REFLECTOR.format(n=3),
        f"Topic: {state['topic']}\n\nAlready asked:\n{asked}\n\nFindings so far:\n{notes}",
    )
    fresh = [q.strip() for q in result.follow_ups if q.strip() and q not in state["asked"]]
    follow_ups = fresh[:3]
    deps.emit({"type": "gaps", "questions": follow_ups})
    deps.emit(_usage(deps))
    return {"questions": follow_ups, "round": round_no}


def after_reflect(state: State) -> list[Send] | str:
    if state["questions"]:
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
        grouped.setdefault(f.question, []).append(f"- {f.claim} [{numbering[f.url]}]")
    notes = "\n\n".join(f"### {q}\n" + "\n".join(lines) for q, lines in grouped.items())

    parts: list[str] = []
    async for delta in deps.writer.stream(
        prompts.WRITER, f"Topic: {state['topic']}\n\nFindings:\n\n{notes}"
    ):
        parts.append(delta)
        deps.emit({"type": "report", "delta": delta})
    body = "".join(parts).strip()

    cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", body)})
    by_number = {n: url for url, n in numbering.items()}
    sources = [
        {"n": n, "url": by_number[n], "title": titles[by_number[n]]}
        for n in cited
        if n in by_number
    ]
    deps.emit({"type": "sources", "sources": sources})
    deps.emit(_usage(deps))
    return {"report": body}
