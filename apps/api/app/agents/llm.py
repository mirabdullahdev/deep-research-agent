from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Protocol, TypeVar

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.agents.budget import Budget

T = TypeVar("T", bound=BaseModel)


class LLM(Protocol):
    async def structured(self, schema: type[T], system: str, user: str) -> T: ...

    def stream(self, system: str, user: str) -> AsyncIterator[str]: ...


def _counts(usage: dict) -> tuple[int, int, int, int]:
    inputs = usage.get("input_token_details") or {}
    outputs = usage.get("output_token_details") or {}
    return (
        usage.get("input_tokens", 0),
        usage.get("output_tokens", 0),
        inputs.get("cache_read", 0),
        outputs.get("reasoning", 0),
    )


@lru_cache(maxsize=16)
def _chat(model: str, api_key: str, effort: str, max_tokens: int | None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        api_key=api_key,
        reasoning_effort=effort,
        max_retries=3,
        max_tokens=max_tokens,
    )


class OpenAILLM:
    def __init__(
        self,
        model: str,
        api_key: str,
        budget: Budget,
        effort: str = "low",
        max_tokens: int | None = None,
    ):
        self.model = model
        self.budget = budget
        self.client = _chat(model, api_key, effort, max_tokens)

    async def structured(self, schema: type[T], system: str, user: str) -> T:
        chain = self.client.with_structured_output(schema, include_raw=True)
        result = await chain.ainvoke([("system", system), ("user", user)])
        self.budget.add(self.model, *_counts(result["raw"].usage_metadata or {}))
        if result["parsed"] is None:
            raise ValueError(f"model returned unparseable output: {result['parsing_error']}")
        return result["parsed"]

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        totals = [0, 0, 0, 0]
        async for chunk in self.client.astream([("system", system), ("user", user)]):
            if chunk.usage_metadata:
                for i, n in enumerate(_counts(chunk.usage_metadata)):
                    totals[i] += n
            if chunk.content:
                yield chunk.content
        self.budget.add(self.model, *totals)
