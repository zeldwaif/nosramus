import type { Contradiction } from "@/lib/types";

export default function Contradictions({
  contradictions,
}: {
  contradictions: Contradiction[];
}) {
  if (!contradictions.length) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="mb-3 font-mono text-xs font-medium uppercase tracking-wide text-amber-400">
        Conflicting claims
      </div>
      <ul className="space-y-4">
        {contradictions.map((c, i) => (
          <li key={i} className="text-sm">
            <p className="font-medium text-foreground">{c.claim}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <blockquote className="rounded-md border border-amber-500/20 bg-black/20 px-3 py-2 text-muted">
                <div className="mb-1 text-xs font-medium text-amber-400/90">
                  {c.paper_a}
                </div>
                &ldquo;{c.quote_a}&rdquo;
              </blockquote>
              <blockquote className="rounded-md border border-amber-500/20 bg-black/20 px-3 py-2 text-muted">
                <div className="mb-1 text-xs font-medium text-amber-400/90">
                  {c.paper_b}
                </div>
                &ldquo;{c.quote_b}&rdquo;
              </blockquote>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
