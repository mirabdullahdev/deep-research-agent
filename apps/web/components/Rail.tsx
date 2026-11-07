import type { Phase } from "@/lib/useResearch";

const STEPS = ["Ask", "Clarify", "Plan", "Research", "Report"];

const INDEX: Record<Phase, number> = {
  ask: 0,
  loading: 0,
  clarify: 1,
  plan: 2,
  research: 3,
  report: 4,
  error: 0,
};

export function Rail({ phase, loading }: { phase: Phase; loading: boolean }) {
  const active = loading ? Math.max(INDEX[phase], 1) : INDEX[phase];
  return (
    <nav aria-label="Progress" className="font-mono text-[11px] uppercase tracking-[0.14em]">
      <ol className="flex gap-5 lg:flex-col lg:gap-0">
        {STEPS.map((label, i) => {
          const state = i < active ? "done" : i === active ? "active" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "active" ? "step" : undefined}
              className="relative flex items-center gap-3 lg:pb-9 lg:last:pb-0"
            >
              <span
                className={[
                  "relative z-10 h-2.5 w-2.5 shrink-0 rounded-full border transition-colors duration-500",
                  state === "active" && "border-buoy bg-buoy shadow-[0_0_0_5px_rgba(255,91,46,0.18)]",
                  state === "done" && "border-ink bg-ink",
                  state === "todo" && "border-slate/50 bg-paper",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              {i < STEPS.length - 1 && (
                <span
                  className={`absolute left-[4.5px] top-3 hidden h-full w-px lg:block ${
                    i < active ? "bg-ink" : "bg-mist"
                  }`}
                />
              )}
              <span
                className={
                  state === "active" ? "text-ink" : state === "done" ? "text-ink/70" : "text-slate/70"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
