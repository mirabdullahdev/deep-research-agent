"use client";

import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { ActivityCard } from "@/components/ActivityCard";
import { Dock } from "@/components/Dock";
import { PlanCard } from "@/components/PlanCard";
import { PromptStep } from "@/components/PromptStep";
import { useResearch } from "@/lib/useResearch";

const loadReport = () => import("@/components/ReportView");
const ReportView = dynamic(() => loadReport().then((mod) => mod.ReportView), { ssr: false });

function Pulse({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-buoy opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-buoy" />
      </span>
      <p className="font-display text-lg font-medium">{label}</p>
    </div>
  );
}

export default function Home() {
  const r = useResearch();
  const inThread = r.phase !== "ask";
  const finished = r.outcome !== null;
  const running = r.phase === "research" || (r.phase === "report" && !finished && !r.stopped);
  const streaming = r.phase === "report" && !finished && !r.stopped;

  useEffect(() => {
    if (r.phase === "ask") window.scrollTo({ top: 0 });
    if (r.phase === "research") void loadReport();
  }, [r.phase]);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
      <div className="relative min-h-screen overflow-x-clip">
        <AnimatePresence mode="wait">
          {!inThread ? (
            <m.main
              key="landing"
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 mx-auto max-w-2xl px-6 pb-24 pt-14 lg:pt-24"
            >
              <PromptStep initial={r.topic} onSubmit={r.submit} />
            </m.main>
          ) : (
            <m.main
              key="thread"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 mx-auto max-w-3xl px-6 pb-40 pt-10"
            >
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-[4px] bg-paper/70 backdrop-blur-md px-5 py-3 text-[16.5px] leading-relaxed">
                  {r.topic}
                </p>
              </div>

              <div className="mt-8 space-y-6">
                {r.phase === "drafting" && <Pulse label="Drafting a research plan" />}

                {r.phase === "reply" && (
                  <p className="max-w-[85%] rounded-[4px] border border-ink/10 bg-paper/70 px-5 py-3 text-[16.5px] leading-relaxed backdrop-blur-md">
                    {r.reply}
                  </p>
                )}

                {r.plan.length > 0 && (
                  <PlanCard initial={r.plan} locked={r.approved} onApprove={r.approve} />
                )}

                {r.run && r.approved && (
                  <ActivityCard
                    run={r.run}
                    running={running}
                    reportStarted={r.phase === "report"}
                    stopped={r.stopped}
                    outcome={r.outcome}
                  />
                )}

                {r.report && (
                  <ReportView
                    topic={r.topic}
                    report={r.report}
                    sources={r.sources}
                    streaming={streaming}
                    stopped={r.stopped}
                  />
                )}

                {r.phase === "error" && r.errorCode && (
                  <div
                    role="status"
                    className="rounded-[4px] border border-ink/15 bg-paper/70 p-5 backdrop-blur-md"
                  >
                    <p className="font-display text-lg font-semibold">
                      {r.errorCode === "used" ? "Testing complete" : "Demo unavailable"}
                    </p>
                    <p className="mt-1 text-slate">{r.error}</p>
                  </div>
                )}

                {r.phase === "error" && !r.errorCode && (
                  <div role="alert" className="rounded-[4px] border border-buoy/40 bg-buoy/[0.07] p-5">
                    <p className="font-display text-lg font-semibold">The run stopped</p>
                    <p className="mt-1 text-slate">{r.error}</p>
                    <button
                      onClick={r.retry}
                      className="mt-4 rounded-[1px] bg-ink px-5 py-2 text-sm text-paper transition-colors hover:bg-buoy hover:text-white"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            </m.main>
          )}
        </AnimatePresence>

        {inThread && (running || ["report", "reply"].includes(r.phase) || (r.phase === "error" && !r.errorCode)) && (
          <Dock running={running} onStop={r.stop} onSubmit={r.submit} />
        )}
      </div>
      </LazyMotion>
    </MotionConfig>
  );
}
