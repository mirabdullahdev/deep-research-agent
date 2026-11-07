from dataclasses import asdict, dataclass, field

# USD per 1M tokens: (input, cached input, output). Reasoning tokens bill as output.
PRICES: dict[str, tuple[float, float, float]] = {
    "gpt-5": (1.25, 0.125, 10.0),
    "gpt-5-mini": (0.25, 0.025, 2.0),
    "gpt-5-nano": (0.05, 0.005, 0.40),
    "gpt-4.1": (2.0, 0.5, 8.0),
    "gpt-4.1-mini": (0.40, 0.10, 1.60),
}
FALLBACK_PRICE = PRICES["gpt-5"]


@dataclass
class ModelUsage:
    calls: int = 0
    input_tokens: int = 0
    cached_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cost_usd: float = 0.0


@dataclass
class Budget:
    cap_usd: float
    spent_usd: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    searches: int = 0
    by_model: dict[str, ModelUsage] = field(default_factory=dict)

    def add(
        self, model: str, tokens_in: int, tokens_out: int, cached: int = 0, reasoning: int = 0
    ) -> None:
        price_in, price_cached, price_out = PRICES.get(model, FALLBACK_PRICE)
        fresh = max(tokens_in - cached, 0)
        cost = (fresh * price_in + cached * price_cached + tokens_out * price_out) / 1_000_000

        usage = self.by_model.setdefault(model, ModelUsage())
        usage.calls += 1
        usage.input_tokens += tokens_in
        usage.cached_tokens += cached
        usage.output_tokens += tokens_out
        usage.reasoning_tokens += reasoning
        usage.cost_usd += cost

        self.spent_usd += cost
        self.tokens_in += tokens_in
        self.tokens_out += tokens_out

    @property
    def fraction_used(self) -> float:
        return self.spent_usd / self.cap_usd if self.cap_usd else 1.0

    def can_afford_another_round(self) -> bool:
        return self.fraction_used < 0.6

    def summary(self) -> dict:
        return {
            "openai_cost_usd": round(self.spent_usd, 6),
            "tavily_searches": self.searches,
            "models": {m: asdict(u) for m, u in self.by_model.items()},
        }
