import { createAdminClient } from "./supabase/admin";
import { estimateCostUsd } from "./pricing";
import { MODEL } from "./anthropic";

export async function logQuery(opts: {
  userId: string;
  conversationId: string;
  messageId?: string;
  retrievalMs: number;
  generationMs: number;
  inputTokens: number;
  outputTokens: number;
  retrievedChunkCount: number;
}) {
  const db = createAdminClient();
  await db.from("query_logs").insert({
    user_id: opts.userId,
    conversation_id: opts.conversationId,
    message_id: opts.messageId ?? null,
    retrieval_ms: opts.retrievalMs,
    generation_ms: opts.generationMs,
    input_tokens: opts.inputTokens,
    output_tokens: opts.outputTokens,
    estimated_cost_usd: estimateCostUsd(
      MODEL,
      opts.inputTokens,
      opts.outputTokens
    ),
    retrieved_chunk_count: opts.retrievedChunkCount,
  });
}
