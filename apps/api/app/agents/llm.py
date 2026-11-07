from collections.abc import AsyncIterator
from typing import Protocol, TypeVar

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.agents.budget import Budget

T = TypeVar("T", bound=BaseModel)


class LLM(Protocol):
    async def structured(self, schema: type[T], system: str, user: str) -> T: ...

    def stream(self, system: str, user: str) -> AsyncIterator[str]: ...


class OpenAILLM:
    def __init__(self, model: str, api_key: str, budget: Budget, effort: str = "low"):
        self.model = model
        self.budget = budget
        self.client = ChatOpenAI(
            model=model, api_key=api_key, reasoning_effort=effort, max_retries=3
        )

    async def structured(self, schema: type[T], system: str, user: str) -> T:
        chain = self.client.with_structured_output(schema, include_raw=True)
        result = await chain.ainvoke([("system", system), ("user", user)])
        usage = result["raw"].usage_metadata or {}
        self.budget.add(self.model, usage.get("input_tokens", 0), usage.get("output_tokens", 0))
        if result["parsed"] is None:
            raise ValueError(f"model returned unparseable output: {result['parsing_error']}")
        return result["parsed"]

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        tokens_in = tokens_out = 0
        async for chunk in self.client.astream([("system", system), ("user", user)]):
            if chunk.usage_metadata:
                tokens_in += chunk.usage_metadata.get("input_tokens", 0)
                tokens_out += chunk.usage_metadata.get("output_tokens", 0)
            if chunk.content:
                yield chunk.content
        self.budget.add(self.model, tokens_in, tokens_out)
