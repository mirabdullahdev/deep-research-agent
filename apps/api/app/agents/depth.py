from dataclasses import dataclass


@dataclass(frozen=True)
class DepthConfig:
    questions: int
    results_per_question: int
    reflection_rounds: int
    followups_per_round: int
    budget_usd: float
    report_words: int


DEEP = DepthConfig(
    questions=10,
    results_per_question=8,
    reflection_rounds=6,
    followups_per_round=5,
    budget_usd=0.50,
    report_words=3000,
)
