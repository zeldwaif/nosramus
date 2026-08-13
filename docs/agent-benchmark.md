# Nosramus Competitive Benchmark & Portfolio Strategy

**Date:** August 11, 2026  
**Scope:** `app/`, `components/`, `lib/`, landing page, Supabase schema  
**Benchmark set:** Elicit, Consensus, Semantic Scholar, Linear, Raycast, Notion AI, Perplexity, Zotero, Research Rabbit

---

## Executive Summary

Nosramus is a credible full-stack RAG research assistant: import papers (arXiv, Semantic Scholar, PDF), section-aware chunking, pgvector retrieval, streaming Claude answers with post-hoc citation filtering. The engineering bones are solid — RLS-hardened vector search, provider-agnostic embeddings, NDJSON streaming, and a thoughtful system prompt in `lib/prompt.ts`.

For a **portfolio project aimed at hiring managers**, the gap is not capability — it is **demonstrability**. Competitors win on first-impression UX (Perplexity's source panel, Linear's keyboard flow, Raycast's command palette) and on **visible depth** (Elicit's structured extraction, Zotero's reference graph, Research Rabbit's discovery maps). Nosramus currently reads as "competent side project" rather than "this person ships product-quality research tools."

This report maps those gaps to specific files and ranked improvements.

---

## 1. What Top Products Do Better

### Research & Evidence Products

| Product | What they do better | Nosramus gap (file evidence) |
|---------|---------------------|--------------------------------|
| **Elicit** | Structured literature workflows: screening columns, extraction tables (methods, sample size, outcomes), batch paper analysis, exportable research tables | Nosramus is chat-only. No structured output, no table view, no batch Q&A across papers. `LibraryView.tsx` is a flat list; `ChatView.tsx` returns prose only. |
| **Consensus** | Instant search across 200M+ papers without import; Yes/No/Maybe consensus meter; evidence strength badges; Copilot cards with synthesized takeaways | Nosramus requires import + ingestion wait (`LibraryView.tsx` polls every 3s). No evidence-strength UI. No instant "search the literature" mode — only "search your library." |
| **Semantic Scholar** | 200M-paper index, citation graphs, influential citations, author/venue pages, TLDR summaries, Semantic Reader (in-PDF highlights), alerts, reading lists | Nosramus uses S2 only as an import source (`lib/sources/semanticScholar.ts`). No citation graph, no paper detail page, no in-PDF reading, no alerts. Citations show a 400-char quote (`Citations.tsx` line 39) but no link to stored PDF. |
| **Perplexity** | Real-time web answers with inline source chips, expandable source sidebar, related questions, follow-up chips, Pro/Deep Research modes | Nosramus streams well (`app/api/chat/route.ts`) but has no related-question suggestions, no source sidebar during streaming, no "Pro" depth toggle. Empty state in `ChatView.tsx` is a single line of copy — no starter prompts. |
| **Zotero** | Reference management (tags, collections, BibTeX), browser extension capture, PDF annotation, citation export (APA/MLA), Word/Docs plugins, cross-device sync | Nosramus has no tags, collections, folders, annotations, or export. `papers` table (`0001_init.sql`) stores metadata but UI exposes only title/authors/year. Delete is the only paper action (`LibraryView.tsx` line 256). |
| **Research Rabbit** | Visual discovery graph, "add to collection" trails, author/topic following, collaborative collections, serendipitous paper suggestions | Nosramus has no discovery, recommendations, or visual graph. Import is intentional search-or-paste only (`LibraryView.tsx` lines 135–166). |

### UX Reference Products

| Product | What they do better | Nosramus gap (file evidence) |
|---------|---------------------|--------------------------------|
| **Linear** | Sub-100ms navigation, keyboard-first everything, command palette, satisfying micro-interactions, persistent sidebar state, issue detail panels | Nosramus sidebar (`Sidebar.tsx`) is functional but has no keyboard shortcuts, no rename conversation (title is derived once in `deriveTitle()`), delete-only on hover. No loading skeletons — just "Loading..." text. |
| **Raycast** | Global `Cmd+K` command palette, fuzzy search across all actions, aliases, snippets, instant feedback | Nosramus has no command palette, no `Cmd+K`, no fuzzy search over conversations/papers. Navigation is click-only between `/chat` and `/library`. |
| **Notion AI** | Inline AI in context of structured blocks, slash commands, templates, workspace-aware generation, block-level regeneration | Nosramus AI is isolated to chat. No slash commands, no templates ("Summarize methods", "Compare papers"), no inline actions on library items. |

