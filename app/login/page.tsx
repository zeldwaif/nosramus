"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const next = params.get("next") ?? "/chat";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-semibold tracking-tight">Nosramus</h1>
      <p className="mt-3 text-muted leading-relaxed">
        Ask questions of your research papers and get answers grounded in the
        source text, with citations back to the passage.
      </p>

      <button
        onClick={signIn}
        disabled={loading}
        className="mt-8 w-full rounded-lg border border-edge bg-surface px-5 py-3 font-medium transition-colors hover:bg-edge disabled:opacity-50"
      >
        {loading ? "Redirecting..." : "Continue with Google"}
      </button>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
