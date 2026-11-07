import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator
from sse_starlette.sse import EventSourceResponse

from app.agents import intake
from app.agents.runner import run_research
from app.config import Settings, get_settings
from app.guard import Guard, get_guard

router = APIRouter(tags=["research"])

Depth = Literal["quick", "standard", "deep"]
MAX_STEPS = 7


class PlanIn(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    depth: Depth = "deep"


class PlanOut(BaseModel):
    steps: list[str]


class RunIn(PlanIn):
    steps: list[str] | None = None

    @model_validator(mode="after")
    def check_steps(self):
        if self.steps is None:
            return self
        self.steps = [s.strip() for s in self.steps]
        if not 1 <= len(self.steps) <= MAX_STEPS:
            raise ValueError(f"plan must have between 1 and {MAX_STEPS} steps")
        if any(not 3 <= len(s) <= 200 for s in self.steps):
            raise ValueError("each step must be 3-200 characters")
        return self


@router.post("/plan", response_model=PlanOut)
async def plan(
    req: PlanIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
):
    await guard(req.topic)
    return PlanOut(steps=await intake.make_plan(settings, req.topic))


@router.post("/research")
async def start_research(
    req: RunIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
):
    await guard(req.topic, *(req.steps or []))

    async def events():
        async for event in run_research(
            req.topic, req.depth, settings=settings, steps=req.steps
        ):
            yield {"event": event["type"], "data": json.dumps(event)}

    return EventSourceResponse(events())