### Cross-cutting gaps

1. **No PDF viewer** — citations quote text but cannot jump to the page in the original PDF (`storage_path` exists in schema but is never surfaced in UI).
2. **No demo without signup** — landing page CTA goes straight to `/login` (`LandingPage.tsx` line 143). Hiring managers won't create a Google account to evaluate.
3. **No visible test/CI story** — no `__tests__/`, no GitHub Actions, no coverage badge.
4. **Ingestion latency is exposed raw** — "Processing... extraction and embedding can take a minute" (`LibraryView.tsx` line 170) with no progress bar or chunk count feedback.
5. **Paper scope not persisted mid-conversation** — `ChatView.tsx` sends `paperIds` on each message but never writes scope changes back to `conversations.paper_ids`; reloading loses scope changes.

---

## 2. What Nosramus Does Uniquely Well

These are genuine differentiators worth leading with in portfolio materials — not generic "we use RAG" claims.

### 2.1 Epistemic system prompt (research-native, not chatbot-native)

`lib/prompt.ts` instructs the model to distinguish claims from evidence, note sample sizes, present disagreements, and refuse to hallucinate when excerpts are insufficient. This is closer to how a good RA thinks than Consensus's Yes/No framing or Perplexity's general-knowledge synthesis.

**Portfolio angle:** "Designed prompt engineering for scientific epistemology, not just Q&A."

### 2.2 Post-hoc citation integrity

`app/api/chat/route.ts` (lines 129–141) filters citations to only those the model actually referenced, then renumbers them in order of appearance. Many RAG demos pre-show all retrieved chunks as "sources" even when unused — Nosramus doesn't.

**Portfolio angle:** "Built citation verification pipeline — sources match claims, not retrieval candidates."

### 2.3 Section- and page-aware chunking with overlap

`lib/chunking.ts` detects section headings (Abstract, Methods, Results…), tracks page numbers, keeps paragraphs intact, and carries overlap across chunk boundaries. This is more thoughtful than naive fixed-token splitting.

**Portfolio angle:** "Domain-aware document segmentation for scientific PDFs."

### 2.4 Per-paper retrieval cap

`lib/retrieval.ts` over-fetches then caps chunks per paper (`perPaperCap = 5`) so one long document can't crowd out others. Simple but shows understanding of multi-document RAG failure modes.

### 2.5 Security-hardened vector search

Migration `0002_harden_match_chunks.sql` binds `match_chunks` to `auth.uid()` via `security invoker` instead of trusting client-supplied user IDs. RLS on all tables. This is production-minded — mention it explicitly in interviews.

### 2.6 Multi-source import with identifier resolution

`lib/sources/resolve.ts` handles arXiv IDs, DOI, S2 paper IDs, and free-text search across arXiv + S2 with deduplication (`app/api/papers/search/route.ts` lines 33–39). Practical and well-scoped.

### 2.7 Provider-agnostic embedding layer

`lib/embeddings.ts` supports Voyage and OpenAI at fixed 1024 dimensions with batched ingestion. Shows API abstraction discipline.

### 2.8 Setup health check page

`app/setup/page.tsx` validates env vars, table access, RPC, and storage bucket. Unusual in portfolio projects — signals ops awareness.

### 2.9 Clean design system with intentional aesthetic

`app/globals.css` defines a cohesive dark + green-accent system (glass cards, glow buttons, prose-answer typography). Landing page (`LandingPage.tsx`) and app shell share the same language. Better visual polish than most portfolio RAG demos.

### 2.10 Full-stack streaming architecture

NDJSON stream with typed events (`start`, `citations`, `delta`, `done`, `error`) in `app/api/chat/route.ts`; client-side incremental render in `ChatView.tsx`. Demonstrates real-time UX engineering, not just `fetch` + wait.

---

## 3. Ten Improvements Ranked by Portfolio Impact

Ranked for **employer/hiring-manager impression** — what makes someone stop scrolling and click "Schedule interview."

---

### #1 — Public interactive demo (no login required)

