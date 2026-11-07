"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect } from "react";
import { ClarifyStep } from "@/components/ClarifyStep";
import { Contours } from "@/components/Contours";
import { PlanStep } from "@/components/PlanStep";
import { PromptStep } from "@/components/PromptStep";
import { Rail } from "@/components/Rail";
import { ReportView } from "@/components/ReportView";
import { ResearchStage } from "@/components/ResearchStage";
import { useResearch } from "@/lib/useResearch";

function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] flex-col justify-center">
      <div className="flex items-center gap-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-buoy opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-buoy" />
        </span>
        <p className="font-display text-2xl font-medium">{label}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const r = useResearch();
  const wide = r.phase === "research" || r.phase === "report";

  useEffect(() => {
    if (r.phase !== "report") window.scrollTo({ top: 0 });
  }, [r.phase]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip">
        <Contours className="absolute -right-48 -top-40 w-[1100px] text-kelp/25 sm:-right-24" />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-7">
          <button
            onClick={r.reset}
            className="font-display text-2xl font-semibold tracking-tight"
            aria-label="Fathom, start over"
          >
            Fathom<span className="text-buoy">.</span>
          </button>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-slate sm:block">
            Deep research, charted
          </span>
        </header>

        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-6 pb-24 pt-10 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-12 lg:pt-16">
          <div className="min-w-0 overflow-x-auto [scrollbar-width:none] lg:overflow-visible lg:pt-3">
            <Rail phase={r.phase} loading={r.phase === "loading"} />
          </div>

          <main className={wide ? "min-w-0" : "min-w-0 max-w-2xl"}>
            <AnimatePresence mode="wait">
              <motion.div
                key={r.phase === "report" ? "report" : r.phase}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {r.phase === "ask" && <PromptStep initial={r.topic} onSubmit={r.submit} />}
                {r.phase === "loading" && <Loading label={r.loadingLabel} />}
                {r.phase === "clarify" && (
                  <ClarifyStep topic={r.topic} questions={r.questions} onSubmit={r.answer} />
                )}
                {r.phase === "plan" && (
                  <PlanStep
                    depth={r.depth}
                    initial={r.plan}
                    onApprove={r.approve}
                    onRestart={r.reset}
                  />
                )}
                {r.phase === "research" && r.run && (
                  <ResearchStage run={r.run} topic={r.topic} />
                )}
                {r.phase === "report" && (
                  <ReportView
                    topic={r.topic}
                    depth={r.depth}
                    report={r.report}
                    sources={r.sources}
                    followUps={r.followUps}
                    outcome={r.outcome}
                    onFollowUp={(q) => r.submit(q, r.depth)}
                    onReset={r.reset}
                  />
                )}
                {r.phase === "error" && (
                  <div role="alert" className="max-w-xl">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-buoy">
                      Something stopped the run
                    </p>
                    <p className="mt-3 font-display text-3xl font-semibold leading-tight">
                      {r.error}
                    </p>
                    <button
                      onClick={r.reset}
                      className="mt-8 rounded-full bg-ink px-6 py-3 text-paper transition-colors hover:bg-buoy"
                    >
                      Start over
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-10 font-mono text-[11px] text-slate/80">
          Reports can contain mistakes. Check the cited sources before relying on them.
        </footer>
      </div>
    </MotionConfig>
  );
}
