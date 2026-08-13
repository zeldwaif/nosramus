# Nosramus — CRITIC Review

**Reviewer stance:** Senior engineer, 30-second portfolio screen.  
**Verdict:** Competent tutorial-tier RAG demo. Not hire-worthy as-is. Shows you can wire APIs together; does not show you can ship a product researchers would trust.

---

## 1. Brutal honest weaknesses

### UX — functional, forgettable

**First impression is generic AI SaaS.** Dark background, mint-green accent (`#86efac`), glass cards, ambient blur orbs, Space Grotesk display font, ping animation on a status dot — this is the 2024–2026 "I built a RAG app" starter kit. Nothing about the visual language says *research* or *papers*; it says *another ChatGPT wrapper*.

**The landing page is a template.** Hero → feature grid → "three steps" → CTA footer. The fake chat preview in `LandingPage.tsx` uses hardcoded Transformer trivia. A hiring manager has seen this exact layout fifteen times this quarter. There is no demo video, no live embed, no social proof, no explanation of *why* this beats Elicit, Consensus, or NotebookLM.

**The app shell is ChatGPT with fewer features.** Sidebar of conversations, centered chat column, textarea + Send. Missing:

- Suggested starter questions when the library is empty
- In-library search/filter (only external literature search exists)
- Conversation rename (API supports `PATCH`; UI does not)
- Copy/export/share answer
- Stop generation / cancel stream
- Regenerate answer
- Feedback on citation quality
- Any indication of retrieval confidence

**Citations are half-baked.** Clicking `[n]` scrolls to a truncated 400-character quote in a collapsible list. You cannot open the PDF, jump to the page, highlight the passage in context, or verify the citation against the source document. For a product whose entire value prop is "verify sources," this is a fatal gap. Researchers will Ctrl+F the PDF anyway.

**Library UX is bare minimum.** Upload is a hidden file input behind a button — no drag-and-drop, no batch progress, no duplicate detection UI (backend dedupes by source_id but user gets no feedback). Remove has no confirmation. Failed papers show an error string with no retry action. Processing status polls every 3 seconds — crude and battery-hostile on mobile.

**Paper scoping is broken UX.** `PaperPicker` changes are never persisted to the conversation record after creation. Reload the page and your scope resets to whatever was stored at conversation creation. The picker also re-fetches `/api/papers` independently of every other component that needs the same data.

**Mobile is an afterthought.** Hamburger drawer works, but the chat input, citation panel, and library search stack awkwardly. No touch-optimized PDF workflow because there is no PDF workflow at all.

**Empty and error states are lazy.** "Loading...", "...", "No conversations yet." No skeletons, no illustrations, no guided onboarding beyond "go add a paper." A first-time user hits three dead screens before anything interesting happens.

### Code quality — clean but shallow

**~70 files, zero tests.** No unit tests for chunking, retrieval, citation parsing, or identifier resolution. No integration tests for the chat pipeline. No eval harness for retrieval quality. No CI. A hiring manager asking "how do you know it works?" gets silence.

**`proxy.ts` is not middleware.** Next.js requires `middleware.ts` at the project root. You have `proxy.ts` with session refresh and route-guard logic that **never runs**. README documents it as active protection. `(app)/layout.tsx` redirects unauthenticated users, so the app mostly works, but:

- Session token refresh on navigation may not happen reliably (server.ts comment says "middleware refreshes the session")
- Routes outside `(app)/` (`/setup`, future routes) are unprotected at the edge
- This is either a copy-paste mistake or incomplete migration — both look bad in review

**Synchronous ingestion in HTTP handlers.** Upload and import block for up to 300 seconds (`maxDuration = 300`), running PDF extraction, chunking, and embedding inline. SETUP.md admits Hobby Vercel dies at 60s. This architecture does not scale past a demo. One 40-page paper ties up a serverless function and burns embedding API credits in the request path.

**No rate limiting anywhere.** Chat, upload, import, and search endpoints are open to authenticated abuse. A malicious user (or a bug in a loop) can drain Anthropic and Voyage credits. Portfolio projects get a pass on billing alerts; production systems do not.

**Client state is fragile.** Chat messages get local IDs like `local-${Date.now()}`. Optimistic user messages are never reconciled with server IDs. Stream parsing assumes well-formed NDJSON lines with no recovery from partial frames. No AbortController — navigating away mid-stream leaks the connection.

**Duplicated data fetching.** `PaperPicker`, `LibraryView`, and `Sidebar` each independently fetch papers or conversations. No shared cache, no SWR/React Query, no server-component data passing.

