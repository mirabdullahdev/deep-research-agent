import asyncio

import pytest

from app.agents.budget import Budget
from app.agents.deps import Deps
from app.agents.depth import DEPTHS
from app.agents.runner import run_research
from app.agents.schemas import Extraction, Gaps, Plan, RawFinding, SearchItem
from app.agents.search import Source


class FakeLLM:
    def __init__(self, gaps: list[list[str]] | None = None):
        self.gaps = list(gaps or [])

    async def structured(self, schema, system, user):
        if schema is Plan:
            queries = ["what is X", "who uses X", "X risks", "extra query"]
            return Plan(searches=[SearchItem(query=q, reason="covers an angle") for q in queries])
        if schema is Extraction:
            url = user.split("URL: ")[1].split("\n")[0]
            return Extraction(
                findings=[
                    RawFinding(claim="X grew 40% in 2025", source_url=url),
                    RawFinding(claim="hallucinated", source_url="https://not-in-sources.example"),
                ]
            )
        if schema is Gaps:
            batch = self.gaps.pop(0) if self.gaps else []
            return Gaps(follow_ups=[SearchItem(query=q, reason="fills a gap") for q in batch])
        raise AssertionError(schema)

    async def stream(self, system, user):
        chunks = [
            "X is growing fast [1]. ",
            "It has risks [2][9].\n\n## Follow-up questions\n",
            "- What about Y?\n- Who regulates X?\n",
        ]
        for chunk in chunks:
            yield chunk


class FakeSearch:
    def __init__(self):
        self.queries: list[str] = []

    async def search(self, query, max_results):
        self.queries.append(query)
        slug = abs(hash(query)) % 10_000
        return [Source(url=f"https://site{slug}.example/a", title=f"Site {slug}", text="body")]


def make_deps_factory(llm, search, depth_name):
    def factory(settings, depth, emit):
        budget = Budget(cap_usd=DEPTHS[depth].budget_usd)
        return Deps(
            planner=llm, worker=llm, writer=llm, search=search, budget=budget,
            depth=DEPTHS[depth], emit=emit, gate=asyncio.Semaphore(4),
        )

    return factory


async def collect(topic, depth, llm, search):
    factory = make_deps_factory(llm, search, depth)
    return [e async for e in run_research(topic, depth, make_deps=factory)]


async def test_quick_run_streams_and_cites():
    search = FakeSearch()
    events = await collect("X", "quick", FakeLLM(), search)
    kinds = [e["type"] for e in events]

    assert kinds[0] == "stage"
    assert events[-1]["type"] == "done"
    assert len(search.queries) == DEPTHS["quick"].questions
    assert "reflecting" not in [e.get("stage") for e in events]

    sources = next(e for e in events if e["type"] == "sources")["sources"]
    assert [s["n"] for s in sources] == [1, 2]
    assert events[-1]["report"].startswith("X is growing fast")
    assert "Follow-up" not in events[-1]["report"]
    assert events[-1]["follow_ups"] == ["What about Y?", "Who regulates X?"]


async def test_approved_plan_skips_planning():
    search = FakeSearch()
    plan = [SearchItem(query="my own query", reason="user wrote it")]
    factory = make_deps_factory(FakeLLM(), search, "quick")
    events = [e async for e in run_research("X", "quick", make_deps=factory, searches=plan)]

    assert search.queries == ["my own query"]
    assert "planning" not in [e.get("stage") for e in events]
    assert events[-1]["type"] == "done"


async def test_hallucinated_source_urls_are_dropped():
    events = await collect("X", "quick", FakeLLM(), FakeSearch())
    done_counts = [e["findings"] for e in events if e["type"] == "agent" and e["event"] == "done"]
    assert done_counts == [1, 1, 1]


async def test_reflection_adds_follow_up_round():
    search = FakeSearch()
    llm = FakeLLM(gaps=[["What changed in 2026?"]])
    events = await collect("X", "standard", llm, search)

    assert "What changed in 2026?" in search.queries
    assert any(e["type"] == "gaps" for e in events)
    assert events[-1]["type"] == "done"


async def test_no_sources_reports_error():
    class EmptySearch:
        async def search(self, query, max_results):
            return []

    events = await collect("X", "quick", FakeLLM(), EmptySearch())
    assert events[-1]["type"] == "error"


def test_budget_math():
    b = Budget(cap_usd=1.0)
    b.add("gpt-5-mini", 1_000_000, 1_000_000)
    assert b.spent_usd == pytest.approx(2.25)
    assert not b.can_afford_another_round()
