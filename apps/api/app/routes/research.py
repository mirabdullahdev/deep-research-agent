import asyncio
import json

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

router = APIRouter(tags=["research"])


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    depth: str = Field(default="standard", pattern="^(quick|standard|deep)$")


async def stream_events(req: ResearchRequest):
    # placeholder until the LangGraph pipeline is wired in
    steps = ["planning", "searching", "reading", "reflecting", "writing"]
    for step in steps:
        yield {"event": "stage", "data": json.dumps({"stage": step})}
        await asyncio.sleep(0.5)
    yield {"event": "done", "data": json.dumps({"topic": req.topic})}


@router.post("/research")
async def start_research(req: ResearchRequest):
    return EventSourceResponse(stream_events(req))
