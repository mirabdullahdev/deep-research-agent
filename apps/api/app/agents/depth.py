from dataclasses import dataclass


@dataclass(frozen=True)
class DepthConfig:
    questions: int
    results_per_question: int
    reflection_rounds: int
    budget_usd: float
    report_words: int


DEEP = DepthConfig(
    questions=8,
    results_per_question=6,
    reflection_rounds=3,
    budget_usd=0.50,
    report_words=2200,
)
