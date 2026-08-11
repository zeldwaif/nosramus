import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { searchArxiv } from "@/lib/sources/arxiv";
import { searchSemanticScholar } from "@/lib/sources/semanticScholar";
import { resolveIdentifier } from "@/lib/sources/resolve";
import { fail } from "@/lib/http";
import type { SearchResult } from "@/lib/types";

export async function GET(request: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const source = searchParams.get("source") ?? "all"; // all | arxiv | semantic_scholar
    if (!q) return NextResponse.json({ results: [] });

    // A pasted identifier should resolve to exactly one paper.
    const direct = await resolveIdentifier(q);
    if (direct) return NextResponse.json({ results: [direct] });

    const tasks: Promise<SearchResult[]>[] = [];
    if (source === "all" || source === "arxiv") tasks.push(searchArxiv(q, 10));
    if (source === "all" || source === "semantic_scholar")
      tasks.push(searchSemanticScholar(q, 10));

    const settled = await Promise.allSettled(tasks);
    const results = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const errors = settled
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason?.message ?? r.reason));

    // Same paper can come back from both sources - prefer the one with a PDF.
    const byTitle = new Map<string, SearchResult>();
    for (const r of results) {
      const key = r.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 90);
      const existing = byTitle.get(key);
      if (!existing || (!existing.pdf_url && r.pdf_url)) byTitle.set(key, r);
    }

    return NextResponse.json({ results: [...byTitle.values()], errors });
  } catch (err) {
    return fail(err);
  }
}
