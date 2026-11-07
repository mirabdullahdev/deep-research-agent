from app.agents import prompts, usage_log
from app.agents.budget import Budget
from app.agents.llm import OpenAILLM
from app.agents.schemas import Outline
from app.agents.text import plain
from app.config import Settings

PLAN_STEPS = 5
FALLBACK_REPLY = "I research topics and questions on the web. What would you like to look into?"


async def make_plan(settings: Settings, topic: str) -> tuple[list[str], str]:
    budget = Budget(cap_usd=0.01)
    llm = OpenAILLM(settings.worker_model, settings.openai_api_key, budget, "minimal", 3000)
    result = await llm.structured(
        Outline, prompts.OUTLINE.format(n=PLAN_STEPS), f"Message: {topic}"
    )
    usage_log.record("plan", budget, topic=topic)
    if not result.research:
        return [], plain(result.reply.strip()) or FALLBACK_REPLY
    steps = [plain(s.strip()) for s in result.steps if s.strip()]
    if not steps:
        return [], FALLBACK_REPLY
    return steps[:PLAN_STEPS], ""
