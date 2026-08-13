/**
 * Retrieval + answer quality evaluation against eval/golden-set.json.
 *
 * Requires .env.local with Supabase + Anthropic keys. Signs in as EVAL_USER_EMAIL /
 * EVAL_USER_PASSWORD (must own an ingested copy of the golden-set paper) or falls back
 * to the first user who owns a ready paper matching each question's paper_arxiv_id.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { retrieve } from "../lib/retrieval";
import { buildContext, SYSTEM_PROMPT } from "../lib/prompt";
import { anthropic, MODEL } from "../lib/anthropic";
import { createAdminClient } from "../lib/supabase/admin";

interface GoldenQuestion {
  id: string;
  question: string;
  paper_arxiv_id: string;
  expected_keywords: string[];
  expected_answer_summary: string;
}

interface QuestionResult {
  id: string;
  question: string;
  paper_arxiv_id: string;
  skipped: boolean;
  skip_reason?: string;
  retrieval_hit: boolean;
  keywords_found: string[];
  keywords_missing: string[];
  retrieved_chunk_count: number;
  faithfulness_score: number | null;
  faithfulness_reasoning: string | null;
  answer_preview: string;
}

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* .env.local optional if vars already set */
  }
}

function keywordHit(chunks: { content: string }[], keywords: string[]) {
  const corpus = chunks.map((c) => c.content.toLowerCase()).join("\n");
  const found: string[] = [];
  const missing: string[] = [];
  for (const kw of keywords) {
    if (corpus.includes(kw.toLowerCase())) found.push(kw);
    else missing.push(kw);
  }
  return { hit: found.length > 0, found, missing };
}

