"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@/lib/types";

/**
 * Renders the answer, turning [n] markers into clickable pills that scroll to
 * the matching source. Splitting happens on text nodes only so markdown
 * structure is preserved.
 */
export default function Markdown({
  content,
  citations,
  onCite,
}: {
  content: string;
  citations: Citation[];
  onCite?: (n: number) => void;
}) {
  const withPills = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") return linkify(children);
    if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{withPills(c)}</span>);
    return children;
  };

  const linkify = (text: string) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (!m) return part;
      const n = Number(m[1]);
      if (!citations.some((c) => c.n === n)) return null;
      return (
        <button
          key={i}
          onClick={() => onCite?.(n)}
          className="mx-0.5 inline-flex h-[1.15em] min-w-[1.15em] items-center justify-center rounded-[4px] border border-edge bg-surface px-1 align-super text-[0.65em] font-medium text-accent hover:bg-edge"
          title={citations.find((c) => c.n === n)?.paper_title}
        >
          {n}
        </button>
      );
    });
  };

  return (
    <div className="prose-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{withPills(children)}</p>,
          li: ({ children }) => <li>{withPills(children)}</li>,
          td: ({ children }) => <td>{withPills(children)}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
