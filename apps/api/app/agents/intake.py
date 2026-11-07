from app.agents import prompts
from app.agents.budget import Budget
from app.agents.llm import OpenAILLM
from app.agents.schemas import Outline
from app.config import Settings

PLAN_STEPS = 5


async def make_plan(settings: Settings, topic: str) -> list[str]:
    llm = OpenAILLM(settings.worker_model, settings.openai_api_key, Budget(cap_usd=0.01), "low")
    result = await llm.structured(
        Outline, prompts.OUTLINE.format(n=PLAN_STEPS), f"Topic: {topic}"
    )
    steps = [s.strip() for s in result.steps if s.strip()]
    if not steps:
        raise ValueError("The planner returned no steps.")
    return steps[:PLAN_STEPS]