**Migration story is manual and messy.** Three migration files with overlapping `match_chunks` definitions, plus instructions to "paste into SQL Editor." The existence of `0003_fix_match_chunks_cache.sql` screams "I debugged this in production at 2am." Schema drift between fresh installs and existing deploys is a support burden you have not solved.

**TypeScript is fine but unproven.** Types exist in `lib/types.ts`; nothing validates runtime API inputs (message length, paperIds UUID format, file MIME beyond size check). Zod or similar is absent.

### Missing features — the product is a skeleton

| Expected in a research assistant | Present? |
| --- | --- |
| PDF viewer with page navigation | No |
| Full-text search within library | No |
| Hybrid retrieval (BM25 + vector) | No |
| Reranking | No |
| OCR for scanned PDFs | No (error message only) |
| Paper metadata editing | No |
| Collections / tags / folders | No |
| Shared libraries or collaboration | No |
| Citation export (BibTeX, RIS) | No |
| Conversation branching | No |
| Usage/cost dashboard | No |
| Offline / PWA | No |
| Eval metrics (precision@k, faithfulness) | No |

What you have is: import paper → embed chunks → vector search → stream Claude answer with bracket citations. That is a weekend hackathon scope, not a portfolio centerpiece.

### Generic feel — interchangeable with a tutorial

If you removed the "Nosramus" wordmark and swapped Claude for OpenAI, this could be any of:

- "Build a RAG app with Next.js" YouTube tutorial
- Vercel AI SDK document Q&A template
- Supabase pgvector demo

There is no opinionated research workflow. No literature review mode. No compare-across-papers view. No "what changed since last time I read this field." No integration with reference managers (Zotero, Mendeley). The name "Nosramus" does not connect to anything in the UI or copy.

---

## 2. What makes a hiring manager pass in 30 seconds

A senior reviewer opens the deployed URL (if it exists — many candidates only link GitHub) and:

1. **Landing page:** "Dark mode AI chatbot #847." Scrolls past. Does not click Sign in unless the hero is exceptional. Yours is not.

2. **GitHub README:** Sees "RAG + Supabase + Claude." Checks commit history and test folder. Finds zero tests, zero CI badge, `.next` build artifacts in git status. *Pass.*

3. **Code scan:** Opens `app/api/chat/route.ts`. Recognizes standard retrieve-then-generate. Opens `lib/chunking.ts`. Paragraph splitter — fine, not impressive. Looks for `middleware.ts`. Finds `proxy.ts` instead. *Red flag.*

4. **Differentiation check:** "What can this do that ChatGPT + PDF upload cannot?" Citations to chunk quotes — slightly better, but no PDF highlight. Not enough.

5. **Engineering maturity:** No tests, no monitoring, no job queue, inline ingestion, no rate limits. Reads as "I followed a tutorial."

**The 30-second pass triggers:**

- Generic AI-wrapper aesthetic with no domain identity
- No tests or CI
- Broken/unwired middleware
- No PDF viewer despite "research assistant" positioning
- Feature set identical to fifty other portfolio RAG apps from 2024–2025

---

## 3. What's cliché or derivative

| Cliché | Where it shows up |
| --- | --- |
| "Ask your documents" positioning | Landing hero, README, login page |
| Dark + green accent palette | `globals.css`, every button |
| Glass morphism cards | `.glass`, landing features |
| Space Grotesk + Inter font pairing | `app/layout.tsx` |
| Fake product screenshot in hero | `HeroPreview` component |
| Three-step "How it works" | Landing page section |
| Google OAuth as sole auth | Login page |
| Supabase + Vercel + Claude stack | README stack table |
| pgvector cosine similarity RAG | `match_chunks` RPC, `retrieval.ts` |
| arXiv + Semantic Scholar import | Library search |
| `[n]` inline citation markers | Chat output, `Markdown.tsx` |
| "Grounded answers / no hallucinations" marketing | Landing copy — every RAG app claims this |
| NDJSON streaming from API route | `app/api/chat/route.ts` |
| Setup health-check page | `/setup` — good idea, but common in Supabase tutorials |

The **one mildly distinctive choice** is section-aware chunking with per-paper retrieval caps. It is implemented competently but invisible to users and unmeasured.

---

## 4. Security and architecture concerns

### Critical

1. **`proxy.ts` not wired as middleware.** Session refresh and centralized auth gating may not execute. Documented behavior does not match runtime behavior.

