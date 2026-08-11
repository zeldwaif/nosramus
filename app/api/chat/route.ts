import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { retrieve } from "@/lib/retrieval";
import { buildContext, deriveTitle, SYSTEM_PROMPT } from "@/lib/prompt";
import { anthropic, MODEL } from "@/lib/anthropic";
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
    if (!convoId) {
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

    // ---- retrieval ---------------------------------------------------
    // Fold in the previous turn so follow-ups like "why?" still retrieve well.
    const lastUser = [...(history ?? [])].reverse().find((m) => m.role === "user");
    const retrievalQuery = lastUser ? `${lastUser.content}\n${message}` : message;

    const chunks = await retrieve(supabase, {
      query: retrievalQuery,
      userId: user.id,
      paperIds,
    });

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
    const encoder = new TextEncoder();
    const convoIdFinal = convoId;

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

          await supabase.from("messages").insert({
            conversation_id: convoIdFinal,
            user_id: user.id,
            role: "assistant",
            content: renumbered,
            citations: finalCitations,
          });
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", convoIdFinal);

          send({
            type: "done",
            content: renumbered,
            citations: finalCitations,
            conversationId: convoIdFinal,
          });
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
