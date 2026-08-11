import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  const envVar = (key: string, required = true) => {
    const value = process.env[key];
    checks.push({
      name: key,
      ok: required ? Boolean(value) : true,
      detail: value ? "set" : required ? "MISSING" : "not set (optional)",
    });
  };

  envVar("NEXT_PUBLIC_SUPABASE_URL");
  envVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  envVar("SUPABASE_SERVICE_ROLE_KEY");
  envVar("ANTHROPIC_API_KEY");

  const provider = process.env.EMBEDDING_PROVIDER || "voyage";
  envVar(provider === "openai" ? "OPENAI_API_KEY" : "VOYAGE_API_KEY");
  envVar("SEMANTIC_SCHOLAR_API_KEY", false);

  // ---- database ----
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    checks.push({
      name: "Signed in",
      ok: Boolean(user),
      detail: user ? `${user.email} (${user.id})` : "no session",
    });

    for (const table of ["papers", "chunks", "conversations", "messages"]) {
      const { error } = await supabase.from(table).select("id", { head: true, count: "exact" });
      checks.push({
        name: `table: ${table}`,
        ok: !error,
        detail: error ? error.message : "reachable",
      });
    }

    const { error: rpcError } = await supabase.rpc("match_chunks", {
      query_embedding: new Array(1024).fill(0),
      match_user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      match_count: 1,
      filter_paper_ids: null,
      min_similarity: 0,
    });
    checks.push({
      name: "rpc: match_chunks",
      ok: !rpcError,
      detail: rpcError ? rpcError.message : "callable (pgvector installed)",
    });

    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    checks.push({
      name: "storage bucket: papers",
      ok: !bucketError && Boolean(buckets?.some((b) => b.name === "papers")),
      detail: bucketError
        ? bucketError.message
        : buckets?.some((b) => b.name === "papers")
          ? "exists"
          : "MISSING - run the migration",
    });
  } catch (err) {
    checks.push({
      name: "Supabase connection",
      ok: false,
      detail: err instanceof Error ? err.message : "failed",
    });
  }

  return checks;
}

export default async function SetupPage() {
  const checks = await runChecks();
  const failing = checks.filter((c) => !c.ok).length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Setup check</h1>
      <p className="mt-2 text-muted">
        {failing === 0
          ? "Everything looks configured. You can start adding papers."
          : `${failing} item${failing === 1 ? "" : "s"} still need attention.`}
      </p>

      <ul className="mt-8 divide-y divide-edge rounded-xl border border-edge">
        {checks.map((c) => (
          <li key={c.name} className="flex items-start gap-3 px-4 py-3">
            <span className={c.ok ? "text-green-500" : "text-red-500"}>
              {c.ok ? "OK" : "!!"}
            </span>
            <div className="min-w-0">
              <div className="font-mono text-sm">{c.name}</div>
              <div className="truncate text-sm text-muted">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>

      <Link href="/chat" className="mt-8 inline-block text-accent hover:underline">
        Go to chat
      </Link>
    </main>
  );
}