2. **SSRF in PDF fetch.** `fetchPdf()` in `lib/ingest.ts` downloads any URL passed through import. While URLs originate from arXiv/S2 APIs today, a crafted import request with a manipulated `SearchResult.pdf_url` (if validation loosens) could probe internal networks. No URL allowlist.

3. **No rate limiting on expensive endpoints.** Chat and ingestion are credit sinks. Authenticated users can abuse them without throttling.

4. **Service-role client in ingestion.** `createAdminClient()` bypasses RLS. Correct pattern, but a bug in `userId` scoping leaks cross-tenant data. No integration test verifies isolation.

### High

5. **No input size limits on chat messages.** A megabyte prompt burns tokens and could DoS the stream handler.

6. **Error messages returned to client.** `fail()` sends `err.message` to the browser — may leak Supabase internals, API key hints, or stack context.

7. **`/setup` exposed without auth shell.** Leaks configuration state (which env vars are set, table reachability) to unauthenticated visitors if `(app)` layout is bypassed. Low severity but sloppy.

8. **Conversation page server component** (`chat/[id]/page.tsx`) fetches by ID without explicit `user_id` filter — relies entirely on RLS. Fine if RLS is perfect; dangerous if a policy regresses.

### Medium

9. **Inline ingestion on serverless.** Timeout risk, no retry, no dead-letter queue, partial failure leaves paper in `failed` with no re-ingest UI.

10. **No Content-Security-Policy headers.** Markdown renders model output with `react-markdown` — prompt injection could exfiltrate via links (partially mitigated by component structure, not eliminated).

11. **Citation integrity is cosmetic.** Renumbering via regex on `[n]` markers does not verify the model's claims match the quoted text. A model can cite [1] while paraphrasing incorrectly.

12. **No audit logging.** Who imported what, when, how many tokens spent — absent.

13. **PDF upload validation is weak.** 30MB size cap and content-type check only. No magic-byte validation beyond first 5 bytes in import path. Malicious PDFs are a known attack surface for parsers.

14. **Embedding provider lock-in undocumented at runtime.** Switching providers silently breaks retrieval; UI does not warn.

---

## 5. Top 10 fixes (priority order)

| # | Priority | Fix | Why |
| --- | --- | --- | --- |
| 1 | **P0** | Rename `proxy.ts` → `middleware.ts` (or re-export) and verify session refresh + route guards run | Documented security behavior is currently broken; instant credibility hit in code review |
| 2 | **P0** | Add PDF viewer with page-linked citations (PDF.js or similar) | Core value prop is "verify sources"; without this the product fails its own thesis |
| 3 | **P0** | Move ingestion to a background job (Supabase Edge Function, Inngest, or queue) | Inline 300s handlers do not deploy; proves you understand async architecture |
| 4 | **P1** | Add rate limiting on `/api/chat`, `/api/papers/upload`, `/api/papers/import` | Shows production awareness; prevents cost blowups |
| 5 | **P1** | Write tests: chunking unit tests, retrieval integration test, citation renumbering tests, auth middleware test | Single biggest signal difference between "tutorial" and "engineer" |
| 6 | **P1** | Add CI (GitHub Actions: typecheck, lint, test on PR) | Table stakes for any serious portfolio |
| 7 | **P1** | Persist paper scope to conversation on change; add conversation rename in UI | Fixes broken UX that reviewers will hit in the first 2 minutes |
| 8 | **P2** | Redesign landing around a **live demo** or 60-second screen recording of real paper Q&A | Differentiates from static template landings |
| 9 | **P2** | Add retrieval eval harness (even 10 hand-curated Q&A pairs with expected chunks) | Proves RAG quality is engineered, not hoped for |
| 10 | **P2** | Visual identity that says "research" — typography, color, density, reading-focused layout | Escape the generic AI-wrapper aesthetic |

### Honorable mentions (P3)

- Hybrid search (tsvector + pgvector)
- Drag-and-drop upload with progress
- Re-ingest / retry failed papers
- SSRF allowlist for PDF URLs (arxiv.org, semanticscholar.org, doi.org mirrors)
- Shared data layer (React Query or server-component prefetch) to kill duplicate fetches

---

## Summary

Nosramus demonstrates baseline competence: RLS, streaming, section-aware chunking, citation UI, external literature APIs, and readable code structure. That is the floor in 2026, not the ceiling.

What it does **not** demonstrate: product taste, domain depth, production hardening, test discipline, or any feature a researcher would choose over existing tools.

**Ship the middleware fix, the PDF viewer, background ingestion, and tests.** Then pick one opinionated research workflow and nail it. Until then, this is a well-documented RAG tutorial — not a portfolio piece that survives a senior screen.
