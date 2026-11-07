from pydantic import BaseModel


class SearchItem(BaseModel):
    query: str
    reason: str


class Plan(BaseModel):
    searches: list[SearchItem]


class Outline(BaseModel):
    steps: list[str]


class RawFinding(BaseModel):
    claim: str
    source_url: str


class Extraction(BaseModel):
    findings: list[RawFinding]


class Gaps(BaseModel):
    follow_ups: list[SearchItem]


class Finding(BaseModel):
    question: str
    claim: str
    url: str
    title: str
