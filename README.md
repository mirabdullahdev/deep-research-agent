# Deep Research Agent

A team of AI agents that researches any topic you give it. It proposes a five-step plan you can edit, searches the web in parallel, checks its own coverage for gaps, and writes a formal report with a reference list. The interface streams the work live, so you can watch the agents run.

Built as a portfolio project with a hard cost ceiling: a full research run uses a few cents of OpenAI credit.

## How it works

1. **Ask.** Enter a topic. Greetings and small talk get a short reply instead of a plan.
2. **Plan.** The agent drafts five plain-language steps. Approve them as written or edit, remove and add steps first.
3. **Research.** Search agents work in parallel, read the sources, extract cited facts, and run up to six gap-filling rounds.
4. **Report.** A writer produces a titled report (summary, themed sections, conclusion, limitations) that streams onto the page, followed by a reference list.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router, static export), TypeScript, Tailwind, Framer Motion |
| Backend | FastAPI, LangGraph, Server-Sent Events |
| Models | OpenAI: a small model for searching and reading, a larger one for the report |
| Search | Tavily |
| Safety | OpenAI moderation on every topic and edited plan, per-visitor and global limits |

## Layout

```
apps/web     Next.js frontend
apps/api     FastAPI service and the agent graph
docs/        architecture and cost notes
```

## Running locally

API:

```bash
cd apps/api
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload
```

Web:

```bash
cd apps/web
npm install
npm run dev
```

The web app runs on http://localhost:3000 and the API on http://localhost:8000. Add your OpenAI and Tavily keys to `apps/api/.env`. Set `RATE_LIMIT_ENABLED=false` there while developing, or you will hit the per-visitor limit after one run.

## Checks

```bash
cd apps/api && uv run ruff check . && uv run pytest -q
cd apps/web && npm run lint && npm run build
```

## Usage log

Every plan and research request appends one JSON line to `apps/api/logs/usage.jsonl` with tokens per model (input, cached, output, reasoning), search calls, duration and the computed OpenAI cost. The log stays local and is ignored by git.

## Docs

- [Architecture](docs/architecture.md)
