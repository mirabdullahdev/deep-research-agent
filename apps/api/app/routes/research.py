import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sse_starlette.sse import EventSourceResponse

from app.agents import intake
from app.agents.runner import run_research
from app.config import Settings, get_settings
from app.guard import Guard, get_guard
from app.limits import MESSAGES, LimitStore, get_identity, get_store

router = APIRouter(tags=["research"])

Depth = Literal["quick", "standard", "deep"]
MAX_STEPS = 7

Identity = Annotated[tuple[str, str], Depends(get_identity)]
Store = Annotated[LimitStore, Depends(get_store)]


class PlanIn(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    depth: Depth = "deep"


class PlanOut(BaseModel):
    steps: list[str]
    reply: str = ""


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


def _refuse(reason: str) -> HTTPException:
    return HTTPException(429, MESSAGES[reason])


@router.post("/plan", response_model=PlanOut)
async def plan(
    req: PlanIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
    store: Store,
    identity: Identity,
):
    if settings.rate_limit_enabled and (reason := store.refusal(*identity, settings)):
        raise _refuse(reason)
    await guard(req.topic)
    steps, reply = await intake.make_plan(settings, req.topic)
    return PlanOut(steps=steps, reply=reply)


@router.post("/research")
async def start_research(
    req: RunIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
    store: Store,
    identity: Identity,
):
    run_id = None
    if settings.rate_limit_enabled:
        run_id, reason = store.reserve(*identity, settings)
        if reason:
            raise _refuse(reason)

    try:
        await guard(req.topic, *(req.steps or []))
    except HTTPException:
        if run_id:
            store.finish(run_id, 0.0, refund=True)
        raise

    async def events():
        spent, failed = 0.0, False
        try:
            async for event in run_research(
                req.topic, req.depth, settings=settings, steps=req.steps
            ):
                if event["type"] in ("usage", "done"):
                    spent = event["spent_usd"]
                failed = failed or event["type"] == "error"
                yield {"event": event["type"], "data": json.dumps(event)}
        finally:
            if run_id:
                store.finish(run_id, spent, refund=failed)

    return EventSourceResponse(events())
