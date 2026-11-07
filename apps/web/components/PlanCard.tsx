"use client";

import { useRef, useState } from "react";
import { DEPTHS, EXTRA_SEARCHES } from "@/lib/depths";
import type { Depth, SearchItem } from "@/lib/types";

interface Row extends SearchItem {
  id: number;
}

export function PlanCard({
  depth,
  initial,
  locked,
  onApprove,
}: {
  depth: Depth;
  initial: SearchItem[];
  locked: boolean;
  onApprove: (plan: SearchItem[]) => void;
}) {
  const nextId = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((s, i) => ({ ...s, id: i })));
  const [expanded, setExpanded] = useState(false);
  const open = locked ? expanded : true;
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
    <section className="rounded-2xl border border-ink/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        aria-expanded={open}
        disabled={!locked}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left disabled:cursor-default"
      >
        <span className="font-display text-lg font-semibold">
          {locked ? "Research plan" : "Here is the plan"}
        </span>
        <span className="flex items-center gap-3 font-mono text-[11px] text-slate">
          {rows.length} searches
          {locked && (
            <span aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
              ▾
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {!locked && (
            <p className="mb-2 max-w-xl text-sm text-slate">
              Searches run in parallel. Edit the wording, remove any you do not need, or add your
              own. Your version is used as written.
            </p>
          )}

          <ul className="divide-y divide-ink/10 border-y border-ink/10">
            {rows.map((r, i) => (
              <li key={r.id} className="flex gap-3 py-4">
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full border border-buoy"
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`s${r.id}`} className="sr-only">
                    Search {i + 1}
                  </label>
                  <input
                    id={`s${r.id}`}
                    value={r.query}
                    maxLength={160}
                    readOnly={locked}
                    placeholder="What should be searched?"
                    onChange={(e) => update(r.id, { query: e.target.value })}
                    className="w-full border-0 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-slate/60"
                  />
                  <label htmlFor={`r${r.id}`} className="sr-only">
                    Why search {i + 1} matters
                  </label>
                  <textarea
                    id={`r${r.id}`}
                    value={r.reason}
                    rows={2}
                    maxLength={300}
                    readOnly={locked}
                    onChange={(e) => update(r.id, { reason: e.target.value })}
                    className="mt-0.5 w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-slate outline-none"
                  />
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label={`Remove search ${i + 1}`}
                    className="h-8 w-8 shrink-0 rounded-full text-slate transition-colors hover:bg-ink/5 hover:text-buoy"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!locked && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={!valid}
                  onClick={() =>
                    onApprove(rows.map((r) => ({ query: r.query.trim(), reason: r.reason.trim() })))
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-buoy px-6 py-2.5 font-medium text-white transition-all hover:bg-[#e84d22] disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate"
                >
                  {edited ? "Start with my edits" : "Start research"} <span aria-hidden>→</span>
                </button>
                <button
                  type="button"
                  onClick={add}
                  disabled={rows.length >= limit}
                  className="rounded-full border border-ink/20 px-4 py-2 text-sm transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Add a search
                </button>
              </div>
              <span className="font-mono text-[11px] text-slate">
                {rows.length} of {limit} · takes {info.time}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
