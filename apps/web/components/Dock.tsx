"use client";

import { useState } from "react";

export function Dock({
  running,
  onStop,
  onSubmit,
}: {
  running: boolean;
  onStop: () => void;
  onSubmit: (topic: string) => void;
}) {
  const [text, setText] = useState("");
  const valid = text.trim().length >= 3;

  const send = () => {
    if (!valid) return;
    onSubmit(text.trim());
    setText("");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-6 pb-6 pt-12">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        {running ? (
          <div className="flex items-center justify-between gap-4 rounded-[4px] border border-ink/15 bg-paper-deep/90 backdrop-blur-md px-5 py-2.5">
            <span className="text-sm text-slate">Researching. You can stop at any time.</span>
            <button
              type="button"
              onClick={onStop}
              className="shrink-0 rounded-[1px] border border-ink/25 px-4 py-1.5 text-sm transition-colors hover:border-buoy hover:text-buoy"
            >
              Stop
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-3 rounded-[4px] border border-ink/15 bg-paper-deep/90 backdrop-blur-md py-1.5 pl-5 pr-1.5 transition-colors focus-within:border-ink/40"
          >
            <label htmlFor="dock" className="sr-only">
              Research something else
            </label>
            <input
              id="dock"
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              placeholder="Research something else"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate/70"
            />
            <button
              type="submit"
              disabled={!valid}
              className="rounded-[1px] bg-buoy px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e84d22] disabled:bg-mist disabled:text-slate"
            >
              Plan it
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
