import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne } from "./embeddings";
import { rerank } from "./rerank";

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

type ChunkRow = Omit<RetrievedChunk, "paper_title">;

type FtsRow = Omit<ChunkRow, "similarity"> & { rank: number };

/** Standard RRF constant — dampens the influence of high ranks in each list. */
const RRF_K = 60;

const RERANK_POOL_SIZE = 30;

export function reciprocalRankFusion(
  vectorRows: ChunkRow[],
  ftsRows: FtsRow[],
  poolSize: number
): Array<{ row: ChunkRow; score: number }> {
  const scores = new Map<string, number>();
  const rows = new Map<string, ChunkRow>();

  vectorRows.forEach((row, i) => {
    const rank = i + 1;
    scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + rank));
    rows.set(row.id, row);
  });

  ftsRows.forEach((row, i) => {
    const rank = i + 1;
    scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + rank));
    if (!rows.has(row.id)) {
      const { rank: _rank, ...chunk } = row;
      rows.set(row.id, { ...chunk, similarity: _rank });
    }
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, poolSize)
    .map(([id, score]) => ({ row: rows.get(id)!, score }));
}

function applyPerPaperCap(
  ordered: ChunkRow[],
  perPaperCap: number,
  limit: number
): ChunkRow[] {
  const seen = new Map<string, number>();
  const capped: ChunkRow[] = [];

  for (const row of ordered) {
    const n = seen.get(row.paper_id) ?? 0;
    if (n >= perPaperCap) continue;
    seen.set(row.paper_id, n + 1);
    capped.push(row);
    if (capped.length >= limit) break;
  }

  return capped;
}

/**
 * Hybrid retrieval: vector + keyword search fused with RRF, then cross-encoder rerank.
 * Over-fetches, reranks, then caps per paper so one long document can't crowd out the rest.
 */
export async function retrieve(
  supabase: SupabaseClient,
  opts: {
    query: string;
    paperIds?: string[];
    limit?: number;
    perPaperCap?: number;
    minSimilarity?: number;
  }
): Promise<RetrievedChunk[]> {
  const {
    query,
    paperIds,
    limit = 12,
    perPaperCap = 5,
    minSimilarity = 0,
  } = opts;

  const filterPaperIds = paperIds?.length ? paperIds : null;
  const candidateCount = Math.max(limit * 3, 30);

  const embedding = await embedOne(query, "query");

  const [vectorResult, ftsResult] = await Promise.all([
    supabase.rpc("match_chunks", {
      query_embedding: embedding,
      match_count: candidateCount,
      filter_paper_ids: filterPaperIds,
      min_similarity: minSimilarity,
    }),
    supabase.rpc("match_chunks_fts", {
      query_text: query,
      match_count: candidateCount,
      filter_paper_ids: filterPaperIds,
    }),
  ]);

  if (vectorResult.error) {
    throw new Error(`Vector retrieval failed: ${vectorResult.error.message}`);
  }
  if (ftsResult.error) {
    console.warn(`FTS retrieval failed: ${ftsResult.error.message}`);
  }

  const vectorRows = (vectorResult.data ?? []) as ChunkRow[];
  const ftsRows = (ftsResult.error ? [] : (ftsResult.data ?? [])) as FtsRow[];

  if (vectorRows.length === 0 && ftsRows.length === 0) return [];

  const fused = reciprocalRankFusion(vectorRows, ftsRows, RERANK_POOL_SIZE);

  const rerankInput = fused.map(({ row }) => ({ id: row.id, content: row.content }));
  const reranked = await rerank(query, rerankInput, limit);

  let ordered: ChunkRow[];

  if (reranked) {
    const byId = new Map(fused.map(({ row }) => [row.id, row]));
    ordered = reranked
      .map(({ id, score }) => {
        const row = byId.get(id);
        return row ? { ...row, similarity: score } : null;
      })
      .filter((r): r is ChunkRow => r != null);
  } else {
    ordered = fused.map(({ row, score }) => ({ ...row, similarity: score }));
  }

  const selected = applyPerPaperCap(ordered, perPaperCap, limit);
  if (selected.length === 0) return [];

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