async function judgeFaithfulness(
  answer: string,
  excerpts: string
): Promise<{ score: number; reasoning: string }> {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [
      {
        name: "score_faithfulness",
        description:
          "Score whether every factual claim in the answer is supported by the excerpts.",
        input_schema: {
          type: "object",
          properties: {
            score: {
              type: "integer",
              description: "1-5 integer. 5 = every claim fully supported.",
            },
            reasoning: {
              type: "string",
              description: "Brief justification for the score.",
            },
          },
          required: ["score", "reasoning"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "score_faithfulness" },
    messages: [
      {
        role: "user",
        content: `Score the faithfulness of this answer to the provided excerpts.

<excerpts>
${excerpts}
</excerpts>

<answer>
${answer}
</answer>

Use score_faithfulness. Score 1-5 where 5 means every claim is directly supported.`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Judge did not return tool output");
  }
  const input = block.input as { score: number; reasoning: string };
  return { score: input.score, reasoning: input.reasoning };
}

async function generateAnswer(question: string, chunks: Awaited<ReturnType<typeof retrieve>>) {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${buildContext(chunks)}\n\nQuestion: ${question}`,
      },
    ],
  });
  const text = res.content.find((b) => b.type === "text");
  return text?.type === "text" ? text.text : "";
}

async function resolveEvalClient() {
  const email = process.env.EVAL_USER_EMAIL;
  const password = process.env.EVAL_USER_PASSWORD;

  if (email && password) {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(`Eval sign-in failed: ${error?.message}`);
    return {
      supabase: createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
          auth: { persistSession: false },
        }
      ),
      userId: data.user!.id,
    };
  }

  throw new Error(
    "Set EVAL_USER_EMAIL and EVAL_USER_PASSWORD in .env.local to a user who owns the golden-set papers."
  );
}

async function findPaper(admin: ReturnType<typeof createAdminClient>, arxivId: string, userId: string) {
  const { data } = await admin
    .from("papers")
    .select("id, user_id, title, status, source_id")
    .eq("source", "arxiv")
    .eq("source_id", arxivId)
    .eq("user_id", userId)
    .eq("status", "ready")
    .maybeSingle();
  return data;
}

function printTable(results: QuestionResult[]) {
  const header = ["ID", "Retrieval", "Faith", "Chunks", "Status"];
  const rows = results.map((r) => [
    r.id,
    r.skipped ? "—" : r.retrieval_hit ? "HIT" : "MISS",
    r.skipped ? "—" : r.faithfulness_score?.toString() ?? "ERR",
    r.skipped ? "—" : String(r.retrieved_chunk_count),
    r.skipped ? `SKIP: ${r.skip_reason}` : "OK",
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length))
  );
  const fmt = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i])).join("  ");

  console.log("\n" + fmt(header));
  console.log(fmt(widths.map((w) => "-".repeat(w))));
  for (const row of rows) console.log(fmt(row));
}

async function main() {
  loadEnv();

  const goldenPath = resolve(process.cwd(), "eval/golden-set.json");
  const questions = JSON.parse(readFileSync(goldenPath, "utf8")) as GoldenQuestion[];
  const { supabase, userId } = await resolveEvalClient();
  const admin = createAdminClient();

  const results: QuestionResult[] = [];

  for (const q of questions) {
    console.log(`\n▶ ${q.id}: ${q.question.slice(0, 60)}...`);

    const paper = await findPaper(admin, q.paper_arxiv_id, userId);
    if (!paper) {
      console.warn(`  ⚠ Paper ${q.paper_arxiv_id} not found for user — skipping`);
      results.push({
        id: q.id,
        question: q.question,
        paper_arxiv_id: q.paper_arxiv_id,
        skipped: true,
        skip_reason: `No ready paper with arxiv id ${q.paper_arxiv_id}`,
        retrieval_hit: false,
        keywords_found: [],
        keywords_missing: q.expected_keywords,
        retrieved_chunk_count: 0,
        faithfulness_score: null,
        faithfulness_reasoning: null,
        answer_preview: "",
      });
      continue;
    }

    const chunks = await retrieve(supabase, {
      query: q.question,
      paperIds: [paper.id as string],
    });

    const { hit, found, missing } = keywordHit(chunks, q.expected_keywords);
    console.log(`  Retrieval: ${hit ? "HIT" : "MISS"} (${found.length}/${q.expected_keywords.length} keywords)`);

    let answer = "";
    let faithScore: number | null = null;
    let faithReason: string | null = null;

    if (chunks.length > 0) {
      answer = await generateAnswer(q.question, chunks);
      const excerptText = chunks.map((c) => c.content).join("\n---\n");
      try {
        const judged = await judgeFaithfulness(answer, excerptText);
        faithScore = judged.score;
        faithReason = judged.reasoning;
        console.log(`  Faithfulness: ${faithScore}/5`);
      } catch (err) {
        console.warn(`  ⚠ Judge failed: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      console.warn("  ⚠ No chunks retrieved — skipping generation/judge");
    }

    results.push({
      id: q.id,
      question: q.question,
      paper_arxiv_id: q.paper_arxiv_id,
      skipped: false,
      retrieval_hit: hit,
      keywords_found: found,
      keywords_missing: missing,
      retrieved_chunk_count: chunks.length,
      faithfulness_score: faithScore,
      faithfulness_reasoning: faithReason,
      answer_preview: answer.slice(0, 300),
    });
  }

  const evaluated = results.filter((r) => !r.skipped);
  const hitRate =
    evaluated.length === 0
      ? 0
      : evaluated.filter((r) => r.retrieval_hit).length / evaluated.length;
  const faithScores = evaluated
    .map((r) => r.faithfulness_score)
    .filter((s): s is number => s != null);
  const avgFaith =
    faithScores.length === 0
      ? 0
      : faithScores.reduce((a, b) => a + b, 0) / faithScores.length;

  const summary = {
    run_at: new Date().toISOString(),
    total: results.length,
    evaluated: evaluated.length,
    skipped: results.length - evaluated.length,
    retrieval_hit_rate: hitRate,
    average_faithfulness: avgFaith,
    results,
  };

  mkdirSync(resolve(process.cwd(), "eval"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "eval/results.json"),
    JSON.stringify(summary, null, 2)
  );

  printTable(results);
  console.log("\n── Summary ──");
  console.log(`Evaluated: ${evaluated.length}/${results.length}`);
  console.log(`Retrieval hit rate: ${(hitRate * 100).toFixed(1)}%`);
  console.log(`Average faithfulness: ${avgFaith.toFixed(2)}/5`);
  console.log("Full results → eval/results.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
