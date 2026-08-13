"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBrowserSiteUrl } from "@/lib/site-url";
import { safeNextPath } from "@/lib/safe-redirect";

function LoginForm() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => params.get("error"));

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const next = safeNextPath(params.get("next"));
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getBrowserSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="glass w-full max-w-md p-8 md:p-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent/80">
        Private library
      </p>

      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">
        Nosramus
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        Sign in to import papers and ask questions with citations back to the
        source passage.
      </p>

      <button
        onClick={signIn}
        disabled={loading}
        className="btn-primary mt-8 h-11 w-full px-6 text-sm"
      >
        {loading ? "Redirecting..." : "Continue with Google"}
      </button>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="app-bg flex min-h-screen items-center justify-center px-6 py-16">
      <div className="app-bg-main w-full max-w-md">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