**Impact:** ★★★★★ — Hiring managers evaluate in 30 seconds or bounce.

**Current state:** `app/page.tsx` redirects authenticated users to `/chat`; unauthenticated users see landing page with "Start for free" → `/login` only.

**Recommendation:**
- Add `/demo` route with a pre-seeded read-only conversation (Transformer paper or similar) using static JSON or a public Supabase anon bucket.
- Landing hero CTA: "Try the demo" (primary) + "Sign in" (secondary).
- Record a 45-second screen capture embedded in `LandingPage.tsx` hero as fallback.

**Files:** `app/demo/page.tsx` (new), `components/landing/LandingPage.tsx`, `public/demo/` (seed data)

**Interview line:** "Reduced eval friction to zero — demo works without API keys or signup."

---

### #2 — PDF viewer with citation highlight jump

**Impact:** ★★★★★ — Proves full-stack depth; closes the biggest UX gap vs Semantic Scholar / Zotero.

**Current state:** PDFs stored at `storage_path` (`app/api/papers/import/route.ts` line 94) but never rendered. Citations scroll to a quote block (`Citations.tsx`), not the source page.

**Recommendation:**
- Add `/library/[id]` paper detail page with embedded PDF viewer (PDF.js or `react-pdf`).
- "Open in PDF" button on each citation jumps to `page` from `Citation.page`.
- Optional: highlight the quoted span if page text offsets are stored (extend `chunks` schema later).

**Files:** `app/(app)/library/[id]/page.tsx` (new), `components/PdfViewer.tsx` (new), `components/Citations.tsx`, `app/api/papers/[id]/pdf/route.ts` (new, signed URL)

**Interview line:** "Closed the loop from AI answer → verifiable source in original document."

---

### #3 — Command palette + keyboard shortcuts (Linear/Raycast tier)

**Impact:** ★★★★☆ — Signals UX craft immediately; rare in portfolio projects.

**Current state:** No keyboard navigation. `Sidebar.tsx` and `ChatView.tsx` are mouse-only.

**Recommendation:**
- `Cmd+K` / `Ctrl+K` opens palette: New chat, Go to library, Search papers, Switch conversation, Toggle paper scope.
- `Cmd+Enter` to send message; `Cmd+Shift+C` to copy last answer with citations.
- Show shortcut hints in empty chat state.

**Files:** `components/CommandPalette.tsx` (new), `app/(app)/layout.tsx`, `components/ChatView.tsx`

**Interview line:** "Keyboard-first navigation — sub-200ms actions across the app."

---

### #4 — Architecture & engineering story on landing page

**Impact:** ★★★★☆ — Hiring managers for full-stack/ML roles want to see system design literacy.

**Current state:** Landing page (`LandingPage.tsx`) has marketing copy only. `README.md` has a file tree but no diagram.

**Recommendation:**
- Add `#architecture` section to landing with animated pipeline diagram: Import → Extract → Chunk → Embed → Retrieve → Stream → Cite.
- Link to `docs/architecture.md` with sequence diagrams (Mermaid), data model, and security notes (RLS, `security invoker`).
- Add tech stack badges (Next.js 16, Supabase, pgvector, Claude, Voyage).

**Files:** `components/landing/LandingPage.tsx`, `components/landing/ArchitectureSection.tsx` (new), `docs/architecture.md` (new)

**Interview line:** "Documented the RAG pipeline end-to-end with security and scaling considerations."

---

### #5 — Starter prompts + suggested follow-ups in chat

**Impact:** ★★★★☆ — Makes the product feel alive on first open; Perplexity does this well.

**Current state:** Empty state in `ChatView.tsx` (lines 137–146) is static text. No follow-up chips after answers.

**Recommendation:**
- Empty state: 4 clickable starter prompts ("Summarize the main contribution", "What methods were used?", "What are the limitations?", "Compare findings across my library").
- After each assistant message: 2–3 contextual follow-up chips (generate via lightweight second Claude call or template from last question).
- Persist paper scope chip showing active filter.

**Files:** `components/ChatView.tsx`, `components/SuggestedPrompts.tsx` (new)

---

### #6 — Test suite + CI badge

**Impact:** ★★★★☆ — Separates "demo" from "engineered software" in reviewer minds.

**Current state:** No tests. `package.json` has `typecheck` and `lint` only.

