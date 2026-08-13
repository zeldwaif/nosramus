"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";

export default function Citations({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (citations.length === 0) return null;

  return (
    <div className="mt-4 border-t border-edge pt-3">
      <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wide text-muted">
        Sources
      </div>
      <ol className="space-y-1.5">
        {citations.map((c) => (
          <li key={c.chunk_id} id={`cite-${c.n}`} className="scroll-mt-24 text-sm">
            <button
              onClick={() => setOpen(open === c.chunk_id ? null : c.chunk_id)}
              className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/5"
            >
              <span className="mt-px inline-flex h-5 min-w-5 items-center justify-center rounded border border-edge bg-elevated px-1 font-mono text-xs text-accent">
                {c.n}
              </span>
              <span className="min-w-0">
                <span className="font-medium">{c.paper_title}</span>
                {(c.section || c.page) && (
                  <span className="text-muted">
                    {" · "}
                    {[c.section, c.page ? `p. ${c.page}` : null]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
              </span>
            </button>
            {open === c.chunk_id && (
              <blockquote className="ml-7 mt-1 border-l-2 border-accent/30 py-1 pl-3 text-sm text-muted">
                {c.quote}
                {c.quote.length >= 400 && "..."}
              </blockquote>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
