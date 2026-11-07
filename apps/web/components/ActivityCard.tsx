"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AgentState, Outcome, RunState } from "@/lib/useResearch";

const CX = 360;
const CY = 230;
const ringRx = (r: number) => 150 + r * 55;
const ringRy = (r: number) => 95 + r * 35;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function place(agent: AgentState, agents: AgentState[]) {
  const mates = agents.filter((a) => a.ring === agent.ring);
  const k = mates.indexOf(agent);
  const a = (k / mates.length) * Math.PI * 2 - Math.PI / 2 + agent.ring * 0.55;
  return { x: CX + ringRx(agent.ring) * Math.cos(a), y: CY + ringRy(agent.ring) * Math.sin(a) };
}

const FILL: Record<AgentState["status"], string> = {
  queued: "transparent",
  searching: "#ff5b2e",
  reading: "#ff5b2e",
  done: "#4fd1c5",
  error: "#6b7d8c",
};

function SonarMap({ run, live }: { run: RunState; live: boolean }) {
  const calm = useReducedMotion() || !live;
  const rings = run.round + 1;

  return (
    <svg
      viewBox="0 0 720 460"
      className="h-auto w-full"
      role="img"
      aria-label="Live map of the search agents"
    >
      {Array.from({ length: rings + 1 }, (_, r) => (
        <ellipse
          key={r}
          cx={CX}
          cy={CY}
          rx={ringRx(r)}
          ry={ringRy(r)}
          fill="none"
          stroke="#6fa3b5"
          strokeOpacity={0.22}
          strokeDasharray={r === 0 ? undefined : "2 6"}
        />
      ))}

      {run.agents.map((a) => {
        const p = place(a, run.agents);
        const active = live && (a.status === "searching" || a.status === "reading");
        const left = p.x < CX;
        return (
          <g key={a.query}>
            {a.status !== "queued" && (
              <motion.line
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                stroke={active ? "#ff5b2e" : "#4fd1c5"}
                strokeOpacity={active ? 0.55 : 0.28}
                strokeDasharray="3 5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            )}

            {active &&
              !calm &&
              [0, 1].map((d) => (
                <motion.circle
                  key={d}
                  cx={p.x}
                  cy={p.y}
                  fill="none"
                  stroke="#ff5b2e"
                  strokeWidth={1.2}
                  initial={{ r: 8, opacity: 0.7 }}
                  animate={{ r: 52, opacity: 0 }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: d * 1.2, ease: "easeOut" }}
                />
              ))}

            {a.sources.slice(0, 7).map((s) => {
              const ang = hash(s.url) * Math.PI * 2;
              const dist = 20 + hash(s.url + "d") * 24;
              return (
                <motion.circle
                  key={s.url}
                  cx={p.x + Math.cos(ang) * dist}
                  cy={p.y + Math.sin(ang) * dist}
                  r={2.6}
                  fill="#d6e8f3"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.95 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14 }}
                />
              );
            })}

            <motion.circle
              cx={p.x}
              cy={p.y}
              r={7}
              fill={FILL[a.status]}
              stroke={a.status === "queued" ? "#6fa3b5" : FILL[a.status]}
              strokeWidth={1.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            />
            <text
              x={p.x + (left ? -14 : 14)}
              y={p.y + 4}
              textAnchor={left ? "end" : "start"}
              className="fill-[#9fb8c8] font-mono"
              fontSize={10.5}
            >
              {a.query.length > 30 ? `${a.query.slice(0, 29)}…` : a.query}
            </text>
          </g>
        );
      })}

      <circle cx={CX} cy={CY} r={5} fill="#ff5b2e" />
      {!calm && (
        <motion.circle
          cx={CX}
          cy={CY}
          fill="none"
          stroke="#ff5b2e"
          strokeOpacity={0.6}
          initial={{ r: 6, opacity: 0.8 }}
          animate={{ r: 30, opacity: 0 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </svg>
  );
}

function useElapsed(running: boolean, since: number) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running, since]);
  return seconds;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function StatusIcon({ status, live }: { status: AgentState["status"]; live: boolean }) {
  if (status === "done") return <span className="text-[#4fd1c5]">✓</span>;
  if (status === "error") return <span className="text-white/40">✕</span>;
  if (status === "queued" || !live) {
    return <span className="inline-block h-2 w-2 rounded-full border border-white/30" />;
  }
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-buoy opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-buoy" />
    </span>
  );
}

const STAGE_LABEL = {
  searching: "Searching and reading sources",
  reflecting: "Checking for gaps",
  writing: "Writing the report",
};

export function ActivityCard({
  run,
  running,
  reportStarted,
  stopped,
  outcome,
}: {
  run: RunState;
  running: boolean;
  reportStarted: boolean;
  stopped: boolean;
  outcome: Outcome | null;
}) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? !reportStarted;
  const seconds = useElapsed(running, run.startedAt);
  const total = run.agents.reduce((n, a) => n + a.sources.length, 0);

  const title = running
    ? STAGE_LABEL[run.stage]
    : stopped
      ? "Research stopped"
      : `Researched for ${outcome ? Math.round(outcome.elapsedMs / 1000) : seconds}s`;

  return (
    <section className="overflow-hidden rounded-2xl bg-abyss text-[#dbe8f0] ring-1 ring-white/10">
      <button
        type="button"
        onClick={() => setChoice(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          {running ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-buoy opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-buoy" />
            </span>
          ) : (
            <span className="text-[#4fd1c5]">{stopped ? "■" : "✓"}</span>
          )}
          <span className="font-display text-base font-medium">{title}</span>
        </span>
        <span className="flex items-center gap-4 font-mono text-[11px] text-white/55">
          {running && <span>{clock(seconds)}</span>}
          <span>{total} sources</span>
          <span>
            ${(outcome?.spent ?? run.spent).toFixed(3)}
            {running && run.cap ? ` / $${run.cap.toFixed(2)}` : ""}
          </span>
          <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          <div className="px-2 py-3 sm:px-5">
            <SonarMap run={run} live={running} />
          </div>

          <ul className="space-y-4 border-t border-white/10 px-5 py-5">
            {run.agents.map((a) => (
              <li key={a.query} className="flex gap-3 text-sm">
                <span className="mt-1.5 flex w-3 shrink-0 justify-center">
                  <StatusIcon status={a.status} live={running} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={a.status === "queued" ? "text-white/45" : "text-white/90"}>
                      {a.query}
                    </p>
                    {a.status === "done" && (
                      <span className="shrink-0 font-mono text-[11px] text-white/45">
                        {a.findings} facts
                      </span>
                    )}
                  </div>
                  {a.sources.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {a.sources.map((s) => (
                        <li key={s.url} className="min-w-0">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={s.title}
                            className="block max-w-[14rem] truncate font-mono text-[11.5px] text-white/50 transition-colors hover:text-buoy"
                          >
                            {domain(s.url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
