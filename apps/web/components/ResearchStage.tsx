"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AgentState, RunState } from "@/lib/useResearch";

const CX = 360;
const CY = 230;
const ringRx = (r: number) => 150 + r * 55;
const ringRy = (r: number) => 95 + r * 35;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function domain(url: string) {
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

function SonarMap({ run }: { run: RunState }) {
  const calm = useReducedMotion();
  const rings = Math.max(run.round, 0) + 1;

  return (
    <svg viewBox="0 0 720 460" className="h-auto w-full" role="img" aria-label="Live map of the search agents">
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
        const live = a.status === "searching" || a.status === "reading";
        const left = p.x < CX;
        return (
          <g key={a.query}>
            {a.status !== "queued" && (
              <motion.line
                x1={CX}
                y1={CY}
                x2={p.x}
                y2={p.y}
                stroke={live ? "#ff5b2e" : "#4fd1c5"}
                strokeOpacity={live ? 0.55 : 0.28}
                strokeDasharray="3 5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            )}

            {live && !calm && (
              <>
                {[0, 1].map((d) => (
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
              </>
            )}

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

const STAGES = [
  { key: "searching", label: "Searching and reading" },
  { key: "reflecting", label: "Checking for gaps" },
  { key: "writing", label: "Writing the report" },
] as const;

function useElapsed(since: number) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((Math.max(now, since) - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<AgentState["status"], string> = {
  queued: "Queued",
  searching: "Searching",
  reading: "Reading",
  done: "Done",
  error: "Failed",
};

export function ResearchStage({ run, topic }: { run: RunState; topic: string }) {
  const elapsed = useElapsed(run.startedAt);
  const activeIndex = STAGES.findIndex((s) => s.key === run.stage);
  const sources = run.agents.flatMap((a) => a.sources);
  const recent = sources.slice(-5).reverse();

  return (
    <section className="overflow-hidden rounded-3xl bg-abyss text-[#dbe8f0] shadow-[0_40px_80px_-40px_rgba(7,19,31,0.8)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4 sm:px-8">
        <ol className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          {STAGES.map((s, i) => (
            <li
              key={s.key}
              className={
                i === activeIndex ? "text-buoy" : i < activeIndex ? "text-[#4fd1c5]" : "text-white/30"
              }
            >
              {i < activeIndex ? "✓ " : ""}
              {s.label}
            </li>
          ))}
        </ol>
        <div className="flex gap-6 font-mono text-[11px] text-white/60">
          <span>{elapsed}</span>
          <span>
            ${run.spent.toFixed(3)}
            {run.cap ? ` / $${run.cap.toFixed(2)}` : ""}
          </span>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1.7fr_1fr]">
        <div className="relative px-2 py-4 sm:px-6">
          <p className="absolute left-6 top-5 max-w-[60%] font-display text-lg leading-snug text-white/90 sm:left-8">
            {topic}
          </p>
          <SonarMap run={run} />
        </div>

        <div className="border-t border-white/10 px-6 py-5 xl:border-l xl:border-t-0">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
            Agents
          </h3>
          <ul className="mt-3 space-y-3">
            {run.agents.map((a) => (
              <li key={a.query} className="flex items-start justify-between gap-3 text-sm">
                <span className={a.status === "queued" ? "text-white/40" : "text-white/85"}>
                  {a.query}
                </span>
                <span
                  className={`shrink-0 font-mono text-[10.5px] uppercase tracking-wider ${
                    a.status === "done"
                      ? "text-[#4fd1c5]"
                      : a.status === "error"
                        ? "text-white/40"
                        : a.status === "queued"
                          ? "text-white/30"
                          : "text-buoy"
                  }`}
                >
                  {a.status === "done" ? `${a.findings} facts` : STATUS_LABEL[a.status]}
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mt-7 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
            Sources found · {sources.length}
          </h3>
          <ul className="mt-3 space-y-1.5 font-mono text-[12px] text-white/60">
            <AnimatePresence initial={false}>
              {recent.map((s) => (
                <motion.li
                  key={s.url}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="truncate"
                >
                  {domain(s.url)}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </section>
  );
}
