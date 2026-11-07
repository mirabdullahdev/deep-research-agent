"use client";

import { useState } from "react";

const EXAMPLES = [
  "How close are solid-state batteries to reaching consumers?",
  "What actually causes inflation to come back after a rate cut?",
  "Is intermittent fasting backed by good evidence?",
];

export function PromptStep({
  initial = "",
  onSubmit,
}: {
  initial?: string;
  onSubmit: (topic: string) => void;
}) {
  const [topic, setTopic] = useState(initial);
  const valid = topic.trim().length >= 3;

  const submit = () => valid && onSubmit(topic.trim());

  return (
    <section>
      <h1 className="gradient-text text-balance text-center font-display text-5xl font-semibold leading-[1.25] tracking-tight pb-[0.25em] sm:text-6xl">
        Deep Research Agent
      </h1>

      <form
        className="mt-12"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-[4px] border border-ink/15 bg-paper/60 p-1.5 backdrop-blur-md shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)] transition-colors focus-within:border-ink/40">
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
            className="w-full resize-none rounded-[3px] bg-transparent px-4 pt-3.5 text-lg leading-relaxed outline-none placeholder:text-slate/60"
          />
          <div className="flex items-center justify-between px-4 pb-2.5 pt-1">
            <span className="font-mono text-[11px] text-slate/70">{topic.length}/300</span>
            <span className="hidden font-mono text-[11px] text-slate/70 sm:inline">
              Ctrl + Enter to continue
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="mt-6 inline-flex items-center gap-3 rounded-[1px] bg-buoy px-7 py-3.5 font-medium text-white transition-all hover:bg-[#e84d22] hover:shadow-[0_10px_30px_-10px_rgba(255,91,46,0.7)] disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate disabled:shadow-none"
        >
          Plan this research
          <span aria-hidden>→</span>
        </button>
      </form>

      <ul className="mt-12 space-y-1.5">
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
    </section>
  );
}
