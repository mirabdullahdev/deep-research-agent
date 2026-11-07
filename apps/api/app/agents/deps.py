import asyncio
from collections.abc import Callable
from dataclasses import dataclass

from app.agents.budget import Budget
from app.agents.depth import DepthConfig
from app.agents.llm import LLM
from app.agents.search import SearchClient


@dataclass
class Deps:
    planner: LLM
    worker: LLM
    writer: LLM
    search: SearchClient
    budget: Budget
    depth: DepthConfig
    emit: Callable[[dict], None]
    gate: asyncio.Semaphore
