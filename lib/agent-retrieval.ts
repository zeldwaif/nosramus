import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, MODEL } from "./anthropic";
import { buildContext } from "./prompt";
import { retrieve, type RetrievedChunk } from "./retrieval";

const MAX_ITERATIONS = 3;

const GATHER_SYSTEM = `You are gathering context from a research paper library before an answer is written.

Use the search_library tool with focused search queries. You may call it multiple times with different queries when the question is comparative, multi-part, or when initial results are insufficient.

When you have enough excerpts to answer the question, reply with exactly: READY`;

/**
 * Bounded tool-use loop: Claude searches the library via retrieve(), accumulating
 * deduped chunks across calls.
 */
export async function agenticRetrieve(
  supabase: SupabaseClient,
  opts: {
    message: string;
    paperIds?: string[];
    history?: { role: "user" | "assistant"; content: string }[];
  }
): Promise<RetrievedChunk[]> {
  const { message, paperIds, history = [] } = opts;
  const byId = new Map<string, RetrievedChunk>();

  const searchTool: Anthropic.Tool = {
    name: "search_library",
    description:
      "Search the user's paper library for relevant excerpts. Use specific, focused queries.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query — keywords or a natural-language question.",
        },
      },
      required: ["query"],
    },
  };

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: `Gather excerpts to answer this question. Call search_library as needed.\n\nQuestion: ${message}`,
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: GATHER_SYSTEM,
      tools: [searchTool],
      messages,
    });

    const toolUses = res.content.filter(
      (b): b is Extract<(typeof res.content)[number], { type: "tool_use" }> =>
        b.type === "tool_use"
    );

    if (toolUses.length === 0) break;

    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] =
      [];

    for (const tool of toolUses) {
      if (tool.name !== "search_library") continue;
      const { query } = tool.input as { query: string };
      const chunks = await retrieve(supabase, { query, paperIds });
      for (const c of chunks) byId.set(c.id, c);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: buildContext(chunks) || "No relevant excerpts found.",
      });
    }

    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: toolResults });

    const text = res.content.find((b) => b.type === "text");
    if (text?.type === "text" && text.text.trim() === "READY") break;
    if (res.stop_reason === "end_turn" && toolUses.length === 0) break;
  }

  return [...byId.values()];
}
