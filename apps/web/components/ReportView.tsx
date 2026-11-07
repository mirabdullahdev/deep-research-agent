"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SourceRef } from "@/lib/types";
import { domain } from "./ActivityCard";

const withCitations = (md: string) => md.replace(/\[(\d+)\]/g, "[$1](#src-$1)");

function toMarkdown(topic: string, report: string, sources: SourceRef[]) {
  const list = sources.map((s) => `${s.n}. [${s.title}](${s.url})`).join("\n");
  return `# ${topic}\n\n${report}\n\n## Sources\n\n${list}\n`;
}

export function ReportView({
  topic,
  report,
  sources,
  followUps,
  streaming,
  stopped,
  onFollowUp,
}: {
  topic: string;
  report: string;
  sources: SourceRef[];
  followUps: string[];
  streaming: boolean;
  stopped: boolean;
  onFollowUp: (q: string) => void;
}) {
  const [copied, setCopied] = useState(false);

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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="mb-3 mt-8 font-display text-2xl font-semibold tracking-tight">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="mb-3 mt-10 font-display text-xl font-semibold tracking-tight">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-2 mt-6 font-display text-lg font-semibold">{children}</h4>
          ),
          p: ({ children }) => <p className="my-4 text-[16.5px] leading-[1.75]">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-5 text-[16.5px] leading-[1.7] marker:text-buoy">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-5 text-[16.5px] leading-[1.7]">
              {children}
            </ol>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) =>
            href?.startsWith("#src-") ? (
              <a
                href={href}
                className="mx-[1px] inline-block -translate-y-[2px] rounded-[5px] bg-buoy/15 px-1.5 py-[1px] align-baseline font-mono text-[11px] font-medium text-buoy no-underline transition-colors hover:bg-buoy hover:text-white"
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
      {stopped && (
        <p className="mt-4 font-mono text-[12px] text-slate">
          Stopped early. This report is incomplete.
        </p>
      )}

      {!streaming && (
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <button
            onClick={copy}
            className="rounded-[1px] border border-ink/20 px-4 py-1.5 transition-colors hover:border-ink"
          >
            {copied ? "Copied" : "Copy Markdown"}
          </button>
          <button
            onClick={download}
            className="rounded-[1px] border border-ink/20 px-4 py-1.5 transition-colors hover:border-ink"
          >
            Download .md
          </button>
        </div>
      )}

      {sources.length > 0 && (
        <section className="mt-10 border-t border-ink/10 pt-6">
          <h3 className="font-display text-lg font-semibold">Sources</h3>
          <ol className="mt-4 space-y-3">
            {sources.map((s) => (
              <li
                key={s.n}
                id={`src-${s.n}`}
                className="src-target flex scroll-mt-8 gap-3 rounded-sm text-sm"
              >
                <span className="mt-0.5 w-5 shrink-0 font-mono text-[11px] text-buoy">{s.n}</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 hover:text-buoy"
                >
                  <span className="block font-medium leading-snug">{s.title}</span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-slate">
                    {domain(s.url)}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {followUps.length > 0 && !streaming && (
        <section className="mt-10 border-t border-ink/10 pt-6">
          <h3 className="font-display text-lg font-semibold">Keep digging</h3>
          <ul className="mt-3 space-y-2">
            {followUps.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onFollowUp(q)}
                  className="group text-left leading-snug text-ink/85 transition-colors hover:text-buoy"
                >
                  {q}{" "}
                  <span
                    aria-hidden
                    className="inline-block transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
