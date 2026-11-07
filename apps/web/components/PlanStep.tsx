"use client";

import { useRef, useState } from "react";
import { DEPTHS, EXTRA_SEARCHES } from "@/lib/depths";
import type { Depth, SearchItem } from "@/lib/types";

interface Row extends SearchItem {
  id: number;
}

export function PlanStep({
  depth,
  initial,
  onApprove,
  onRestart,
}: {
  depth: Depth;
  initial: SearchItem[];
  onApprove: (plan: SearchItem[]) => void;
  onRestart: () => void;
}) {
  const nextId = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((s, i) => ({ ...s, id: i })));
  const info = DEPTHS[depth];
  const limit = info.searches + EXTRA_SEARCHES;

  const update = (id: number, patch: Partial<SearchItem>) =>
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((cur) => cur.filter((r) => r.id !== id));
  const add = () =>
    setRows((cur) => [...cur, { id: nextId.current++, query: "", reason: "Added by you" }]);

  const valid =
    rows.length > 0 && rows.every((r) => r.query.trim().length >= 3 && r.query.trim().length <= 160);
  const edited =
    rows.length !== initial.length || rows.some((r, i) => r.query !== initial[i]?.query);

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-kelp">
        Research plan · {info.label}
      </p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Here is how I would research this. Change anything.
      </h2>
      <p className="mt-3 max-w-xl text-slate">
        Each search runs in parallel. Edit the wording, remove what you do not need, or add your
        own. Your version is used exactly as written.
      </p>

      <ul className="mt-9 divide-y divide-ink/10 border-y border-ink/10">
        {rows.map((r, i) => (
          <li key={r.id} className="group flex gap-4 py-5">
            <span
              aria-hidden
              className="mt-2 h-2 w-2 shrink-0 rounded-full border border-buoy bg-paper"
            />
            <div className="min-w-0 flex-1">
              <label htmlFor={`s${r.id}`} className="sr-only">
                Search {i + 1}
              </label>
              <input
                id={`s${r.id}`}
                value={r.query}
                maxLength={160}
                placeholder="What should be searched?"
                onChange={(e) => update(r.id, { query: e.target.value })}
                className="w-full border-0 bg-transparent text-lg font-medium outline-none placeholder:font-normal placeholder:text-slate/60"
              />
              <label htmlFor={`r${r.id}`} className="sr-only">
                Why search {i + 1} matters
              </label>
              <textarea
                id={`r${r.id}`}
                value={r.reason}
                rows={2}
                maxLength={300}
                onChange={(e) => update(r.id, { reason: e.target.value })}
                className="mt-1 w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-slate outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(r.id)}
              aria-label={`Remove search ${i + 1}`}
              className="mt-1 h-8 w-8 shrink-0 rounded-full text-slate transition-colors hover:bg-ink/5 hover:text-buoy"
            >
              <span aria-hidden className="text-xl leading-none">
                ×
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= limit}
          className="rounded-full border border-ink/20 px-4 py-1.5 text-sm transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add a search
        </button>
        <span className="font-mono text-[11px] text-slate">
          {rows.length} of {limit} searches
        </span>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onApprove(rows.map((r) => ({ query: r.query.trim(), reason: r.reason.trim() })))
          }
          className="inline-flex items-center gap-3 rounded-full bg-buoy px-7 py-3.5 font-medium text-white transition-all hover:bg-[#e84d22] hover:shadow-[0_10px_30px_-10px_rgba(255,91,46,0.7)] disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate disabled:shadow-none"
        >
          {edited ? "Run my version" : "Approve and run"} <span aria-hidden>→</span>
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="text-slate underline decoration-mist decoration-2 underline-offset-4 hover:text-ink"
        >
          Start over
        </button>
        <span className="font-mono text-[11px] text-slate">Takes {info.time}</span>
      </div>
    </section>
  );
}
