"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "./Markdown";
import Citations from "./Citations";
import PaperPicker from "./PaperPicker";
import type { Citation, Message } from "@/lib/types";

interface Draft {
  content: string;
  citations: Citation[];
}

export default function ChatView({
  conversationId,
  initialMessages = [],
  initialPaperIds = [],
}: {
  conversationId?: string;
  initialMessages?: Message[];
  initialPaperIds?: string[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [paperIds, setPaperIds] = useState<string[]>(initialPaperIds);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  const scrollToCitation = (n: number) => {
    document.getElementById(`cite-${n}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [
      ...m,
      {
        id: `local-${Date.now()}`,
        conversation_id: conversationId ?? "",
        role: "user",
        content: question,
        citations: [],
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft({ content: "", citations: [] });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message: question, paperIds }),
      });

      if (!res.ok || !res.body) {
        throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newConversationId: string | undefined;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "start") newConversationId = event.conversationId;
          if (event.type === "citations")
            setDraft((d) => ({ ...(d ?? { content: "" }), citations: event.citations }));
          if (event.type === "delta")
            setDraft((d) => ({
              content: (d?.content ?? "") + event.text,
              citations: d?.citations ?? [],
            }));
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "done") {
            setMessages((m) => [
              ...m,
              {
                id: `local-a-${Date.now()}`,
                conversation_id: event.conversationId,
                role: "assistant",
                content: event.content,
                citations: event.citations,
                created_at: new Date().toISOString(),
              },
            ]);
            setDraft(null);
            newConversationId = event.conversationId;
          }
        }
      }

      if (!conversationId && newConversationId) {
        router.replace(`/chat/${newConversationId}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const empty = messages.length === 0 && !draft;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {empty && (
            <div className="mt-24 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                What do you want to know?
              </h1>
              <p className="mx-auto mt-3 max-w-md text-muted">
                Ask a question and Nosramus will answer from the papers in your
                library, citing the passages it used.
              </p>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="mb-8 flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-surface px-4 py-2.5">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="mb-10">
                <Markdown
                  content={m.content}
                  citations={m.citations}
                  onCite={scrollToCitation}
                />
                <Citations citations={m.citations} />
              </div>
            )
          )}

          {draft && (
            <div className="mb-10">
              {draft.content ? (
                <Markdown
                  content={draft.content}
                  citations={draft.citations}
                  onCite={scrollToCitation}
                />
              ) : (
                <p className="animate-pulse text-muted">Searching your library...</p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-edge bg-background">
        <div className="mx-auto w-full max-w-3xl px-6 py-4">
          <div className="mb-2">
            <PaperPicker selected={paperIds} onChange={setPaperIds} />
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-edge px-3 py-2 focus-within:border-accent">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask about your papers..."
              className="max-h-40 flex-1 resize-none bg-transparent py-1.5 outline-none placeholder:text-muted"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
