"use client";

import { useState } from "react";
import { DEPTHS } from "@/lib/depths";
import type { Depth } from "@/lib/types";

const EXAMPLES = [
  "How close are solid-state batteries to reaching consumers?",
  "What actually causes inflation to come back after a rate cut?",
  "Is intermittent fasting backed by good evidence?",
];

function Gauge({ filled }: { filled: number }) {
  return (
    <span aria-hidden className="flex flex-col gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-[3px] rounded-full ${i < filled ? "w-6 bg-buoy" : "w-6 bg-mist"}`}
        />
      ))}
    </span>
  );
}

export function PromptStep({
  initial = "",
  onSubmit,
}: {
  initial?: string;
  onSubmit: (topic: string, depth: Depth) => void;
}) {
  const [topic, setTopic] = useState(initial);
  const [depth, setDepth] = useState<Depth>("standard");
  const valid = topic.trim().length >= 3;

  const submit = () => valid && onSubmit(topic.trim(), depth);

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-kelp">
        Multi-agent research
      </p>
      <h1 className="mt-4 max-w-[16ch] font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
        Ask something worth digging into.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate">
        Fathom agrees a plan with you, sends agents to read the web in parallel, and returns a
        report where every claim links to its source.
      </p>

      <form
        className="mt-10"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-2xl border border-ink/15 bg-white/70 p-1.5 shadow-[0_1px_0_rgba(14,34,54,0.04),0_18px_40px_-24px_rgba(14,34,54,0.35)] transition-shadow focus-within:border-ink/40">
          <label htmlFor="topic" className="sr-only">
            Research topic
          </label>
          <textarea
            id="topic"
            value={topic}
            maxLength={300}
            rows={3}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="What do you want to understand?"
            className="w-full resize-none rounded-xl bg-transparent px-4 pt-3.5 text-lg leading-relaxed outline-none placeholder:text-slate/60"
          />
          <div className="flex items-center justify-between px-4 pb-2.5 pt-1">
            <span className="font-mono text-[11px] text-slate/70">{topic.length}/300</span>
            <span className="hidden font-mono text-[11px] text-slate/70 sm:inline">
              Ctrl + Enter to continue
            </span>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
            Depth
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(Object.keys(DEPTHS) as Depth[]).map((key, i) => {
              const d = DEPTHS[key];
              const selected = depth === key;
              return (
                <label
                  key={key}
                  className={`group cursor-pointer rounded-xl border p-4 transition-all duration-300 ${
                    selected
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/15 bg-white/50 hover:border-ink/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="depth"
                    value={key}
                    checked={selected}
                    onChange={() => setDepth(key)}
                    className="sr-only"
                  />
                  <span className="flex items-start justify-between">
                    <span className="font-display text-xl font-semibold">{d.label}</span>
                    <Gauge filled={i + 1} />
                  </span>
                  <span
                    className={`mt-1 block text-sm ${selected ? "text-paper/70" : "text-slate"}`}
                  >
                    {d.blurb}
                  </span>
                  <span
                    className={`mt-3 block font-mono text-[11px] ${
                      selected ? "text-buoy" : "text-kelp"
                    }`}
                  >
                    {d.searches} searches · {d.time}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={!valid}
          className="mt-8 inline-flex items-center gap-3 rounded-full bg-buoy px-7 py-3.5 font-medium text-white transition-all hover:bg-[#e84d22] hover:shadow-[0_10px_30px_-10px_rgba(255,91,46,0.7)] disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate disabled:shadow-none"
        >
          Plan this research
          <span aria-hidden>→</span>
        </button>
      </form>

      <div className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">Try one</p>
        <ul className="mt-3 space-y-1.5">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => setTopic(ex)}
                className="text-left text-ink/80 underline decoration-mist decoration-2 underline-offset-4 transition-colors hover:text-buoy hover:decoration-buoy"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
