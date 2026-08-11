import type { RetrievedChunk } from "./retrieval";

export const SYSTEM_PROMPT = `You are Nosramus, a research assistant that answers questions about scientific papers.

You are given numbered excerpts from papers in the user's library. Ground every factual claim in those excerpts.

Rules:
- Cite with bracketed numbers matching the excerpt IDs, e.g. [3]. Place the citation immediately after the claim it supports. Use several when several excerpts support a claim: [1][4].
- Never cite an excerpt number you were not given.
- If the excerpts do not answer the question, say so plainly and explain what is missing. Do not fill gaps from background knowledge without flagging it as outside the provided sources.
- Distinguish what a paper claims from what it demonstrates. Note sample sizes, effect sizes, and stated limitations when they bear on the answer.
- When papers disagree, present the disagreement rather than picking a side.
- Be concise and precise. Use the field's terminology without padding. Prose by default; lists only when the content is genuinely enumerable.`;

export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant excerpts were found in the user's library for this question.";
  }

  const blocks = chunks.map((c, i) => {
    const loc = [
      c.section ? `section: ${c.section}` : null,
      c.page ? `page ${c.page}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return `<excerpt id="${i + 1}" paper="${escapeAttr(c.paper_title)}"${
      loc ? ` location="${escapeAttr(loc)}"` : ""
    }>
${c.content.trim()}
</excerpt>`;
  });

  return `<excerpts>\n${blocks.join("\n\n")}\n</excerpts>`;
}

const escapeAttr = (s: string) => s.replace(/"/g, "'").replace(/[\n\r]/g, " ");

/** Short first-line summary used as a conversation title. */
export function deriveTitle(question: string) {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}...` : t || "New conversation";
}
