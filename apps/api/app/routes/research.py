import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator
from sse_starlette.sse import EventSourceResponse

from app.agents import intake
from app.agents.depth import DEPTHS
from app.agents.intake import Answer, ClarifyQuestion
from app.agents.runner import run_research
from app.agents.schemas import SearchItem
from app.config import Settings, get_settings
from app.guard import Guard, get_guard

router = APIRouter(tags=["research"])

Depth = Literal["quick", "standard", "deep"]
MAX_EXTRA_SEARCHES = 2


class ClarifyIn(BaseModel):
    topic: str = Field(min_length=3, max_length=300)


class ClarifyOut(BaseModel):
    questions: list[ClarifyQuestion]


class AnswerIn(BaseModel):
    question: str = Field(max_length=300)
    answer: str = Field(max_length=300)


class PlanIn(ClarifyIn):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=3)
    depth: Depth = "standard"


class PlanOut(BaseModel):
    searches: list[SearchItem]


class RunIn(PlanIn):
    searches: list[SearchItem] | None = None

    @model_validator(mode="after")
    def check_searches(self):
        if self.searches is None:
            return self
        limit = DEPTHS[self.depth].questions + MAX_EXTRA_SEARCHES
        if not 1 <= len(self.searches) <= limit:
            raise ValueError(f"plan must have between 1 and {limit} searches")
        for s in self.searches:
            s.query = s.query.strip()
            s.reason = s.reason.strip()[:300]
            if not 3 <= len(s.query) <= 160:
                raise ValueError("each search query must be 3-160 characters")
        return self


def _answers(items: list[AnswerIn]) -> list[Answer]:
    return [Answer(question=a.question, answer=a.answer) for a in items]


@router.post("/clarify", response_model=ClarifyOut)
async def clarify(
    req: ClarifyIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
):
    await guard(req.topic)
    return ClarifyOut(questions=await intake.clarify(settings, req.topic))


@router.post("/plan", response_model=PlanOut)
async def plan(
    req: PlanIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
):
    await guard(req.topic, *[a.answer for a in req.answers])
    brief = intake.build_brief(req.topic, _answers(req.answers))
    return PlanOut(searches=await intake.make_plan(settings, brief, req.depth))


@router.post("/research")
async def start_research(
    req: RunIn,
    settings: Annotated[Settings, Depends(get_settings)],
    guard: Annotated[Guard, Depends(get_guard)],
):
    edited = [s.query for s in req.searches or []]
    await guard(req.topic, *[a.answer for a in req.answers], *edited)
    brief = intake.build_brief(req.topic, _answers(req.answers))

    async def events():
        async for event in run_research(
            brief, req.depth, settings=settings, searches=req.searches
        ):
            yield {"event": event["type"], "data": json.dumps(event)}

    return EventSourceResponse(events())