**Recommendation:**
- Unit tests: `lib/chunking.ts` (section detection, overlap), `lib/retrieval.ts` (cap logic), citation renumbering logic extracted from `route.ts`.
- Integration test: mock Supabase + embedding, verify `buildContext()` output.
- GitHub Actions: `typecheck`, `lint`, `test` on PR.
- Add CI badge to `README.md` and landing footer.

**Files:** `lib/__tests__/chunking.test.ts` (new), `.github/workflows/ci.yml` (new), `README.md`

---

### #7 — Paper detail page with metadata + re-ingest

**Impact:** ★★★☆☆ — Shows CRUD completeness and library-as-product thinking.

**Current state:** Library is a flat list (`LibraryView.tsx`). No way to view abstract, see chunk count, or re-process a failed paper.

**Recommendation:**
- Click paper title → `/library/[id]` with: metadata, abstract, ingestion status, chunk count, "Re-process" button, "Chat about this paper" shortcut (pre-scopes `PaperPicker`).
- Show ingestion timeline: pending → processing → ready with timestamps.

**Files:** `app/(app)/library/[id]/page.tsx`, `components/LibraryView.tsx`, `app/api/papers/[id]/route.ts` (extend GET)

---

### #8 — Live deployment with seeded showcase library

**Impact:** ★★★☆☆ — A URL in the resume beats "clone and configure 6 API keys."

**Current state:** Requires Supabase + Anthropic + Voyage setup (`SETUP.md`, `app/setup/page.tsx`).

**Recommendation:**
- Deploy to Vercel with env vars configured.
- Seed a demo account with 5 canonical papers (Attention Is All You Need, BERT, GPT-3, LoRA, RLHF).
- Add live URL prominently on landing page and README.
- `/setup` should not be linked publicly but demonstrates ops thinking in code review.

**Files:** `README.md`, `LandingPage.tsx`, `scripts/seed-demo.mjs` (new)

---

### #9 — Source panel during streaming (Perplexity-style)

**Impact:** ★★★☆☆ — Makes RAG tangible while answer generates.

**Current state:** Citations appear after stream starts (`event.type === "citations"` in `ChatView.tsx` line 93) but render below the draft answer, not in a dedicated panel.

**Recommendation:**
- Split chat layout: answer left (or full width mobile), collapsible "Sources" panel right showing retrieved excerpts with similarity scores and section/page labels.
- Highlight which sources are cited as `[n]` markers appear in stream (live sync).
- Surface `similarity` from `RetrievedChunk` (already returned by RPC, stripped before UI today).

**Files:** `components/ChatView.tsx`, `components/SourcePanel.tsx` (new), `app/api/chat/route.ts` (include similarity in citation payload)

---

### #10 — Conversation management polish

**Impact:** ★★★☆☆ — Small but signals attention to daily-use UX (Linear benchmark).

**Current state:** `Sidebar.tsx` shows conversations with delete-on-hover only. No rename, no search, no pin.

**Recommendation:**
- Double-click or `F2` to rename (wire to existing `app/api/conversations/[id]/route.ts` PATCH if present, or add).
- Persist `paperIds` scope changes to `conversations.paper_ids` on each send (`ChatView.tsx` + `app/api/chat/route.ts`).
- Relative timestamps ("2h ago") on conversation list.
- Search/filter conversations by title.

**Files:** `components/Sidebar.tsx`, `components/ChatView.tsx`, `app/api/chat/route.ts`

---

## 4. Five Original Feature Ideas (Not Copied from Competitors)

These are designed to be **defensible in interviews** as novel product thinking, not "we added what Elicit has."

---

### 4.1 Contradiction Radar

**Concept:** When retrieved chunks from different papers make conflicting claims (e.g., opposite effect directions, incompatible sample sizes), Nosramus surfaces a structured **Disagreement Panel** alongside the answer — not buried in prose.

**Why it's original:** Elicit extracts fields; Consensus gives Yes/No; neither explicitly maps *cross-paper conflict* as a first-class UI element. Perplexity synthesizes away disagreements.

**Implementation sketch:**
- After retrieval in `lib/retrieval.ts`, cluster chunks by paper; run a lightweight Claude call: "Do these excerpts disagree on [user question]? Return structured JSON."
- New component `components/ContradictionPanel.tsx` renders side-by-side quotes with paper labels.
- Toggle in `PaperPicker.tsx`: "Highlight disagreements."

