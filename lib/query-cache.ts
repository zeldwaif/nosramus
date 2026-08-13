import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Citation, Contradiction } from "./types";

export interface CachedResponse {
  content: string;
  citations: Citation[];
  contradictions: Contradiction[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function cacheKeys(opts: {
  userId: string;
  message: string;
  paperIds?: string[];
}) {
  const normalized = opts.message.trim().replace(/\s+/g, " ").toLowerCase();
  const sortedIds = [...(opts.paperIds ?? [])].sort().join(",");
  return {
    queryHash: sha256(`${opts.userId}:${normalized}`),
    paperIdsHash: sha256(sortedIds || "*"),
  };
}

export async function getCachedResponse(
  supabase: SupabaseClient,
  opts: { userId: string; message: string; paperIds?: string[] }
): Promise<CachedResponse | null> {
  const { queryHash, paperIdsHash } = cacheKeys(opts);
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("query_cache")
    .select("response")
    .eq("user_id", opts.userId)
    .eq("query_hash", queryHash)
    .eq("paper_ids_hash", paperIdsHash)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.response as CachedResponse) ?? null;
}

export async function setCachedResponse(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    message: string;
    paperIds?: string[];
    response: CachedResponse;
  }
) {
  const { queryHash, paperIdsHash } = cacheKeys(opts);
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  await supabase.from("query_cache").insert({
    user_id: opts.userId,
    query_hash: queryHash,
    paper_ids_hash: paperIdsHash,
    response: opts.response,
    expires_at: expiresAt,
  });
}

/** Replay a cached response through the NDJSON stream shape. */
export async function streamCachedResponse(
  send: (event: unknown) => void,
  cached: CachedResponse,
  conversationId: string,
  chunkSize = 2
) {
  send({ type: "start", conversationId });
  send({ type: "citations", citations: cached.citations });

  for (let i = 0; i < cached.content.length; i += chunkSize) {
    send({ type: "delta", text: cached.content.slice(i, i + chunkSize) });
  }

  send({
    type: "done",
    content: cached.content,
    citations: cached.citations,
    contradictions: cached.contradictions ?? [],
    conversationId,
  });
}
