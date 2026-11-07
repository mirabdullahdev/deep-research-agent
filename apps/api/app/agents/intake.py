from pydantic import BaseModel

from app.agents import prompts
from app.agents.budget import Budget
from app.agents.depth import DEPTHS
from app.agents.llm import OpenAILLM
from app.agents.schemas import Plan, SearchItem
from app.config import Settings

CLARIFIER = """You are the intake step of a research assistant. Decide whether the user's topic \
is ambiguous in a way that would change what gets researched (scope, time frame, region, \
audience, angle). If it is clear enough, return no questions. Otherwise ask at most 3 short \
questions, each with 2-4 short suggested answers the user can click. Never ask something you \
could reasonably assume."""


class ClarifyQuestion(BaseModel):
    question: str
    suggestions: list[str]


class Clarification(BaseModel):
    questions: list[ClarifyQuestion]


class Answer(BaseModel):
    question: str
    answer: str


def build_brief(topic: str, answers: list[Answer]) -> str:
    given = [a for a in answers if a.answer.strip()]
    if not given:
        return topic
    lines = "\n".join(f"- {a.question} {a.answer}" for a in given)
    return f"{topic}\n\nUser clarifications:\n{lines}"


def _llm(settings: Settings, effort: str) -> OpenAILLM:
    budget = Budget(cap_usd=0.01)
    return OpenAILLM(settings.worker_model, settings.openai_api_key, budget, effort)


async def clarify(settings: Settings, topic: str) -> list[ClarifyQuestion]:
    llm = _llm(settings, "minimal")
    result = await llm.structured(Clarification, CLARIFIER, f"Topic: {topic}")
    return [q for q in result.questions if q.question.strip()][:3]


async def make_plan(settings: Settings, brief: str, depth: str) -> list[SearchItem]:
    n = DEPTHS[depth].questions
    result = await _llm(settings, "low").structured(
        Plan, prompts.PLANNER.format(n=n), f"Topic: {brief}"
    )
    return [s for s in result.searches if s.query.strip()][:n]
