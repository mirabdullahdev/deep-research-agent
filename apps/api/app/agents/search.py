from typing import Protocol

from pydantic import BaseModel
from tavily import AsyncTavilyClient

MAX_CHARS_PER_SOURCE = 5000


class Source(BaseModel):
    url: str
    title: str
    text: str


class SearchClient(Protocol):
    async def search(self, query: str, max_results: int) -> list[Source]: ...


class TavilySearch:
    def __init__(self, api_key: str):
        self.client = AsyncTavilyClient(api_key=api_key)

    async def search(self, query: str, max_results: int) -> list[Source]:
        res = await self.client.search(
            query, max_results=max_results, include_raw_content=True, search_depth="basic"
        )
        sources = []
        for item in res.get("results", []):
            text = item.get("raw_content") or item.get("content") or ""
            if not text:
                continue
            sources.append(
                Source(
                    url=item["url"],
                    title=item.get("title") or item["url"],
                    text=text[:MAX_CHARS_PER_SOURCE],
                )
            )
        return sources
