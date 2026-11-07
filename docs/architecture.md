# Architecture

## Goals

- Real multi-step research, not a single prompt wrapped in a UI.
- A live, animated view of what the agents are doing.
- Hard cost limits: roughly $5 of OpenAI credit has to last, and AWS should cost close to nothing when idle.

## Agent graph

```
topic -> planner -> [researcher x N, parallel] -> reflector -> (gaps? loop, max 2) -> writer -> report
```

| Node | Job | Model tier |
|---|---|---|
| Planner | Split the topic into sub-questions | strong |
| Researcher | Search, read top sources, extract cited facts | small |
| Reflector | Find gaps and contradictions, request follow-ups | small |
| Writer | Produce the structured report with inline citations | strong |

Each run has a depth mode (quick, standard, deep) that sets the number of sub-questions, sources read, and reflection rounds. Every mode has a hard token and search budget.

## Streaming

`POST /api/research` returns a Server-Sent Events stream. Events:

- `stage`: the pipeline moved to a new stage
- `agent`: an individual researcher started, found a source, or finished
- `report`: partial or final report content
- `done` / `error`

The frontend maps these events to the animated research view.

## Cost and abuse controls

- Per-IP daily run limit, stored in DynamoDB with TTL.
- Global daily budget counter; when exhausted the site falls back to demo mode.
- Per-run token budget enforced inside the graph.
- Spending cap on the OpenAI project key as a last resort.
- Pre-generated sample reports that replay with the same animation at zero cost.
- Bot protection with Cloudflare Turnstile.

## Deployment

- Web: static Next.js export on S3 behind CloudFront.
- API: FastAPI on Lambda (container image with Lambda Web Adapter, response streaming).
- State: DynamoDB on-demand.
- Defined with AWS CDK in `infra/`.

Deployment comes after the core agent pipeline and UI work locally.
