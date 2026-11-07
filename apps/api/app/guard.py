from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, HTTPException
from openai import AsyncOpenAI

from app.config import Settings, get_settings

Guard = Callable[..., Awaitable[None]]


async def moderate(settings: Settings, *texts: str) -> None:
    joined = "\n".join(t for t in texts if t.strip())
    if not joined:
        return
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        res = await client.moderations.create(model="omni-moderation-latest", input=joined)
    except Exception as exc:
        raise HTTPException(503, "Safety check is unavailable, try again shortly.") from exc
    if res.results[0].flagged:
        raise HTTPException(400, "This request was blocked by the content safety check.")


def get_guard(settings: Annotated[Settings, Depends(get_settings)]) -> Guard:
    async def guard(*texts: str) -> None:
        await moderate(settings, *texts)

    return guard
