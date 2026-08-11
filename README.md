# Nosramus

A research assistant that answers questions about the scientific papers in your
library and cites the passages it used.

- **Add papers** by searching arXiv and Semantic Scholar, pasting a DOI or arXiv
  link, or uploading PDFs.
- **Ingestion** extracts the text, splits it into section- and page-aware chunks,
  and embeds each chunk into pgvector.
- **Chat** retrieves the most relevant chunks for your question and streams a
  Claude answer grounded in them, with clickable `[n]` citations that expand to
  the underlying quote.
- **Scope** a conversation to specific papers, or search the whole library.

## Stack

| Layer      | Choice                                           |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16 (App Router), React 19, TypeScript     |
| Styling    | Tailwind CSS v4                                   |
| Auth       | Supabase Auth (Google OAuth)                      |
| Database   | Supabase Postgres + `pgvector`                    |
| Storage    | Supabase Storage (`papers` bucket)                |
| Generation | Anthropic Claude (streaming)                      |
| Embeddings | Voyage AI (default) or OpenAI, both at 1024 dims  |

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Apply the database schema before first use — see `SETUP.md`, which walks through
every account, key, and dashboard setting you need. Visit `/setup` in the running
app to verify your configuration.

## Layout

```
app/
  (app)/            authenticated shell: sidebar + chat + library
  api/
    chat/           retrieval + streaming Claude responses
    papers/         list, upload, import, search, delete
    conversations/  list, read, rename, delete
  login/            Google sign-in
  setup/            configuration health check
  auth/callback/    OAuth code exchange
components/         chat view, markdown + citations, library, sidebar
lib/
  supabase/         browser / server / service-role clients
  sources/          arXiv, Semantic Scholar, identifier resolution
  chunking.ts       paragraph- and section-aware splitter
  embeddings.ts     provider-agnostic embedding calls
  ingest.ts         extract -> chunk -> embed -> store
  retrieval.ts      vector search with per-paper caps
  prompt.ts         system prompt + excerpt formatting
supabase/migrations/  schema, RLS policies, match_chunks RPC, storage bucket
proxy.ts            session refresh + route protection
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```
