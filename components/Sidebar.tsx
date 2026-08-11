"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/lib/types";

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => {});
  }, [pathname]);

  const remove = async (id: string) => {
    setConversations((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (pathname === `/chat/${id}`) router.push("/chat");
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-edge bg-surface">
      <div className="px-4 py-4">
        <Link href="/chat" className="text-lg font-semibold tracking-tight">
          Nosramus
        </Link>
      </div>

      <div className="space-y-1 px-3">
        <Link
          href="/chat"
          className="block rounded-lg border border-edge px-3 py-2 text-sm font-medium hover:bg-background"
        >
          + New conversation
        </Link>
        <Link
          href="/library"
          className={`block rounded-lg px-3 py-2 text-sm hover:bg-background ${
            pathname === "/library" ? "bg-background font-medium" : ""
          }`}
        >
          Library
        </Link>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Recent
        </div>
        {conversations.length === 0 && (
          <p className="px-1 text-sm text-muted">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <div key={c.id} className="group relative">
            <Link
              href={`/chat/${c.id}`}
              className={`block truncate rounded-lg py-2 pl-3 pr-8 text-sm hover:bg-background ${
                pathname === `/chat/${c.id}` ? "bg-background font-medium" : ""
              }`}
              title={c.title}
            >
              {c.title}
            </Link>
            <button
              onClick={() => remove(c.id)}
              aria-label="Delete conversation"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-muted opacity-0 hover:text-foreground group-hover:opacity-100"
            >
              x
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-edge px-4 py-3">
        <div className="truncate text-xs text-muted" title={email}>
          {email}
        </div>
        <button
          onClick={signOut}
          className="mt-1 text-xs text-muted hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
