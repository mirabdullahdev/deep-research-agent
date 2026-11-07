"use client";

import { useCallback, useRef, useState } from "react";
import { makePlan, streamResearch } from "./api";
import type { Depth, SearchItem, ServerEvent, SourceRef } from "./types";

export type Phase = "ask" | "drafting" | "plan" | "research" | "report" | "error";

export interface AgentState {
  query: string;
  reason: string;
  status: "queued" | "searching" | "reading" | "done" | "error";
  findings: number;
  ring: number;
  sources: { url: string; title: string }[];
}

export interface RunState {
  stage: "searching" | "reflecting" | "writing";
  agents: AgentState[];
  round: number;
  spent: number;
  cap: number;
  startedAt: number;
}

export interface Outcome {
  spent: number;
  elapsedMs: number;
  tokens: number;
}

const queued = (s: SearchItem, ring: number): AgentState => ({
  query: s.query,
  reason: s.reason,
  status: "queued",
  findings: 0,
  ring,
  sources: [],
});

function reduceRun(run: RunState, ev: ServerEvent): RunState {
  switch (ev.type) {
    case "agent": {
      const status = { start: "searching", reading: "reading", done: "done", error: "error" }[
        ev.event
      ] as AgentState["status"];
      const known = run.agents.some((a) => a.query === ev.question);
      const agents = known
        ? run.agents.map((a) =>
            a.query === ev.question ? { ...a, status, findings: ev.findings ?? a.findings } : a,
          )
        : [
            ...run.agents,
            { ...queued({ query: ev.question, reason: ev.reason ?? "" }, run.round), status },
          ];
      return { ...run, agents };
    }
    case "source":
      return {
        ...run,
        agents: run.agents.map((a) =>
          a.query === ev.question
            ? { ...a, sources: [...a.sources, { url: ev.url, title: ev.title }] }
            : a,
        ),
      };
    case "gaps": {
      const round = run.round + 1;
      return { ...run, round, agents: [...run.agents, ...ev.searches.map((s) => queued(s, round))] };
    }
    case "stage":
      if (ev.stage === "reflecting") return { ...run, stage: "reflecting" };
      if (ev.stage === "writing") return { ...run, stage: "writing" };
      return run;
    case "usage":
      return { ...run, spent: ev.spent_usd, cap: ev.cap_usd };
    default:
      return run;
  }
}

export function useResearch() {
  const [phase, setPhase] = useState<Phase>("ask");
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<Depth>("standard");
  const [plan, setPlan] = useState<SearchItem[]>([]);
  const [approved, setApproved] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<SourceRef[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stopped, setStopped] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const buffer = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Something went wrong.");
    setPhase("error");
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const submit = useCallback(
    async (t: string, d: Depth) => {
      abort.current?.abort();
      clearTimer();
      setTopic(t);
      setDepth(d);
      setPlan([]);
      setApproved(false);
      setRun(null);
      setReport("");
      setSources([]);
      setFollowUps([]);
      setOutcome(null);
      setStopped(false);
      setPhase("drafting");
      try {
        const res = await makePlan(t, d);
        setPlan(res.searches);
        setPhase("plan");
      } catch (e) {
        fail(e);
      }
    },
    [fail],
  );

  const approve = useCallback(
    async (searches: SearchItem[]) => {
      const startedAt = Date.now();
      abort.current = new AbortController();
      buffer.current = "";
      setReport("");
      setSources([]);
      setFollowUps([]);
      setOutcome(null);
      setStopped(false);
      setApproved(true);
      setPlan(searches);
      setRun({
        stage: "searching",
        agents: searches.map((s) => queued(s, 0)),
        round: 0,
        spent: 0,
        cap: 0,
        startedAt,
      });
      setPhase("research");

      try {
        for await (const ev of streamResearch(
          { topic, depth, searches },
          abort.current.signal,
        )) {
          if (ev.type === "report") {
            buffer.current += ev.delta;
            setPhase("report");
            if (!timer.current) {
              timer.current = setTimeout(() => {
                setReport(buffer.current);
                timer.current = null;
              }, 70);
            }
          } else if (ev.type === "sources") {
            setSources(ev.sources);
          } else if (ev.type === "followups") {
            setFollowUps(ev.questions);
          } else if (ev.type === "done") {
            clearTimer();
            setReport(ev.report);
            setFollowUps(ev.follow_ups);
            setOutcome({
              spent: ev.spent_usd,
              elapsedMs: Date.now() - startedAt,
              tokens: ev.tokens_in + ev.tokens_out,
            });
            setPhase("report");
          } else if (ev.type === "error") {
            throw new Error(ev.detail);
          } else {
            setRun((r) => (r ? reduceRun(r, ev) : r));
          }
        }
      } catch (e) {
        if (!abort.current?.signal.aborted) fail(e);
      }
    },
    [topic, depth, fail],
  );

  const stop = useCallback(() => {
    abort.current?.abort();
    clearTimer();
    setStopped(true);
    if (buffer.current) {
      setReport(buffer.current);
      setPhase("report");
    } else {
      setApproved(false);
      setPhase("plan");
    }
  }, []);

  const retry = useCallback(() => {
    if (plan.length > 0) {
      setApproved(false);
      setPhase("plan");
    } else {
      void submit(topic, depth);
    }
  }, [plan, submit, topic, depth]);

  const reset = useCallback(() => {
    abort.current?.abort();
    clearTimer();
    setPhase("ask");
    setRun(null);
    setReport("");
    setError("");
    setApproved(false);
  }, []);

  return {
    phase,
    error,
    topic,
    depth,
    plan,
    approved,
    run,
    report,
    sources,
    followUps,
    outcome,
    stopped,
    submit,
    approve,
    stop,
    retry,
    reset,
  };
}
