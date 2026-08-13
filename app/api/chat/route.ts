import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { agenticRetrieve } from "@/lib/agent-retrieval";
import { retrieve } from "@/lib/retrieval";
import { buildContext, deriveTitle, SYSTEM_PROMPT } from "@/lib/prompt";
import { parseContradictions } from "@/lib/contradictions";
import { anthropic, MODEL } from "@/lib/anthropic";
import { logQuery } from "@/lib/query-log";
import {
  getCachedResponse,
  setCachedResponse,
  streamCachedResponse,
} from "@/lib/query-cache";
import { fail } from "@/lib/http";
import type { Citation } from "@/lib/types";

export const maxDuration = 120;

const HISTORY_LIMIT = 12;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { conversationId, message, paperIds } = (await request.json()) as {
      conversationId?: string;
      message: string;
      paperIds?: string[];
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // ---- conversation ------------------------------------------------
    let convoId = conversationId;
    if (convoId) {
      const { data: existing, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", convoId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!existing) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
    } else {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: deriveTitle(message),
          paper_ids: paperIds ?? [],
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      convoId = data.id as string;
    }

    const { data: history } = await supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    await supabase.from("messages").insert({
      conversation_id: convoId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    const convoIdFinal = convoId;
    const encoder = new TextEncoder();

    // ---- cache hit ---------------------------------------------------
    const cached = await getCachedResponse(supabase, {
      userId: user.id,
      message,
      paperIds,
    });

    if (cached) {
      const stream = new ReadableStream({
        async start(controller) {
          const send = (event: unknown) =>
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          try {
            await streamCachedResponse(send, cached, convoIdFinal);
            await supabase.from("messages").insert({
              conversation_id: convoIdFinal,
              user_id: user.id,
              role: "assistant",
              content: cached.content,
              citations: cached.citations,
              contradictions: cached.contradictions ?? [],
            });
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", convoIdFinal);
          } catch (err) {
            send({
              type: "error",
              error: err instanceof Error ? err.message : "Cache replay failed",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-cache, no-transform",
        },
      });
    }

    // ---- retrieval ---------------------------------------------------
    // Fold in the previous turn so follow-ups like "why?" still retrieve well.
    const lastUser = [...(history ?? [])].reverse().find((m) => m.role === "user");
    const retrievalQuery = lastUser ? `${lastUser.content}\n${message}` : message;

    const historyForAgent = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

    const retrievalStart = Date.now();

    let chunks = await agenticRetrieve(supabase, {
      message,
      paperIds,
      history: historyForAgent,
    });

    // Fallback if the agent loop didn't search (e.g. model skipped tools).
    if (chunks.length === 0) {
      chunks = await retrieve(supabase, {
        query: retrievalQuery,
        paperIds,
      });
    }

    const retrievalMs = Date.now() - retrievalStart;

    const candidates: Citation[] = chunks.map((c, i) => ({
      n: i + 1,
      chunk_id: c.id,
      paper_id: c.paper_id,
      paper_title: c.paper_title,
      page: c.page,
      section: c.section,
      quote: c.content.slice(0, 400),
    }));

    // ---- stream ------------------------------------------------------
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) =>
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

        let full = "";
        try {
          send({ type: "start", conversationId: convoIdFinal });
          send({ type: "citations", citations: candidates });

          const messages = [
            ...(history ?? []).map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content as string,
            })),
            {
              role: "user" as const,
              content: `${buildContext(chunks)}\n\nQuestion: ${message}`,
            },
          ];

          const genStart = Date.now();

          const result = anthropic().messages.stream({
            model: MODEL,
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            messages,
          });

          for await (const event of result) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              full += event.delta.text;
              send({ type: "delta", text: event.delta.text });
            }
          }

          const finalMessage = await result.finalMessage();
          const generationMs = Date.now() - genStart;
          const inputTokens = finalMessage.usage?.input_tokens ?? 0;
          const outputTokens = finalMessage.usage?.output_tokens ?? 0;

          // Keep only citations the model actually used, renumbered in order.
          const used = [...full.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
          const order = [...new Set(used)].filter((n) =>
            candidates.some((c) => c.n === n)
          );
          const finalCitations = order.map((n, i) => ({
            ...candidates.find((c) => c.n === n)!,
            n: i + 1,
          }));
          const renumbered = full.replace(/\[(\d+)\]/g, (match, d) => {
            const pos = order.indexOf(Number(d));
            return pos === -1 ? "" : `[${pos + 1}]`;
          });

          const { content: cleanContent, contradictions } =
            parseContradictions(renumbered);

          const { data: inserted } = await supabase
            .from("messages")
            .insert({
              conversation_id: convoIdFinal,
              user_id: user.id,
              role: "assistant",
              content: cleanContent,
              citations: finalCitations,
              contradictions,
            })
            .select("id")
            .single();

          void logQuery({
            userId: user.id,
            conversationId: convoIdFinal,
            messageId: inserted?.id as string | undefined,
            retrievalMs,
            generationMs,
            inputTokens,
            outputTokens,
            retrievedChunkCount: chunks.length,
          }).catch((err) => console.warn("query log failed:", err));
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", convoIdFinal);

          send({
            type: "done",
            content: cleanContent,
            citations: finalCitations,
            contradictions,
            conversationId: convoIdFinal,
          });

          void setCachedResponse(supabase, {
            userId: user.id,
            message,
            paperIds,
            response: {
              content: cleanContent,
              citations: finalCitations,
              contradictions,
            },
          }).catch((err) => console.warn("cache write failed:", err));
        } catch (err) {
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Stream failed",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
