"use client";

import type { Citation } from "@/lib/types";

/**
 * Lightweight streaming renderer. Avoids re-parsing incomplete Markdown on
 * every frame, which causes visible layout jumps during generation.
 */
export default function StreamingText({
  content,
  citations,
  onCite,
  showCursor = true,
}: {
  content: string;
  citations: Citation[];
  onCite?: (n: number) => void;
  showCursor?: boolean;
}) {
  const parts = content.split(/(\[\d+\])/g);

  return (
    <div className="prose-answer stream-text">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (!m) {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {part}
            </span>
          );
        }
        const n = Number(m[1]);
        if (!citations.some((c) => c.n === n)) return null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCite?.(n)}
            className="mx-0.5 inline-flex h-[1.15em] min-w-[1.15em] items-center justify-center rounded border border-edge bg-elevated px-1 align-super font-mono text-[0.65em] font-medium text-accent"
            title={citations.find((c) => c.n === n)?.paper_title}
          >
            {n}
          </button>
        );
      })}
      {showCursor && (
        <span className="stream-cursor ml-px inline-block h-[1em] w-[2px] translate-y-[2px] bg-accent/70" />
      )}
    </div>
  );
}
