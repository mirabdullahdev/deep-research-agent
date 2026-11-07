import json
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.agents.runner import run_research
from app.config import Settings, get_settings

router = APIRouter(tags=["research"])


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    depth: str = Field(default="standard", pattern="^(quick|standard|deep)$")


@router.post("/research")
async def start_research(
    req: ResearchRequest, settings: Annotated[Settings, Depends(get_settings)]
):
    async def events():
        async for event in run_research(req.topic, req.depth, settings=settings):
            name = event["type"]
            yield {"event": name, "data": json.dumps(event)}

    return EventSourceResponse(events())
