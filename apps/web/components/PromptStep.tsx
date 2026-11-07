"use client";

import { useState } from "react";

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
      <h1 className="gradient-text whitespace-nowrap text-center font-display text-[clamp(1.5rem,7vw,3.25rem)] font-semibold leading-[1.25] tracking-tight pb-[0.25em]">
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
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="What do you want to understand?"
            className="w-full resize-none rounded-[3px] bg-transparent px-4 pt-3.5 text-lg leading-relaxed outline-none placeholder:text-slate/60"
          />
          <div className="flex items-center justify-between px-3 pb-1.5 pt-1">
            <span className="pl-1 font-mono text-[11px] text-slate/70">{topic.length}/300</span>
            <button
              type="submit"
              disabled={!valid}
              aria-label="Send"
              className="grid h-10 w-10 place-items-center rounded-full bg-buoy text-white transition-colors hover:bg-[#e84d22] disabled:cursor-not-allowed disabled:bg-buoy/35"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
