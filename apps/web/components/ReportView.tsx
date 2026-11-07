"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SourceRef } from "@/lib/types";
import { domain } from "./ActivityCard";

const tidy = (md: string) =>
  md
    .replace(/[ \t]*(?:\[\d+\])+/g, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/,\s*,/g, ",");

function forDisplay(md: string, streaming: boolean) {
  const text = tidy(md);
  if (!streaming) return text;
  const blocks = text.replace(/\s*\[\d*$/, "").split(/\n{2,}/);
  if (blocks[blocks.length - 1].trimStart().startsWith("|")) blocks.pop();
  return blocks.join("\n\n");
}

function toMarkdown(report: string, sources: SourceRef[]) {
  const list = sources.map((s) => `${s.n}. [${s.title}](${s.url})`).join("\n");
  const body = tidy(report);
  return list ? `${body}\n\n## References\n\n${list}\n` : `${body}\n`;
}

export function ReportView({
  topic,
  report,
  sources,
  streaming,
  stopped,
}: {
  topic: string;
  report: string;
  sources: SourceRef[];
  streaming: boolean;
  stopped: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(report, sources));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([toMarkdown(report, sources)], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.slice(0, 48).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "report"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[4px] bg-paper px-5 py-8 text-ink shadow-[0_30px_70px_-35px_rgba(0,0,0,0.85)] [--ink:#1c1733] [--mist:#d8d1ee] [--paper:#f3effd] [--slate:#6c6786] sm:px-10 sm:py-12"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="mb-6 font-display text-3xl font-semibold leading-tight tracking-tight">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="mb-3 mt-12 border-t border-ink/10 pt-8 font-display text-xl font-semibold tracking-tight">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-2 mt-8 font-display text-lg font-semibold">{children}</h4>
          ),
          p: ({ children }) => <p className="my-5 text-[16.5px] leading-[1.8]">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-5 list-disc space-y-2 pl-6 text-[16.5px] leading-[1.75] marker:text-buoy">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-5 list-decimal space-y-2 pl-6 text-[16.5px] leading-[1.75]">
              {children}
            </ol>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="underline decoration-buoy underline-offset-4">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[15px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-ink/25 px-3 py-2 font-display font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-ink/10 px-3 py-2 align-top leading-relaxed">
              {children}
            </td>
          ),
        }}
      >
        {forDisplay(report, streaming)}
      </ReactMarkdown>
      {streaming && <span className="cursor" aria-hidden />}
      {stopped && (
        <p className="mt-4 font-mono text-[12px] text-slate">
          Stopped early. This report is incomplete.
        </p>
      )}

      {sources.length > 0 && (
        <section className="mt-12 border-t border-ink/10 pt-8">
          <h3 className="font-display text-xl font-semibold tracking-tight">References</h3>
          <ol className="mt-5 space-y-3">
            {sources.map((s) => (
              <li key={s.n} className="flex gap-3 text-sm">
                <span className="w-6 shrink-0 text-slate">{s.n}.</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 hover:text-buoy"
                >
                  <span className="block font-medium leading-snug">{s.title}</span>
                  <span className="mt-0.5 block truncate text-slate">{domain(s.url)}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!streaming && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-ink/10 pt-6 text-sm">
          <button
            onClick={copy}
            className="rounded-[1px] border border-ink/25 px-4 py-1.5 transition-colors hover:border-ink"
          >
            {copied ? "Copied" : "Copy Markdown"}
          </button>
          <button
            onClick={download}
            className="rounded-[1px] border border-ink/25 px-4 py-1.5 transition-colors hover:border-ink"
          >
            Download .md
          </button>
        </div>
      )}
    </motion.article>
  );
}
