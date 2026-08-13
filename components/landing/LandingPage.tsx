import Link from "next/link";
import LandingNav from "./LandingNav";

const pillars = [
  {
    label: "01",
    title: "Your PDFs stay yours",
    body: "Import from arXiv, Semantic Scholar, or upload directly. Every chunk lives in your private library with row-level security.",
  },
  {
    label: "02",
    title: "Answers cite the passage",
    body: "Retrieval pulls exact excerpts. The model answers from those passages only, with bracketed references you can inspect.",
  },
  {
    label: "03",
    title: "Verify in one click",
    body: "Each citation opens the quoted text, paper title, page, and section. No hunting through a 40-page PDF blind.",
  },
];

function ManuscriptPreview() {
  return (
    <div className="landing-manuscript relative">
      <div className="landing-margin-rule" aria-hidden />
      <div className="relative space-y-5 p-6 md:p-8">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <span>Excerpt · p. 4</span>
          <span>Attention Is All You Need</span>
        </div>

        <blockquote className="border-l-2 border-accent/40 pl-4 text-sm leading-relaxed text-muted">
          Scaled dot-product attention computes compatibility between queries and
          keys, then applies a softmax to obtain weights on the values.
        </blockquote>

        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-xl border border-edge bg-elevated/70 px-4 py-2.5 text-sm">
            How is attention computed in the Transformer?
          </div>
        </div>

        <div className="space-y-2 text-sm leading-relaxed">
          <p>
            The paper defines attention as{" "}
            <strong className="font-medium text-foreground">
              softmax(QK<sup>T</sup> / √d<sub>k</sub>)V
            </strong>
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded border border-edge bg-elevated font-mono text-[0.6rem] text-accent">
              1
            </span>
            . Multi-head attention runs h parallel heads, concatenates, and projects
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded border border-edge bg-elevated font-mono text-[0.6rem] text-accent">
              2
            </span>
            .
          </p>
        </div>

        <div className="border-t border-edge/80 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Source
          </p>
          <p className="mt-1.5 text-sm text-muted">
            <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded border border-edge font-mono text-xs text-accent">
              1
            </span>
            Vaswani et al. · Section 3.2 · page 4
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="app-bg min-h-screen">
      <LandingNav />

      <div className="app-bg-main">
        <main>
          <section className="landing-hero mx-auto max-w-6xl px-6 pb-16 pt-24 md:px-8 md:pb-24 md:pt-28">
            <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div className="max-w-xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent/90">
                  Research reading, instrumented
                </p>

                <h1 className="mt-4 font-display text-[2.35rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.25rem]">
                  Questions in.
                  <span className="mt-1 block text-muted">Cited passages out.</span>
                </h1>

                <p className="mt-6 text-base leading-relaxed text-muted md:text-lg">
                  Nosramus is a reading desk for PDFs you already trust. It retrieves
                  the relevant lines from your library, writes an answer on top of
                  them, and leaves a trail of citations you can audit.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/login" className="btn-primary h-11 px-7 text-sm">
                    Open your library
                  </Link>
                  <a href="#workflow" className="btn-secondary h-11 px-7 text-sm">
                    See the workflow
                  </a>
                </div>

                <p className="mt-6 text-xs leading-relaxed text-muted/80">
                  Sign in with Google. Papers are scoped to your account. No public
                  corpus, no mystery sources.
                </p>
              </div>

              <ManuscriptPreview />
            </div>
          </section>

          <section id="workflow" className="border-t border-edge/50 py-16 md:py-24">
            <div className="mx-auto max-w-6xl px-6 md:px-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                    How a session works
                  </h2>
                  <p className="mt-2 max-w-lg text-muted">
                    Three moves. No prompt-engineering ritual required.
                  </p>
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                  Library → Chat → Sources
                </p>
              </div>

              <ol className="mt-10 grid gap-5 md:grid-cols-3">
                {pillars.map((p) => (
                  <li
                    key={p.label}
                    className="landing-pillar relative rounded-xl border border-edge/80 bg-elevated/20 p-6"
                  >
                    <span className="font-mono text-sm text-accent">{p.label}</span>
                    <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
                      {p.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="border-t border-edge/50 py-16 md:py-24">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2 md:px-8">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  Built for proof, not vibes
                </h2>
                <ul className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    Hybrid vector + keyword retrieval with reranking before the model sees anything.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    Agent can run multiple library searches on comparative questions.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    Conflicting claims between papers surface in a dedicated panel.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    Structured facts extracted at ingest time show up in your library view.
                  </li>
                </ul>
              </div>

              <div className="landing-stack rounded-xl border border-edge/80 p-6 md:p-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  Under the hood
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ["Retrieval", "pgvector + full-text + RRF + Voyage rerank"],
                    ["Generation", "Claude streaming with citation renumbering"],
                    ["Storage", "Supabase auth, RLS, private PDF bucket"],
                    ["Ingest", "Section-aware chunking, batched embeddings"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                      <dt className="w-24 shrink-0 font-medium text-foreground">{k}</dt>
                      <dd className="text-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <section className="border-t border-edge/50 py-16 md:py-20">
            <div className="mx-auto max-w-6xl px-6 md:px-8">
              <div className="landing-cta rounded-2xl border border-edge px-8 py-10 text-center md:px-14 md:py-12">
                <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  Start with one paper you already know
                </h2>
                <p className="mx-auto mt-3 max-w-md text-muted">
                  Import a PDF, ask a question you know the answer to, and check
                  whether the citations land where you expect.
                </p>
                <Link href="/login" className="btn-primary mt-7 inline-flex h-11 px-8 text-sm">
                  Sign in and try it
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-edge/50 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 text-sm text-muted md:flex-row md:items-center md:px-8">
            <span className="font-display text-base font-semibold tracking-tight text-foreground">
              Nosramus
            </span>
            <p className="max-w-md leading-relaxed">
              A private research library with cited answers. Made for people who
              read papers carefully.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
