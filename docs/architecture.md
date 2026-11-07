# Architecture

## Goals

- Real multi-step research, not a single prompt wrapped in a UI.
- A live view of what the agents are doing, with the user in control of the plan.
- Hard cost limits: a small OpenAI budget has to stretch across many visitors.

## Request flow

```
POST /api/plan      topic -> five plain-language steps (or a short reply for small talk)
POST /api/research  topic + approved steps -> Server-Sent Events stream
GET  /health        liveness check
```

Nothing else is exposed: the interactive docs and schema endpoints are disabled.

## Agent graph

```
plan -> research (parallel, up to 8 at once) -> reflect -> (gaps? loop, max 6 rounds) -> write
```

| Node | Job | Model |
|---|---|---|
| Intake (`/api/plan`) | Decide if the message is research, then outline five steps | small |
| Plan | Turn the approved steps into search queries, each with a reason | small |
| Research | Search, read the sources, extract cited facts | small |
| Reflect | Find gaps and missing numbers, request follow-up searches | small |
| Write | Produce the formal report from the extracted facts | large |

Extracted claims are only kept if their URL was one of the sources actually returned, which blocks invented citations. The report carries no inline citation markers; a reference list of all sources is appended instead, and the writer names key sources in the prose.

Deep research settings live in `apps/api/app/agents/depth.py`: 10 opening searches with 8 sources each, up to 6 gap-filling rounds of up to 5 searches, sources read up to 5,000 characters, and a report of about 3,000 words. A run stops starting new work once its spend cap is reached, and the report is always written.

## Streaming events

`stage`, `plan`, `agent`, `source`, `gaps`, `usage`, `report`, `sources`, `done`, `error`. The frontend turns these into the animated research view and the streaming report. Report text is batched into chunks of about 24 characters before it is sent.

## Cost and abuse controls

- **One research run per visitor.** Visitors are identified by a browser id header, with the network address as a fallback.
- **Per-network cap** of three runs a day, with IPv6 addresses grouped by /64 and proxy headers trusted only for a configured number of hops.
- **Global spending cap.** Total recorded spend, plus an estimate for planning calls, stops all runs when exhausted.
- **Planning is rate limited** per network and in total, and refused early once a visitor has used their run.
- **Concurrency cap** on simultaneous runs, with a run timeout.
- **Refunds only for cheap failures**, so forcing errors cannot be used to get free runs.
- **Bounded output**: token limits on every model call, a hard per-run spend stop, and a research budget per run.
- **Moderation** on the topic and any edited plan text.
- **Generic error messages** for anything unexpected; details stay in server logs.

Refusal messages are deliberately neutral and do not reveal the limits.

## Cost model

Token counts come from the API responses. Cost is those counts multiplied by the price table in `apps/api/app/agents/budget.py`, with cached input billed at the cached rate. Measured at the earlier, smaller setting (17 searches, about two minutes): about $0.11 per run, roughly 60% of it the single report-writing call. The current deeper setting runs more searches and a longer report, so expect a higher cost and a longer run; check `apps/api/logs/usage.jsonl` after a run for the real figures.

## Frontend notes

- Static export, so it can be hosted on any static host.
- The animation library is loaded in its lightweight form, the markdown renderer loads when research starts, and the sonar rings use CSS animations.
- The report renders on a light sheet for readability, and respects reduced-motion settings.

## Deployment (not done yet)

- Web: static files on S3 behind CloudFront.
- API: FastAPI on Lambda with response streaming.
- Limits: the local SQLite store must move to DynamoDB with conditional writes, since Lambda instances do not share a disk.
- Set `TRUSTED_PROXIES` to the number of proxies in front of the API. If it is left at zero behind a proxy, every visitor appears to share one address.
