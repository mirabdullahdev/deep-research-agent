from dataclasses import dataclass, field

# USD per 1M tokens: (input, output)
PRICES: dict[str, tuple[float, float]] = {
    "gpt-5": (1.25, 10.0),
    "gpt-5-mini": (0.25, 2.0),
    "gpt-5-nano": (0.05, 0.40),
    "gpt-4.1": (2.0, 8.0),
    "gpt-4.1-mini": (0.40, 1.60),
}
FALLBACK_PRICE = PRICES["gpt-5"]


@dataclass
class Budget:
    cap_usd: float
    spent_usd: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    by_model: dict[str, float] = field(default_factory=dict)

    def add(self, model: str, tokens_in: int, tokens_out: int) -> None:
        price_in, price_out = PRICES.get(model, FALLBACK_PRICE)
        cost = (tokens_in * price_in + tokens_out * price_out) / 1_000_000
        self.spent_usd += cost
        self.tokens_in += tokens_in
        self.tokens_out += tokens_out
        self.by_model[model] = self.by_model.get(model, 0.0) + cost

    @property
    def fraction_used(self) -> float:
        return self.spent_usd / self.cap_usd if self.cap_usd else 1.0

    def can_afford_another_round(self) -> bool:
        return self.fraction_used < 0.6
