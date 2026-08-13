import { createAdminClient } from "./supabase/admin";
import { chunkPages } from "./chunking";
import { embedBatched } from "./embeddings";
import { extractFacts } from "./extraction";
import { extractPdf } from "./pdf";

/**
 * Extract -> chunk -> embed -> store. Runs against the service-role client so
 * it can write chunks in bulk, but every row is scoped to `userId`.
 *
 * Called after the paper row already exists, so failures can be recorded on it.
 */
export async function ingestPdf(opts: {
  paperId: string;
  userId: string;
  pdf: ArrayBuffer;
}) {
  const db = createAdminClient();
  const { paperId, userId, pdf } = opts;

  await db.from("papers").update({ status: "processing", error: null }).eq("id", paperId);

  try {
    const { pages, pageCount } = await extractPdf(pdf);
    const chunks = chunkPages(pages);
    if (chunks.length === 0) throw new Error("Could not extract any usable text.");

    const vectors = await embedBatched(chunks.map((c) => c.content));

    // Re-ingest should replace, not duplicate.
    await db.from("chunks").delete().eq("paper_id", paperId);

    const rows = chunks.map((c, i) => ({
      paper_id: paperId,
      user_id: userId,
      idx: c.idx,
      content: c.content,
      page: c.page,
      section: c.section,
      token_count: c.token_count,
      embedding: vectors[i],
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await db.from("chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(error.message);
    }

    await db
      .from("papers")
      .update({ status: "ready", page_count: pageCount })
      .eq("id", paperId);

    // Fact extraction is best-effort — don't fail ingestion if it errors.
    try {
      const { data: paperRow } = await db
        .from("papers")
        .select("abstract")
        .eq("id", paperId)
        .single();
      await extractFacts(paperId, userId, pages, paperRow?.abstract);
    } catch (err) {
      console.warn(`Fact extraction failed for paper ${paperId}:`, err);
    }

    return { chunkCount: rows.length, pageCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    await db.from("papers").update({ status: "failed", error: message }).eq("id", paperId);
    throw err;
  }
}

/** Downloads a PDF from an external source (arXiv, open-access mirrors). */
export async function fetchPdf(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { "user-agent": "nosramus/0.1 (research assistant)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not download the PDF (${res.status}).`);

  const type = res.headers.get("content-type") ?? "";
  const buf = await res.arrayBuffer();

  const isPdf =
    type.includes("pdf") ||
    new TextDecoder().decode(buf.slice(0, 5)).startsWith("%PDF");
  if (!isPdf) throw new Error("That link did not return a PDF.");

  return buf;
}
