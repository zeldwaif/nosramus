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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => {});
  }, [pathname]);

  const closeMobile = () => setMobileOpen(false);

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

  const navLink = (href: string, label: string, active: boolean, primary = false) => (
    <Link
      href={href}
      onClick={closeMobile}
      className={`block rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
        primary
          ? "border border-edge font-medium hover:border-edge-hover hover:bg-white/5"
          : active
            ? "bg-white/5 font-medium text-foreground"
            : "text-muted hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  const sidebar = (
    <>
      <div className="px-4 py-5">
        <Link
          href="/chat"
          onClick={closeMobile}
          className="font-display text-lg font-semibold tracking-tight text-foreground"
        >
          Nosramus
        </Link>
      </div>

      <div className="space-y-1 px-3">
        {navLink("/chat", "+ New conversation", pathname === "/chat", true)}
        {navLink("/library", "Library", pathname === "/library")}
        {navLink("/usage", "Usage", pathname === "/usage")}
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-1 pb-2 font-mono text-xs font-medium uppercase tracking-wide text-muted">
          Recent
        </div>
        {conversations.length === 0 && (
          <p className="px-1 text-sm text-muted">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <div key={c.id} className="group relative">
            <Link
              href={`/chat/${c.id}`}
              onClick={closeMobile}
              className={`block truncate rounded-lg py-2 pl-3 pr-8 text-sm transition-colors duration-200 ${
                pathname === `/chat/${c.id}`
                  ? "bg-white/5 font-medium text-foreground"
                  : "text-muted hover:bg-white/5 hover:text-foreground"
              }`}
              title={c.title}
            >
              {c.title}
            </Link>
            <button
              onClick={() => remove(c.id)}
              aria-label="Delete conversation"
              className="btn-ghost absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-edge px-4 py-4">
        <div className="truncate text-xs text-muted" title={email}>
          {email}
        </div>
        <button onClick={signOut} className="btn-ghost mt-1 text-xs">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-edge bg-background/80 px-4 backdrop-blur-md md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="btn-ghost rounded-lg p-2 text-foreground"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-display font-semibold tracking-tight">Nosramus</span>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-edge bg-background-alt">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-edge bg-background-alt/80 backdrop-blur-md md:flex">
        {sidebar}
      </aside>
    </>
  );
}
