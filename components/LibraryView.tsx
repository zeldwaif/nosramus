"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Paper, SearchResult } from "@/lib/types";

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

  // Poll while anything is still processing.
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

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
      <p className="mt-2 text-muted">
        Search arXiv and Semantic Scholar, paste a DOI or arXiv link, or upload
        PDFs directly.
      </p>

      {/* ---- add papers ---- */}
      <div className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search papers, or paste a DOI / arXiv ID"
          className="flex-1 rounded-lg border border-edge bg-transparent px-3 py-2 outline-none focus:border-accent"
        />
        <button
          onClick={search}
          disabled={searching}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {searching ? "..." : "Search"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-edge px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Upload PDF
        </button>
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
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* ---- search results ---- */}
      {results && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Results</h2>
            <button
              onClick={() => setResults(null)}
              className="text-sm text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
          {results.length === 0 && <p className="text-muted">No matches.</p>}
          <ul className="space-y-3">
            {results.map((r) => (
              <li
                key={`${r.source}-${r.source_id}`}
                className="rounded-xl border border-edge p-4"
              >
                <div className="font-medium">{r.title}</div>
                <div className="mt-1 text-sm text-muted">
                  {r.authors.slice(0, 4).join(", ")}
                  {r.authors.length > 4 && " et al."}
                  {r.year && ` - ${r.year}`}
                  {r.venue && ` - ${r.venue}`}
                </div>
                {r.abstract && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{r.abstract}</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => importPaper(r)}
                    disabled={!r.pdf_url || busy === r.source_id}
                    className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-40"
                    title={r.pdf_url ? undefined : "No open-access PDF available"}
                  >
                    {busy === r.source_id ? "Adding..." : "Add to library"}
                  </button>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent hover:underline"
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

      {/* ---- library ---- */}
      <section className="mt-10">
        <h2 className="mb-3 font-medium">
          Your papers {papers.length > 0 && `(${papers.length})`}
        </h2>
        {loading ? (
          <p className="text-muted">Loading...</p>
        ) : papers.length === 0 ? (
          <p className="text-muted">Nothing here yet. Add a paper above.</p>
        ) : (
          <ul className="divide-y divide-edge rounded-xl border border-edge">
            {papers.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.title}</div>
                  <div className="mt-0.5 text-sm text-muted">
                    {p.authors?.slice(0, 3).join(", ")}
                    {p.authors?.length > 3 && " et al."}
                    {p.year && ` - ${p.year}`}
                    {p.page_count && ` - ${p.page_count} pages`}
                  </div>
                  {p.status !== "ready" && (
                    <div
                      className={`mt-1 text-sm ${
                        p.status === "failed" ? "text-red-500" : "text-muted"
                      }`}
                    >
                      {p.status === "failed"
                        ? `Failed: ${p.error}`
                        : "Processing..."}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="text-sm text-muted hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
