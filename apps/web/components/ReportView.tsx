"use client";

import { m } from "framer-motion";
import { memo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SourceRef } from "@/lib/types";
import { domain } from "./ActivityCard";

const plugins = [remarkGfm];

const components: Components = {
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
  h3: ({ children }) => <h4 className="mb-2 mt-8 font-display text-lg font-semibold">{children}</h4>,
  p: ({ children }) => <p className="my-5 text-[16.5px] leading-[1.8]">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-5 list-disc space-y-2 pl-6 text-[16.5px] leading-[1.75] marker:text-buoy">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-5 list-decimal space-y-2 pl-6 text-[16.5px] leading-[1.75]">{children}</ol>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-buoy underline-offset-4"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[15px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-ink/25 px-3 py-2 font-display font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-ink/10 px-3 py-2 align-top leading-relaxed">{children}</td>
  ),
};

const tidy = (md: string) =>
  md
    .replace(/[ \t]*(?:\[\d+\])+/g, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/,\s*,/g, ",");

const looksLikeHeading = (line: string) =>
  line.length >= 3 &&
  line.length <= 80 &&
  line.split(/\s+/).length <= 10 &&
  /^[A-Z]/.test(line) &&
  !/[.!?:;,]$/.test(line) &&
  !/^[#>*|\-\d]/.test(line);

function ensureHeadings(text: string, streaming: boolean) {
  const lines = text.split("\n");
  let first = true;
  let previousBlank = true;
  return lines
    .map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        previousBlank = true;
        return line;
      }
      const complete = !streaming || i < lines.length - 1;
      let result = line;
      if (first) {
        first = false;
        if (!trimmed.startsWith("#") && trimmed.length <= 160 && !/[.!?]$/.test(trimmed)) {
          result = `# ${trimmed}`;
        }
      } else if (previousBlank && complete && looksLikeHeading(trimmed)) {
        result = `## ${trimmed}`;
      }
      previousBlank = false;
      return result;
    })
    .join("\n");
}

function forDisplay(md: string, streaming: boolean) {
  const text = ensureHeadings(tidy(md), streaming);
  if (!streaming) return text;
  const blocks = text.replace(/\s*\[\d*$/, "").split(/\n{2,}/);
  if (blocks[blocks.length - 1].trimStart().startsWith("|")) blocks.pop();
  return blocks.join("\n\n");
}

const startsList = (block: string) => /^\s*(?:[-*]|\d+\.)\s/.test(block);

function toBlocks(md: string) {
  const blocks: string[] = [];
  for (const block of md.split(/\n{2,}/)) {
    const last = blocks.length - 1;
    if (last >= 0 && startsList(block) && startsList(blocks[last])) {
      blocks[last] = `${blocks[last]}\n\n${block}`;
    } else {
      blocks.push(block);
    }
  }
  return blocks;
}

const Block = memo(function Block({ md }: { md: string }) {
  return (
    <ReactMarkdown remarkPlugins={plugins} components={components}>
      {md}
    </ReactMarkdown>
  );
});

const isWebLink = (url: string) => /^https?:\/\//i.test(url);

function toMarkdown(report: string, sources: SourceRef[]) {
  const list = sources
    .filter((s) => isWebLink(s.url))
    .map((s) => `${s.n}. [${s.title}](${s.url})`)
    .join("\n");
  const body = ensureHeadings(tidy(report), false);
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
  const references = sources.filter((s) => isWebLink(s.url));

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
    <m.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[4px] bg-paper px-5 py-8 text-ink shadow-[0_30px_70px_-35px_rgba(0,0,0,0.85)] sheet sm:px-10 sm:py-12"
    >
      {toBlocks(forDisplay(report, streaming)).map((block, i) => (
        <Block key={i} md={block} />
      ))}
      {streaming && <span className="cursor" aria-hidden />}
      {stopped && (
        <p className="mt-4 font-mono text-[12px] text-slate">
          Stopped early. This report is incomplete.
        </p>
      )}

      {references.length > 0 && (
        <section className="mt-12 border-t border-ink/10 pt-8">
          <h3 className="font-display text-xl font-semibold tracking-tight">References</h3>
          <ol className="mt-5 space-y-3">
            {references.map((s) => (
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
    </m.article>
  );
}
