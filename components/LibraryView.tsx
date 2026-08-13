"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Paper, PaperFact, SearchResult } from "@/lib/types";

function StatusBadge({ status }: { status: Paper["status"] }) {
  if (status === "ready") return null;
  const styles =
    status === "failed"
      ? "text-red-400"
      : "text-muted";
  const label =
    status === "failed"
      ? "Failed"
      : status === "processing"
        ? "Processing"
        : "Pending";
  return (
    <span className={`font-mono text-xs uppercase tracking-wide ${styles}`}>
      {label}
    </span>
  );
}

function KeyFacts({ paperId }: { paperId: string }) {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<PaperFact[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (facts !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${paperId}/facts`);
      const data = await res.json();
      setFacts(data.facts ?? []);
    } catch {
      setFacts([]);
    } finally {
      setLoading(false);
    }
  }, [paperId, facts]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        className="btn-ghost text-xs text-muted hover:text-foreground"
      >
        {open ? "▾" : "▸"} Key facts
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {loading && <span className="text-xs text-muted">Loading...</span>}
          {!loading && facts?.length === 0 && (
            <span className="text-xs text-muted">No facts extracted yet.</span>
          )}
          {facts?.slice(0, 8).map((f) => (
            <span
              key={f.id}
              title={f.evidence ?? undefined}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-edge bg-elevated/50 px-2 py-0.5 text-xs"
            >
              <span className="font-mono uppercase tracking-wide text-accent/80">
                {f.fact_type.replace("_", " ")}
              </span>
              <span className="truncate text-muted">{f.key}:</span>
              <span className="truncate font-medium">{f.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LibraryView() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/papers");
    const data = await res.json();
    setPapers(data.papers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/papers");
      const data = await res.json();
      if (cancelled) return;
      setPapers(data.papers ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!papers.some((p) => p.status === "pending" || p.status === "processing")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [papers, load]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/papers/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const importPaper = async (result: SearchResult) => {
    setBusy(result.source_id);
    setError(null);
    try {
      const res = await fetch("/api/papers/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      setBusy(file.name);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/papers/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } catch (err) {
        setError(
          `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`
        );
      }
    }
    setBusy(null);
    await load();
  };

  const remove = async (id: string) => {
    setPapers((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/papers/${id}`, { method: "DELETE" });
    load();
  };

  const retry = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/papers/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
        Library
      </h1>
      <p className="mt-2 text-muted">
        Search arXiv and Semantic Scholar, paste a DOI or arXiv link, or upload
        PDFs directly.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search papers, or paste a DOI / arXiv ID"
          className="input flex-1"
        />
        <div className="flex gap-2">
          <button
            onClick={search}
            disabled={searching}
            className="btn-primary h-11 px-5 text-sm"
          >
            {searching ? "..." : "Search"}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-secondary h-11 px-5 text-sm"
          >
            Upload PDF
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {busy && (
        <p className="mt-3 text-sm text-muted">
          Processing {busy}... extraction and embedding can take a minute.
        </p>
      )}
      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {results && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-medium">Results</h2>
            <button onClick={() => setResults(null)} className="btn-ghost text-sm">
              Clear
            </button>
          </div>
          {results.length === 0 && <p className="text-muted">No matches.</p>}
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={`${r.source}-${r.source_id}`} className="glass glass-interactive p-4">
                <div className="font-medium">{r.title}</div>
                <div className="mt-1 text-sm text-muted">
                  {r.authors.slice(0, 4).join(", ")}
                  {r.authors.length > 4 && " et al."}
                  {r.year && ` · ${r.year}`}
                  {r.venue && ` · ${r.venue}`}
                </div>
                {r.abstract && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{r.abstract}</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => importPaper(r)}
                    disabled={!r.pdf_url || busy === r.source_id}
                    className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40"
                    title={r.pdf_url ? undefined : "No open-access PDF available"}
                  >
                    {busy === r.source_id ? "Adding..." : "Add to library"}
                  </button>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent hover:underline focus-visible:outline-none focus-visible:text-accent"
                    >
                      View source
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-display font-medium">
          Your papers {papers.length > 0 && `(${papers.length})`}
        </h2>
        {loading ? (
          <p className="text-muted">Loading...</p>
        ) : papers.length === 0 ? (
          <div className="glass p-8 text-center">
            <p className="text-muted">Nothing here yet. Add a paper above.</p>
          </div>
        ) : (
          <ul className="glass divide-y divide-edge overflow-hidden">
            {papers.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{p.title}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {p.authors?.slice(0, 3).join(", ")}
                    {p.authors?.length > 3 && " et al."}
                    {p.year && ` · ${p.year}`}
                    {p.page_count && ` · ${p.page_count} pages`}
                  </div>
                  {p.status === "failed" && (
                    <div className="mt-1 text-sm text-red-400">{p.error}</div>
                  )}
                  {p.status === "ready" && <KeyFacts paperId={p.id} />}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.status === "failed" && p.storage_path && (
                    <button
                      onClick={() => retry(p.id)}
                      disabled={busy === p.id}
                      className="btn-ghost text-sm text-accent"
                    >
                      {busy === p.id ? "Retrying..." : "Retry"}
                    </button>
                  )}
                  <button
                    onClick={() => remove(p.id)}
                    className="btn-ghost text-sm hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
