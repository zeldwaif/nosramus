"use client";

import { useEffect, useRef, useState } from "react";
import type { Paper } from "@/lib/types";

export default function PaperPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/papers")
      .then((r) => r.json())
      .then((d) => setPapers((d.papers ?? []).filter((p: Paper) => p.status === "ready")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );

  const label =
    selected.length === 0
      ? `Whole library (${papers.length})`
      : `${selected.length} paper${selected.length === 1 ? "" : "s"}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-edge px-3 py-1 font-mono text-xs tracking-wide text-muted transition-colors hover:border-edge-hover hover:bg-white/5 hover:text-foreground"
      >
        {label}
      </button>

      {open && (
        <div className="glass absolute bottom-full z-10 mb-2 max-h-72 w-80 overflow-y-auto p-2 shadow-xl">
          {papers.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">
              No processed papers yet. Add some from the Library.
            </p>
          ) : (
            <>
              <button
                onClick={() => onChange([])}
                className="btn-ghost mb-1 w-full px-2 py-1.5 text-left text-sm"
              >
                Search everything
              </button>
              {papers.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="line-clamp-2">{p.title}</span>
                    {p.year && <span className="text-muted"> ({p.year})</span>}
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
