"use client";

import { useState } from "react";
import type { Answer, ClarifyQuestion } from "@/lib/types";

export function ClarifyStep({
  topic,
  questions,
  onSubmit,
}: {
  topic: string;
  questions: ClarifyQuestion[];
  onSubmit: (answers: Answer[]) => void;
}) {
  const [values, setValues] = useState<string[]>(() => questions.map(() => ""));

  const set = (i: number, v: string) => setValues((cur) => cur.map((c, j) => (j === i ? v : c)));
  const collect = () =>
    questions
      .map((q, i) => ({ question: q.question, answer: values[i].trim() }))
      .filter((a) => a.answer);

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-kelp">
        Before we start
      </p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        A few details will make this research sharper.
      </h2>
      <p className="mt-3 max-w-xl text-slate">
        Topic: <span className="text-ink">{topic}</span>. Answer what matters and skip the rest.
      </p>

      <form
        className="mt-10 space-y-9"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(collect());
        }}
      >
        {questions.map((q, i) => (
          <div key={q.question}>
            <label htmlFor={`q${i}`} className="block text-lg font-medium">
              {q.question}
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={values[i] === s}
                  onClick={() => set(i, values[i] === s ? "" : s)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    values[i] === s
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/20 bg-white/60 hover:border-ink/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              id={`q${i}`}
              value={values[i]}
              maxLength={300}
              onChange={(e) => set(i, e.target.value)}
              placeholder="Or write your own answer"
              className="mt-3 w-full border-0 border-b border-ink/20 bg-transparent py-2 text-base outline-none transition-colors placeholder:text-slate/60 focus:border-ink"
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-5 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-3 rounded-full bg-buoy px-7 py-3.5 font-medium text-white transition-all hover:bg-[#e84d22] hover:shadow-[0_10px_30px_-10px_rgba(255,91,46,0.7)]"
          >
            Draft the plan <span aria-hidden>→</span>
          </button>
          <button
            type="button"
            onClick={() => onSubmit([])}
            className="text-slate underline decoration-mist decoration-2 underline-offset-4 hover:text-ink"
          >
            Skip these questions
          </button>
        </div>
      </form>
    </section>
  );
}
