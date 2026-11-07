# Deep Research Agent

A team of AI agents that research any topic you give them: plan the work, search the web in parallel, read sources, check for gaps, and write a cited report. The UI streams every step live so you can watch the agents work.

Built as a portfolio project with a hard cost ceiling, so it runs on a small OpenAI budget and minimal AWS infrastructure.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind, Framer Motion |
| Backend | FastAPI, LangGraph, Server-Sent Events |
| Models | OpenAI, tiered (strong planner/writer, small workers) |
| Search | Tavily |
| Data | DynamoDB (rate limits, budget counter, saved reports) |
| Hosting | S3 + CloudFront (web), Lambda (API) |
| IaC | AWS CDK (Python) |

## Layout

```
apps/web     Next.js frontend
apps/api     FastAPI service and agent graph
infra/       AWS CDK stacks
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

The web app runs on http://localhost:3000 and the API on http://localhost:8000.

## Docs

- [Architecture](docs/architecture.md)
