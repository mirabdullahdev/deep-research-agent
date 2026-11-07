from dataclasses import dataclass


@dataclass(frozen=True)
class DepthConfig:
    questions: int
    results_per_question: int
    reflection_rounds: int
    budget_usd: float
    report_words: int


DEPTHS: dict[str, DepthConfig] = {
    "quick": DepthConfig(3, 3, 0, 0.05, 600),
    "standard": DepthConfig(5, 4, 1, 0.15, 1100),
    "deep": DepthConfig(7, 5, 2, 0.35, 1800),
}