**Portfolio line:** "Built cross-document conflict detection for research synthesis."

---

### 4.2 Methodology Lens

**Concept:** A toggle that reweights retrieval toward Methods/Results/Limitations sections (using existing `section` field from `lib/chunking.ts`) instead of treating all chunks equally.

**Why it's original:** Not a filter UI like Elicit columns — it's a **retrieval-mode switch** that changes what evidence counts. Researchers constantly ask "how" vs "what" vs "should I trust this."

**Implementation sketch:**
- Add `lens: 'balanced' | 'methods' | 'results' | 'limitations'` to chat request body.
- In `match_chunks` RPC or post-filter in `lib/retrieval.ts`, boost chunks where `section` matches lens (cosine score × 1.3).
- Pill toggle above chat input in `ChatView.tsx`.

**Portfolio line:** "Section-aware retrieval modes for question-type-specific evidence."

---

### 4.3 Claim Ledger

**Concept:** Each assistant answer decomposes into atomic **claims**, each permanently linked to citation(s). Over a conversation, claims accumulate into an exportable ledger — a living lit-review outline.

**Why it's original:** Zotero stores references; Elicit stores extractions; neither builds a **session-persistent claim graph** from chat. This turns ephemeral Q&A into durable research artifact.

**Implementation sketch:**
- New table `claims (id, conversation_id, text, citation_ids[], created_at)`.
- Post-process assistant messages in `app/api/chat/route.ts` with structured output extraction.
- `components/ClaimLedger.tsx` sidebar tab; export as Markdown or BibTeX-annotated outline.

**Portfolio line:** "Converted conversational RAG into structured research artifacts."

---

### 4.4 Reading Queue with Gap Detection

**Concept:** When Nosramus can't answer from the library ("excerpts don't cover this"), it doesn't just stop — it suggests **what kind of paper is missing** and offers one-click import from arXiv/S2.

**Why it's original:** Research Rabbit suggests related papers for discovery; this is **query-driven gap filling** — the system tells you what's absent from *your* library to answer *your* question.

**Implementation sketch:**
- Extend system prompt or add post-answer step: extract `missing_topics[]`.
- Call `app/api/papers/search/route.ts` for each topic; show "Add to library" cards inline in chat.
- Optional: `reading_queue` table with priority scores.

**Portfolio line:** "Query-aware library gap detection with automated literature suggestions."

---

### 4.5 Reproducibility Hints (Heuristic, Not ML Magic)

**Concept:** During ingestion, regex/LLM-extract signals from paper text: reported sample size, code/data availability statements, preregistration mentions, conflict-of-interest disclosures. Surface as neutral **Reproducibility Hints** on paper detail — not a score, not a judgment.

**Why it's original:** Consensus has "evidence strength"; this is **transparent heuristic surfacing** from the paper's own words, avoiding black-box scoring. Shows responsible AI product design.

**Implementation sketch:**
- `lib/reproSignals.ts` extracts patterns during `lib/ingest.ts`.
- Store in `papers.metadata jsonb` column (migration).
- Display on `/library/[id]` as tagged snippets with page links.

**Portfolio line:** "Designed transparent evidence-metadata extraction without pseudo-precision scoring."

---

## 5. Landing Page Marketing Gaps for Hiring Managers

Hiring managers (engineering managers, staff engineers, product-minded founders) scan portfolio sites differently from end users. Current gaps in `components/landing/LandingPage.tsx` and `LandingNav.tsx`:

### 5.1 No "built by" / engineering narrative

**Gap:** Footer is brand + tagline only (line 252–258). No author, GitHub link, LinkedIn, or "built as a portfolio project exploring RAG for scientific literature."

**Fix:** Add footer section: GitHub repo link, your name, 1-line engineering focus ("Full-stack RAG with pgvector, streaming citations, and RLS-hardened retrieval").

---

### 5.2 No live demo URL above the fold

**Gap:** Primary CTA is "Start for free" → Google OAuth. Managers won't sign up.

**Fix:** Hero buttons: **[Try live demo]** · **[View source on GitHub]** · Sign in. Demo must work in one click.

---

### 5.3 No architecture / stack visibility

