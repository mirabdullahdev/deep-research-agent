"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { DEPTHS } from "@/lib/depths";
import type { Depth, SourceRef } from "@/lib/types";
import type { Outcome } from "@/lib/useResearch";

function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const withCitations = (md: string) => md.replace(/\[(\d+)\]/g, "[$1](#src-$1)");

function toMarkdown(topic: string, report: string, sources: SourceRef[]) {
  const list = sources.map((s) => `${s.n}. [${s.title}](${s.url})`).join("\n");
  return `# ${topic}\n\n${report}\n\n## Sources\n\n${list}\n`;
}

export function ReportView({
  topic,
  depth,
  report,
  sources,
  followUps,
  outcome,
  onFollowUp,
  onReset,
}: {
  topic: string;
  depth: Depth;
  report: string;
  sources: SourceRef[];
  followUps: string[];
  outcome: Outcome | null;
  onFollowUp: (q: string) => void;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const streaming = outcome === null;

  const copy = async () => {
    await navigator.clipboard.writeText(toMarkdown(topic, report, sources));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([toMarkdown(topic, report, sources)], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.slice(0, 48).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-kelp">
        Report · {DEPTHS[depth].label}
        {streaming && <span className="text-buoy"> · writing</span>}
      </p>
      <h2 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
        {topic}
      </h2>

      {outcome && (
        <p className="mt-5 font-mono text-[11px] text-slate">
          {sources.length} sources · {Math.round(outcome.elapsedMs / 1000)}s · $
          {outcome.spent.toFixed(3)} · {outcome.tokens.toLocaleString()} tokens
        </p>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <div className="max-w-[68ch]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => (
                  <h3 className="mb-3 mt-11 font-display text-2xl font-semibold tracking-tight">
                    {children}
                  </h3>
                ),
                h3: ({ children }) => (
                  <h4 className="mb-2 mt-7 font-display text-lg font-semibold">{children}</h4>
                ),
                p: ({ children }) => <p className="my-4 text-[17px] leading-[1.75]">{children}</p>,
                ul: ({ children }) => (
                  <ul className="my-4 list-disc space-y-2 pl-5 text-[17px] leading-[1.7] marker:text-buoy">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-4 list-decimal space-y-2 pl-5 text-[17px] leading-[1.7]">
                    {children}
                  </ol>
                ),
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                a: ({ href, children }) =>
                  href?.startsWith("#src-") ? (
                    <a
                      href={href}
                      className="mx-[1px] inline-block -translate-y-[2px] rounded-[5px] bg-buoy/12 px-1.5 py-[1px] align-baseline font-mono text-[11px] font-medium text-buoy no-underline transition-colors hover:bg-buoy hover:text-white"
                    >
                      {children}
                    </a>
                  ) : (
                    <a href={href} className="underline decoration-buoy underline-offset-4">
                      {children}
                    </a>
                  ),
              }}
            >
              {withCitations(report)}
            </ReactMarkdown>
            {streaming && <span className="cursor" aria-hidden />}
          </div>

          {followUps.length > 0 && (
            <div className="mt-14 max-w-[68ch] border-t border-ink/10 pt-8">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                Keep digging
              </h3>
              <ul className="mt-4 space-y-2">
                {followUps.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => onFollowUp(q)}
                      className="group text-left text-lg leading-snug transition-colors hover:text-buoy"
                    >
                      {q}{" "}
                      <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          {sources.length > 0 && (
            <>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate">
                Sources
              </h3>
              <ol className="mt-4 space-y-4">
                {sources.map((s) => (
                  <li
                    key={s.n}
                    id={`src-${s.n}`}
                    className="src-target flex scroll-mt-8 gap-3 rounded-sm text-sm"
                  >
                    <span className="mt-0.5 font-mono text-[11px] text-buoy">{s.n}</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 hover:text-buoy"
                    >
                      <span className="line-clamp-2 font-medium leading-snug">{s.title}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-slate">
                        {domain(s.url)}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </>
          )}
          {!streaming && (
            <div className="mt-8 flex flex-wrap gap-2 border-t border-ink/10 pt-6 text-sm">
              <button
                onClick={copy}
                className="rounded-full border border-ink/20 px-4 py-1.5 transition-colors hover:border-ink"
              >
                {copied ? "Copied" : "Copy Markdown"}
              </button>
              <button
                onClick={download}
                className="rounded-full border border-ink/20 px-4 py-1.5 transition-colors hover:border-ink"
              >
                Download .md
              </button>
              <button
                onClick={onReset}
                className="rounded-full bg-ink px-4 py-1.5 text-paper transition-colors hover:bg-buoy"
              >
                New research
              </button>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
