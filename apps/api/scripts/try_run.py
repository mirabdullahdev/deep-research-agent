import asyncio
import sys

from app.agents.runner import run_research
from app.config import get_settings


async def main(topic: str, depth: str) -> None:
    settings = get_settings()
    async for event in run_research(topic, depth, settings=settings):
        kind = event["type"]
        if kind == "report":
            print(event["delta"], end="", flush=True)
        elif kind == "done":
            print(f"\n\nfollow-ups: {event['follow_ups']}")
            print(f"spent ${event['spent_usd']} "
                  f"({event['tokens_in']} in / {event['tokens_out']} out)")
        elif kind in ("stage", "plan", "gaps", "error"):
            print(f"\n[{kind}] {event}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "quick"))