**Gap:** Mono line mentions "arXiv · Semantic Scholar · PDF upload · Google sign-in" (line 154–156) but not Next.js, Supabase, pgvector, Claude, Voyage — the things engineers evaluate.

**Fix:** Tech stack row with logos/badges. Link to architecture doc. Mention HNSW index, RLS, NDJSON streaming — signals depth.

---

### 5.4 No social proof or credibility markers

**Gap:** No metrics ("<2s retrieval", "1024-dim embeddings", "12 chunks per query"), no test badge, no deployment status.

**Fix:** Add 3–4 stat pills under hero: "pgvector HNSW · 500-token chunks · citation-verified · streaming SSE/NDJSON."

---

### 5.5 Hero preview is static, not interactive

**Gap:** `HeroPreview()` (lines 65–101) is hardcoded JSX mimicking a chat — clever but obviously fake.

**Fix:** Replace with embedded real demo iframe or autoplay video (45s) showing: import → ask → click citation. Authenticity matters more than animation.

---

### 5.6 Missing "Why I built this" section

**Gap:** Landing reads as a product pitch, not a portfolio piece. Hiring managers want motivation and technical decisions.

**Fix:** Short `#about` section: problem (citation hallucination in generic chatbots), approach (library-grounded RAG with post-hoc citation filtering), tradeoffs (own library vs web search). 3 sentences max.

---

### 5.7 No comparison positioning

**Gap:** Features section (lines 164–195) lists capabilities but doesn't position against alternatives. "Not another chatbot that hallucinates citations" (line 171) is good but vague.

**Fix:** One comparison block: "Unlike web-search AI (Perplexity) · Unlike black-box consensus (Consensus) · Unlike reference managers (Zotero) → Nosramus verifies every claim against *your* imported source text."

---

### 5.8 Nav lacks GitHub and demo links

**Gap:** `LandingNav.tsx` only has Features, How it works, Sign in, Get started.

**Fix:** Add "Demo" and "GitHub" to nav. Engineers click GitHub before Features.

---

### 5.9 No accessibility / performance signals

**Gap:** No mention of mobile support, keyboard nav (even planned), or Lighthouse scores.

**Fix:** After implementing command palette, add "Keyboard-first" to features. Run Lighthouse, mention score if >90.

---

### 5.10 SEO / shareability

**Gap:** `app/layout.tsx` likely has generic metadata (verify `metadata` export). No Open Graph image for link previews when shared on LinkedIn/Twitter.

**Fix:** Add OG image showing product screenshot + tagline. Custom `metadata` title: "Nosramus — RAG research assistant with verified citations."

---

## Appendix: Quick-Win File Checklist

| Priority | Task | Primary files |
|----------|------|---------------|
| P0 | Public demo route | `app/demo/page.tsx`, `LandingPage.tsx` |
| P0 | GitHub + demo links in nav | `LandingNav.tsx` |
| P0 | Live deployment URL in README | `README.md`, `LandingPage.tsx` |
| P1 | PDF viewer + citation jump | `components/PdfViewer.tsx`, `Citations.tsx` |
| P1 | Command palette | `components/CommandPalette.tsx` |
| P1 | Starter prompts | `ChatView.tsx` |
| P1 | CI + tests | `.github/workflows/ci.yml`, `lib/__tests__/` |
| P2 | Architecture section | `landing/ArchitectureSection.tsx` |
| P2 | Source panel w/ similarity | `SourcePanel.tsx`, `chat/route.ts` |
| P2 | Persist paper scope | `ChatView.tsx`, `chat/route.ts` |
| P3 | Contradiction Radar | `ContradictionPanel.tsx`, `retrieval.ts` |
| P3 | Methodology Lens | `ChatView.tsx`, `retrieval.ts` |

---

## Summary Positioning Statement (for resume / LinkedIn)

> **Nosramus** — A full-stack RAG research assistant that answers questions strictly from your paper library, with post-hoc citation verification, section-aware PDF chunking, and pgvector retrieval hardened via Supabase RLS. Built with Next.js 16, Claude streaming, and provider-agnostic embeddings. [Live demo] · [GitHub]

This positions Nosramus not as "another ChatGPT wrapper" but as a **verifiable evidence system** — a narrative that differentiates against every competitor in the benchmark set.
