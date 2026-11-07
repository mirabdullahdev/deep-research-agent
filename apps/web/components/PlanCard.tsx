"use client";

import { AnimatePresence, m } from "framer-motion";
import { useRef, useState } from "react";

const MAX_STEPS = 7;

interface Row {
  id: number;
  text: string;
}

export function PlanCard({
  initial,
  locked,
  onApprove,
}: {
  initial: string[];
  locked: boolean;
  onApprove: (steps: string[]) => void;
}) {
  const nextId = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((text, id) => ({ id, text })));
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const open = locked ? expanded : true;
  const edit = editing && !locked;

  const update = (id: number, text: string) =>
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, text } : r)));
  const remove = (id: number) => setRows((cur) => cur.filter((r) => r.id !== id));
  const add = () => setRows((cur) => [...cur, { id: nextId.current++, text: "" }]);

  const valid =
    rows.length > 0 && rows.every((r) => r.text.trim().length >= 3 && r.text.trim().length <= 200);

  return (
    <section className="rounded-[4px] border border-ink/10 bg-paper text-ink sheet">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        aria-expanded={open}
        disabled={!locked}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left disabled:cursor-default"
      >
        <span className="font-display text-lg font-semibold">Research plan</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
        <div className="px-5 pb-5">
          <ol className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-start gap-3">
                <span className="w-6 shrink-0 font-display text-base leading-relaxed text-slate">
                  {i + 1}.
                </span>
                {edit ? (
                  <>
                    <label htmlFor={`step${r.id}`} className="sr-only">
                      Step {i + 1}
                    </label>
                    <textarea
                      id={`step${r.id}`}
                      value={r.text}
                      rows={2}
                      maxLength={200}
                      onChange={(e) => update(r.id, e.target.value.replace(/\s*\n\s*/g, " "))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      placeholder="Describe a step"
                      className="field-sizing-content min-w-0 flex-1 resize-none border-0 border-b border-ink/20 bg-transparent pb-1 font-display text-base font-normal leading-relaxed outline-none transition-colors focus:border-ink"
                    />
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label={`Remove step ${i + 1}`}
                      className="h-7 w-7 shrink-0 rounded-[1px] text-slate transition-colors hover:bg-ink/5 hover:text-buoy"
                    >
                      <span aria-hidden className="text-lg leading-none">
                        ×
                      </span>
                    </button>
                  </>
                ) : (
                  <p className="font-display text-base font-normal leading-relaxed">{r.text}</p>
                )}
              </li>
            ))}
          </ol>

          {!locked && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!valid}
                onClick={() => onApprove(rows.map((r) => r.text.trim()))}
                className="inline-flex items-center gap-2 rounded-[1px] bg-buoy px-6 py-2.5 font-medium text-white transition-colors hover:bg-[#e84d22] disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate"
              >
                Start research
              </button>
              <button
                type="button"
                onClick={() => setEditing((e) => !e)}
                className="rounded-[1px] border border-ink/20 px-5 py-2.5 text-sm transition-colors hover:border-ink"
              >
                {edit ? "Done editing" : "Edit plan"}
              </button>
              {edit && rows.length < MAX_STEPS && (
                <button
                  type="button"
                  onClick={add}
                  className="rounded-[1px] border border-ink/20 px-4 py-2.5 text-sm transition-colors hover:border-ink"
                >
                  + Add a step
                </button>
              )}
            </div>
          )}
        </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
