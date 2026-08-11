import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "./embeddings";

export interface RetrievedChunk {
  id: string;
  paper_id: string;
  idx: number;
  content: string;
  page: number | null;
  section: string | null;
  similarity: number;
  paper_title: string;
}

/**
 * Semantic search over the user's chunks, optionally scoped to specific papers.
 * Over-fetches then caps per paper so one long document can't crowd out the rest.
 */
export async function retrieve(
  supabase: SupabaseClient,
  opts: {
    query: string;
    userId: string;
    paperIds?: string[];
    limit?: number;
    perPaperCap?: number;
    minSimilarity?: number;
  }
): Promise<RetrievedChunk[]> {
  const {
    query,
    userId,
    paperIds,
    limit = 12,
    perPaperCap = 5,
    minSimilarity = 0.15,
  } = opts;

  const embedding = await embedOne(query, "query");

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: limit * 3,
    filter_paper_ids: paperIds?.length ? paperIds : null,
    min_similarity: minSimilarity,
  });
  if (error) throw new Error(`Retrieval failed: ${error.message}`);

  const rows = (data ?? []) as Omit<RetrievedChunk, "paper_title">[];
  if (rows.length === 0) return [];

  const seen = new Map<string, number>();
  const capped = rows.filter((r) => {
    const n = seen.get(r.paper_id) ?? 0;
    if (n >= perPaperCap) return false;
    seen.set(r.paper_id, n + 1);
    return true;
  });

  const selected = capped.slice(0, limit);

  const { data: papers } = await supabase
    .from("papers")
    .select("id,title")
    .in("id", [...new Set(selected.map((r) => r.paper_id))]);

  const titles = new Map((papers ?? []).map((p) => [p.id, p.title as string]));

  return selected.map((r) => ({
    ...r,
    paper_title: titles.get(r.paper_id) ?? "Unknown paper",
  }));
}
