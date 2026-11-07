from pydantic import BaseModel


class Plan(BaseModel):
    questions: list[str]


class RawFinding(BaseModel):
    claim: str
    source_url: str


class Extraction(BaseModel):
    findings: list[RawFinding]


class Gaps(BaseModel):
    follow_ups: list[str]


class Finding(BaseModel):
    question: str
    claim: str
    url: str
    title: str
