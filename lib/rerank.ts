/**
 * Cross-encoder reranking via Voyage AI. Falls back gracefully when unavailable.
 */
export async function rerank(
  query: string,
  candidates: { id: string; content: string }[],
  topK: number
): Promise<Array<{ id: string; score: number }> | null> {
  if (candidates.length === 0) return [];

  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    console.warn("rerank: VOYAGE_API_KEY is not set — skipping rerank");
    return null;
  }

  try {
    const res = await fetch("https://api.voyageai.com/v1/rerank", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        documents: candidates.map((c) => c.content),
        model: process.env.VOYAGE_RERANK_MODEL || "rerank-2.5-lite",
        top_k: topK,
        return_documents: false,
      }),
    });

    if (!res.ok) {
      console.warn(`rerank: Voyage request failed (${res.status}): ${await res.text()}`);
      return null;
    }

    const json = (await res.json()) as {
      data?: { index: number; relevance_score: number }[];
    };

    const ranked = (json.data ?? [])
      .map(({ index, relevance_score }) => ({
        id: candidates[index]?.id,
        score: relevance_score,
      }))
      .filter((r): r is { id: string; score: number } => r.id != null)
      .sort((a, b) => b.score - a.score);

    return ranked;
  } catch (err) {
    console.warn("rerank: request error — skipping rerank", err);
    return null;
  }
}
