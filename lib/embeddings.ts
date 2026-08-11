/**
 * Embeddings. One dimensionality (1024) regardless of provider so the
 * pgvector column stays stable - OpenAI models are truncated to match.
 */
export const EMBEDDING_DIM = 1024;

type Provider = "voyage" | "openai";

function provider(): Provider {
  return (process.env.EMBEDDING_PROVIDER as Provider) || "voyage";
}

export async function embed(
  texts: string[],
  kind: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return provider() === "openai"
    ? embedOpenAI(texts)
    : embedVoyage(texts, kind);
}

export async function embedOne(
  text: string,
  kind: "document" | "query" = "query"
): Promise<number[]> {
  const [v] = await embed([text], kind);
  return v;
}

async function embedVoyage(texts: string[], kind: "document" | "query") {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.VOYAGE_MODEL || "voyage-3.5",
      input: texts,
      input_type: kind,
      output_dimension: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) throw new Error(`Voyage embeddings failed: ${await res.text()}`);
  const json = await res.json();
  return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
}

async function embedOpenAI(texts: string[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI embeddings failed: ${await res.text()}`);
  const json = await res.json();
  return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
}

/** Embed in batches so large papers don't blow the provider's per-request cap. */
export async function embedBatched(texts: string[], batchSize = 96) {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    out.push(...(await embed(texts.slice(i, i + batchSize), "document")));
  }
  return out;
}
