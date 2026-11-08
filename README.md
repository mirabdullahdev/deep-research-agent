# Deep Research Agent

A team of AI agents that researches any topic you give it. It proposes a five-step plan you can edit, searches the web in parallel, checks its own coverage for gaps, and writes a formal report with a reference list. The interface streams the work live, so you can watch the agents run.

Built with a hard cost ceiling per run, per-visitor limits and a global spend cap, so it is safe to run as a public demo.

## How it works

1. **Ask.** Enter a topic. Greetings and small talk get a short reply instead of a plan.
2. **Plan.** The agent drafts five plain-language steps. Approve them as written or edit, remove and add steps first.
3. **Research.** Search agents work in parallel, read the sources, extract facts, and run several gap-filling rounds.
4. **Report.** A writer produces a titled report (summary, themed sections, conclusion, limitations) that streams onto the page, followed by a reference list.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend | FastAPI, LangGraph, Server-Sent Events |
| Models | OpenAI: a small model for searching and reading, a larger one for the report |
| Search | Tavily |
| Safety | OpenAI moderation on every topic and edited plan, per-visitor and global limits |

## Project layout

```
apps/web     Next.js frontend
apps/api     FastAPI service and the agent graph
docs/        architecture and cost notes
```

## Before you start

You need:

| Tool | Version | Check |
|---|---|---|
| Git | any | `git --version` |
| Python | 3.12 or newer | `python --version` |
| uv (Python package manager) | any recent | `uv --version` |
| Node.js | 20 or newer | `node --version` |

And two API keys:

- **OpenAI** key from https://platform.openai.com/api-keys (needs a little credit and access to the models named in your `.env`).
- **Tavily** key from https://app.tavily.com (the free tier is enough to try it).

Install uv if you do not have it:

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

uv downloads a matching Python for you if yours is older than 3.12, so a separate Python install is optional.

## Setup

### 1. Clone

```bash
git clone https://github.com/mirabdullahdev/deep-research-agent.git
cd deep-research-agent
```

### 2. Backend

```bash
cd apps/api
uv sync
```

`uv sync` creates the virtual environment in `apps/api/.venv` and installs the locked dependencies. You do not need to activate it, because every command below runs through `uv run`.

Create your environment file:

```bash
# macOS / Linux
cp .env.example .env
```

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `apps/api/.env` and fill in your keys:

```
OPENAI_API_KEY=your-openai-key
TAVILY_API_KEY=your-tavily-key
```

For local use, also set:

```
RATE_LIMIT_ENABLED=false
```

Otherwise the per-visitor limit blocks you after your first research run. Leave it `true` if you deploy the app publicly.

Start the API:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Check it at http://localhost:8000/health. It should return a small JSON status.

### 3. Frontend

Open a second terminal at the project root:

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000, type a topic and follow the flow.

The frontend expects the API at `http://localhost:8000`. To point it somewhere else, create `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=https://your-api.example.com
```

If you serve the frontend from another origin, add it to `CORS_ORIGINS` in `apps/api/.env` as a JSON list, for example `CORS_ORIGINS=["https://your-site.example.com"]`.

## Configuration

All settings live in `apps/api/.env`. The defaults in `.env.example` are a good starting point.

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY`, `TAVILY_API_KEY` | Your keys. Required. |
| `PLANNER_MODEL`, `WORKER_MODEL`, `WRITER_MODEL` | Which OpenAI model handles planning, reading and writing the report |
| `RATE_LIMIT_ENABLED` | Turn the limits below on or off |
| `RUNS_PER_VISITOR` | Research runs allowed per browser |
| `RUNS_PER_IP_PER_DAY` | Research runs allowed per network address per day |
| `GLOBAL_BUDGET_USD` | Total spend allowed across all visitors |
| `MAX_CONCURRENT_RUNS` | Runs allowed at the same time |
| `PLANS_PER_IP_PER_HOUR`, `PLANS_GLOBAL_PER_DAY` | Limits on drafting plans |
| `TRUSTED_PROXIES` | Number of reverse proxies in front of the API (needed for correct IP limits when deployed) |

A single run also has a hard spending cap built in, and the run stops if it is reached.

## Keeping your keys safe

- Keys only ever live in `apps/api/.env`, which is listed in `.gitignore` and is never committed. Only `.env.example` (with empty values) is in the repository.
- Never put a key in the frontend. The browser talks only to your API, and the API calls OpenAI and Tavily.
- Never paste your `.env` into an issue, a chat or a screenshot. If a key leaks, revoke it in the OpenAI or Tavily dashboard and create a new one.
- Set a monthly spend limit in your OpenAI account as a second safety net.

## Checks

```bash
cd apps/api && uv run ruff check . && uv run pytest -q
cd apps/web && npm run lint && npm run build
```

The tests run without calling OpenAI or Tavily, so they cost nothing.

## Usage log

Every plan and research request appends one JSON line to `apps/api/logs/usage.jsonl` with tokens per model (input, cached, output, reasoning), search calls, duration and the computed OpenAI cost. The log stays on your machine and is ignored by git.

## Troubleshooting

| Problem | Fix |
|---|---|
| `uv: command not found` | Install uv (see above) and open a new terminal |
| The page loads but planning fails | Check the API terminal for errors and confirm both keys are set in `apps/api/.env` |
| "Testing complete" appears after one run | Rate limits are on. Set `RATE_LIMIT_ENABLED=false` and restart the API |
| Browser shows a CORS error | Add your frontend address to `CORS_ORIGINS` and restart the API |
| Model not found / access denied | Your OpenAI account may not have access to the configured models. Change `PLANNER_MODEL`, `WORKER_MODEL` and `WRITER_MODEL` to ones you can use |
| Port already in use | Stop the other process, or pass another port with `--port` (API) and `-- --port` (web), and update `NEXT_PUBLIC_API_URL` |

## Docs

- [Architecture](docs/architecture.md)

## License

Released under the [MIT License](LICENSE).
