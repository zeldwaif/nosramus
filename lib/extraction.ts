import { anthropic, MODEL } from "./anthropic";
import { createAdminClient } from "./supabase/admin";
import type { PageText } from "./chunking";

export type FactType =
  | "dataset"
  | "metric"
  | "model_size"
  | "architecture"
  | "result";

export interface ExtractedFact {
  fact_type: FactType;
  key: string;
  value: string;
  evidence: string | null;
  page: number | null;
}

const FACT_TYPES: FactType[] = [
  "dataset",
  "metric",
  "model_size",
  "architecture",
  "result",
];

function samplePages(pages: PageText[], max = 6): PageText[] {
  if (pages.length <= max) return pages;
  const step = Math.floor(pages.length / max);
  const out: PageText[] = [];
  for (let i = 0; i < pages.length && out.length < max; i += Math.max(step, 1)) {
    out.push(pages[i]);
  }
  return out;
}

/**
 * Extract structured facts from a paper's text and persist them.
 * Failures are logged by the caller; this throws on unrecoverable errors.
 */
export async function extractFacts(
  paperId: string,
  userId: string,
  pages: PageText[],
  abstract?: string | null
) {
  const sampled = samplePages(pages);
  const body = sampled
    .map((p) => `[Page ${p.page}]\n${p.text.slice(0, 2500)}`)
    .join("\n\n");

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [
      {
        name: "extract_paper_facts",
        description: "Extract structured facts from a research paper.",
        input_schema: {
          type: "object",
          properties: {
            facts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  fact_type: {
                    type: "string",
                    enum: FACT_TYPES,
                  },
                  key: { type: "string" },
                  value: { type: "string" },
                  evidence: { type: "string" },
                  page: { type: "integer" },
                },
                required: ["fact_type", "key", "value"],
              },
            },
          },
          required: ["facts"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "extract_paper_facts" },
    messages: [
      {
        role: "user",
        content: `Extract key structured facts from this research paper. Focus on datasets, metrics (with numbers), model sizes, architectural details, and headline results. Only include facts explicitly stated in the text.

${abstract ? `Abstract:\n${abstract}\n\n` : ""}Paper excerpts:
${body}`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return;

  const { facts } = block.input as { facts: ExtractedFact[] };
  if (!facts?.length) return;

  const db = createAdminClient();
  await db.from("paper_facts").delete().eq("paper_id", paperId);

  const rows = facts.map((f) => ({
    paper_id: paperId,
    user_id: userId,
    fact_type: f.fact_type,
    key: f.key,
    value: f.value,
    evidence: f.evidence ?? null,
    page: f.page ?? null,
  }));

  const { error } = await db.from("paper_facts").insert(rows);
  if (error) throw new Error(error.message);
}
