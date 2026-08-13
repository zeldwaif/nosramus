"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "./Markdown";
import StreamingText from "./StreamingText";
import Citations from "./Citations";
import Contradictions from "./Contradictions";
import PaperPicker from "./PaperPicker";
import SuggestedPrompts from "./SuggestedPrompts";
import { useSmoothedText } from "@/lib/useSmoothedText";
import type { Citation, Contradiction, Message } from "@/lib/types";

type StreamPhase = "idle" | "retrieving" | "writing";

interface PendingReply {
  citations: Citation[];
  content: string;
  contradictions: Contradiction[];
  conversationId: string;
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
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const [draftCitations, setDraftCitations] = useState<Citation[]>([]);
  const [pendingReply, setPendingReply] = useState<PendingReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { displayedText, push, finish, reset, isCaughtUp } = useSmoothedText();

  const streaming = phase !== "idle";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText, phase]);

  useEffect(() => {
    if (!pendingReply || !isCaughtUp()) return;

    setMessages((m) => [
      ...m,
      {
        id: `local-a-${Date.now()}`,
        conversation_id: pendingReply.conversationId,
        role: "assistant",
        content: pendingReply.content,
        citations: pendingReply.citations,
        contradictions: pendingReply.contradictions,
        created_at: new Date().toISOString(),
      },
    ]);
    setPendingReply(null);
    setDraftCitations([]);
    setPhase("idle");
    reset();
  }, [pendingReply, displayedText, isCaughtUp, reset]);

  const scrollToCitation = (n: number) => {
    document.getElementById(`cite-${n}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const updatePaperScope = async (ids: string[]) => {
    setPaperIds(ids);
    if (!conversationId) return;
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paperIds: ids }),
    });
  };

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    reset();
    setPendingReply(null);
    setDraftCitations([]);
    setPhase("retrieving");
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
          if (event.type === "citations") {
            setDraftCitations(event.citations);
            setPhase("writing");
          }
          if (event.type === "delta") push(event.text);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "done") {
            finish();
            setPendingReply({
              content: event.content,
              citations: event.citations,
              contradictions: event.contradictions ?? [],
              conversationId: event.conversationId,
            });
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
      setPhase("idle");
      setPendingReply(null);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const empty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
          {empty && (
            <div className="mt-10 md:mt-16">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent/80">
                Your library
              </p>
              <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
                What should we look up?
              </h1>
              <p className="mt-3 max-w-md text-muted">
                Ask in plain language. Answers come from papers you imported, with
                citations tied to the retrieved passage.
              </p>
              <SuggestedPrompts onSelect={setInput} />
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="mb-8 flex justify-end">
                <div className="max-w-[85%] rounded-2xl border border-edge bg-elevated/80 px-4 py-2.5 text-sm">
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
                <Contradictions contradictions={m.contradictions ?? []} />
              </div>
            )
          )}

          {streaming && (
            <div className="mb-10">
              {phase === "retrieving" && !displayedText && (
                <div className="flex items-center gap-2.5 text-sm text-muted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  Searching your library...
                </div>
              )}
              {(phase === "writing" || displayedText) && (
                <>
                  <StreamingText
                    content={displayedText}
                    citations={draftCitations}
                    onCite={scrollToCitation}
                    showCursor={!pendingReply || !isCaughtUp()}
                  />
                  {draftCitations.length > 0 && (
                    <Citations citations={draftCitations} />
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-edge bg-background/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:px-6">
          <div className="mb-2">
            <PaperPicker selected={paperIds} onChange={updatePaperScope} />
          </div>
          <div className="glass flex items-end gap-2 rounded-2xl px-3 py-2 focus-within:border-[rgba(134,239,172,0.35)] focus-within:shadow-[0_0_20px_rgba(134,239,172,0.08)]">
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
              className="max-h-40 flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-muted"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="btn-primary mb-0.5 h-9 shrink-0 px-4 text-sm"
            >
              {busy ? "Working" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
