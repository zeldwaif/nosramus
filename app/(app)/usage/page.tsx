import { createClient } from "@/lib/supabase/server";

function formatUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default async function UsagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: logs } = await supabase
    .from("query_logs")
    .select(
      "retrieval_ms, generation_ms, input_tokens, output_tokens, estimated_cost_usd, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = logs ?? [];
  const totalQueries = rows.length;
  const totalCost = rows.reduce(
    (s, r) => s + Number(r.estimated_cost_usd ?? 0),
    0
  );
  const avgLatency =
    totalQueries === 0
      ? 0
      : rows.reduce(
          (s, r) => s + (r.retrieval_ms ?? 0) + (r.generation_ms ?? 0),
          0
        ) / totalQueries;

  const byDay = new Map<
    string,
    { queries: number; cost: number; latency: number }
  >();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    const entry = byDay.get(day) ?? { queries: 0, cost: 0, latency: 0 };
    entry.queries += 1;
    entry.cost += Number(r.estimated_cost_usd ?? 0);
    entry.latency += (r.retrieval_ms ?? 0) + (r.generation_ms ?? 0);
    byDay.set(day, entry);
  }

  const daily = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, stats]) => ({
      date,
      queries: stats.queries,
      cost: stats.cost,
      avgLatency: stats.queries ? stats.latency / stats.queries : 0,
    }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
        Usage
      </h1>
      <p className="mt-2 text-muted">
        Query latency, token usage, and estimated API cost for your account.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="glass p-4">
          <div className="font-mono text-xs uppercase tracking-wide text-muted">
            Total queries
          </div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {totalQueries}
          </div>
        </div>
        <div className="glass p-4">
          <div className="font-mono text-xs uppercase tracking-wide text-muted">
            Est. cost
          </div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {formatUsd(totalCost)}
          </div>
        </div>
        <div className="glass p-4">
          <div className="font-mono text-xs uppercase tracking-wide text-muted">
            Avg latency
          </div>
          <div className="mt-1 font-display text-2xl font-semibold">
            {formatMs(Math.round(avgLatency))}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display font-medium">Daily breakdown</h2>
        {daily.length === 0 ? (
          <p className="text-muted">No queries logged yet.</p>
        ) : (
          <div className="glass overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-edge text-muted">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Queries</th>
                  <th className="px-4 py-3 font-medium">Est. cost</th>
                  <th className="px-4 py-3 font-medium">Avg latency</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.date} className="border-b border-edge/50">
                    <td className="px-4 py-3">{d.date}</td>
                    <td className="px-4 py-3">{d.queries}</td>
                    <td className="px-4 py-3">{formatUsd(d.cost)}</td>
                    <td className="px-4 py-3">{formatMs(Math.round(d.avgLatency))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
