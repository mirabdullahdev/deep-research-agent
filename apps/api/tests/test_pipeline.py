import asyncio

import pytest

from app.agents.budget import Budget
from app.agents.deps import Deps
from app.agents.depth import DEEP
from app.agents.errors import GENERIC_ERROR
from app.agents.runner import run_research
from app.agents.schemas import Extraction, Gaps, Plan, RawFinding, SearchItem
from app.agents.search import Source
from app.agents.text import ensure_headings, plain, strip_citations


class FakeLLM:
    def __init__(self, gaps: list[list[str]] | None = None):
        self.gaps = list(gaps or [])
        self.plan_inputs: list[str] = []

    async def structured(self, schema, system, user):
        if schema is Plan:
            self.plan_inputs.append(user)
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
            "It has risks [2][9] — but they are manageable.",
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


class EmptySearch:
    async def search(self, query, max_results):
        return []


def make_deps_factory(llm, search, spent=0.0):
    def factory(settings, emit):
        budget = Budget(cap_usd=DEEP.budget_usd)
        budget.spent_usd = spent
        return Deps(
            planner=llm, worker=llm, writer=llm, search=search, budget=budget,
            depth=DEEP, emit=emit, gate=asyncio.Semaphore(4),
        )

    return factory


async def collect(topic, llm, search, steps=None):
    factory = make_deps_factory(llm, search)
    return [e async for e in run_research(topic, make_deps=factory, steps=steps)]


async def test_run_streams_and_lists_references():
    search = FakeSearch()
    events = await collect("X", FakeLLM(), search)

    assert events[0]["type"] == "stage"
    assert events[-1]["type"] == "done"
    assert len(search.queries) == 4

    sources = next(e for e in events if e["type"] == "sources")["sources"]
    assert [s["n"] for s in sources] == [1, 2, 3, 4]

    report = events[-1]["report"]
    assert report == "X is growing fast. It has risks, but they are manageable."
    assert "[" not in report and "—" not in report
    assert "follow_ups" not in events[-1]


async def test_approved_steps_reach_the_planner():
    llm = FakeLLM()
    steps = ["Compare pricing across providers.", "Look for regulatory risks."]
    events = await collect("X", llm, FakeSearch(), steps=steps)

    assert "Approved research plan" in llm.plan_inputs[0]
    assert "Compare pricing across providers." in llm.plan_inputs[0]
    assert events[-1]["type"] == "done"


async def test_no_steps_means_no_approved_plan_section():
    llm = FakeLLM()
    await collect("X", llm, FakeSearch())
    assert "Approved research plan" not in llm.plan_inputs[0]


async def test_hallucinated_source_urls_are_dropped():
    events = await collect("X", FakeLLM(), FakeSearch())
    done_counts = [e["findings"] for e in events if e["type"] == "agent" and e["event"] == "done"]
    assert done_counts == [1, 1, 1, 1]


async def test_reflection_adds_follow_up_round():
    search = FakeSearch()
    llm = FakeLLM(gaps=[["What changed in 2026?"]])
    events = await collect("X", llm, search)

    assert "What changed in 2026?" in search.queries
    assert any(e["type"] == "gaps" for e in events)
    assert events[-1]["type"] == "done"


async def test_reflection_stops_after_the_configured_rounds():
    search = FakeSearch()
    rounds = [[f"round {n} query"] for n in range(10)]
    events = await collect("X", FakeLLM(gaps=rounds), search)

    follow_up_rounds = [e for e in events if e["type"] == "gaps"]
    assert len(follow_up_rounds) == DEEP.reflection_rounds
    assert events[-1]["type"] == "done"


async def test_no_sources_reports_error():
    events = await collect("X", FakeLLM(), EmptySearch())
    assert events[-1]["type"] == "error"
    assert events[-1]["detail"] == "No usable sources were found for this topic."


def test_budget_math():
    b = Budget(cap_usd=1.0)
    b.add("gpt-5-mini", 1_000_000, 1_000_000)
    assert b.spent_usd == pytest.approx(2.25)
    assert not b.can_afford_another_round()


def test_cached_tokens_are_billed_at_the_cached_rate():
    b = Budget(cap_usd=1.0)
    b.add("gpt-5", 1_000_000, 0, cached=1_000_000)
    assert b.spent_usd == pytest.approx(0.125)


def test_plain_replaces_dashes_but_keeps_ranges():
    assert plain("a — b") == "a, b"
    assert plain("a—b") == "a, b"
    assert plain("grew 2020–2025") == "grew 2020–2025"
    assert plain("a – b") == "a, b"
    assert plain("x,— y") == "x, y"


def test_strip_citations_removes_all_markers():
    assert strip_citations("Fact [1]. More [2][5] text.") == "Fact. More text."


class BoomLLM(FakeLLM):
    async def structured(self, schema, system, user):
        raise RuntimeError("secret detail sk-live-123")


async def test_internal_errors_are_not_shown_to_the_user():
    events = await collect("X", BoomLLM(), FakeSearch())
    assert events[-1]["type"] == "error"
    assert events[-1]["detail"] == GENERIC_ERROR
    assert "secret" not in str(events)


async def test_researchers_stop_once_the_spend_cap_is_reached():
    search = FakeSearch()
    factory = make_deps_factory(FakeLLM(), search, spent=DEEP.budget_usd)
    events = [e async for e in run_research("X", make_deps=factory)]

    assert search.queries == []
    assert events[-1]["type"] == "error"


def test_plain_text_headings_are_repaired():
    raw = (
        "Why Economies Cannot Print More Money: Mechanisms and Limits\n\n"
        "Executive Summary\n"
        "Economies cannot costlessly create money because output limits spending.\n\n"
        "Mechanisms of Money Creation\n\n"
        "Banks create money when they lend, and central banks add reserves."
    )
    fixed = ensure_headings(raw)
    assert fixed.startswith("# Why Economies Cannot Print More Money")
    assert "\n## Executive Summary\nEconomies cannot" in fixed
    assert "\n## Mechanisms of Money Creation\n" in fixed


def test_correct_markdown_is_left_untouched():
    raw = "# Title\n\n## Executive Summary\n\nA full sentence paragraph.\n\n## Conclusion\n\nDone."
    assert ensure_headings(raw) == raw


def test_lists_tables_and_paragraphs_are_not_turned_into_headings():
    raw = (
        "# Title\n\n"
        "- Short bullet item\n- Another bullet\n\n"
        "1. First numbered point\n\n"
        "| A | B |\n|---|---|\n| 1 | 2 |\n\n"
        "This is a normal paragraph that is long enough to never look like a heading at all.\n\n"
        "A short sentence ends with a period."
    )
    assert ensure_headings(raw) == raw


def test_a_first_line_that_is_a_sentence_is_not_made_a_title():
    raw = "The answer is short and direct.\n\nMore text follows here."
    assert ensure_headings(raw) == raw
