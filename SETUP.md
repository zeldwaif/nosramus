# What you need to do

Everything below is work that can't be done from inside the codebase — accounts,
keys, and dashboard settings. Budget about 20 minutes. Steps 1–5 are required;
step 6 is optional.

---

## 1. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a
   new project. Pick a region close to you and save the database password
   somewhere — you'll need it if you ever use the CLI.
2. Wait for provisioning to finish (about two minutes).

**Collect three values.**

| Value | Where |
| --- | --- |
| Project URL | Project Settings → Data API → **Project URL** |
| Publishable key | Project Settings → API Keys → **Publishable** (`sb_publishable_…`) |
| Secret key | Project Settings → API Keys → **Secret** (`sb_secret_…`) — click *Reveal* |

> Older projects show `anon` and `service_role` keys instead. Either format
> works — Supabase is retiring the legacy JWT keys through the end of 2026, so
> use the publishable/secret pair if your project offers them. The publishable
> key goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the secret key in
> `SUPABASE_SERVICE_ROLE_KEY`.

**The secret key must never reach the browser.** It bypasses row-level security.
It is only read server-side, in `lib/supabase/admin.ts`.

---

## 2. Apply the database schema

Open the Supabase dashboard → **SQL Editor** → New query. Paste the entire
contents of `supabase/migrations/0001_init.sql` and run it.

That one script enables `pgvector`, creates the `papers`, `chunks`,
`conversations`, and `messages` tables, adds row-level security so users only
ever see their own rows, creates the `match_chunks` similarity-search function,
and creates the private `papers` storage bucket.

If you'd rather use the CLI:

```bash
npm install -g supabase
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Verify:** Table Editor should list four tables, and Storage should show a
bucket named `papers`.

---

## 3. Set up Google sign-in

Two dashboards, and the order matters.

### Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → create or pick
   a project.
2. **APIs & Services → OAuth consent screen.** Choose *External*, fill in app
   name and support email, and add yourself as a test user. You do not need to
   publish or get verified for personal use.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   Application type: *Web application*.
4. Under **Authorized redirect URIs**, add exactly this — from your Supabase
   dashboard, Authentication → Sign In / Providers → Google, where it's shown as
   the callback URL:

   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```

   This is the single most common thing to get wrong. The redirect goes to
   *Supabase*, not to localhost.
5. Copy the **Client ID** and **Client secret**.

### Supabase dashboard

1. **Authentication → Sign In / Providers → Google.** Enable it, paste the client
   ID and secret, save.
2. **Authentication → URL Configuration.** Set *Site URL* to
   `http://localhost:3000` for now. Under *Redirect URLs*, add
   `http://localhost:3000/**`. When you deploy, add your production URL to both.

---

## 4. Get the API keys

| Service | Where | Notes |
| --- | --- | --- |
| **Anthropic** (required) | [console.anthropic.com](https://console.anthropic.com/settings/keys) → Create Key | Add a few dollars of credit under Billing; a new key with no credit returns a 400. |
| **Voyage AI** (required) | [dashboard.voyageai.com](https://dashboard.voyageai.com) → API Keys | Used for embeddings. Free tier covers a good number of papers. |

Voyage is Anthropic's embedding partner and is the default. If you'd rather use
OpenAI, set `EMBEDDING_PROVIDER=openai` and supply `OPENAI_API_KEY` instead —
both are configured to produce 1024-dimension vectors so the database schema
doesn't change.

> **Don't switch embedding providers after ingesting papers.** Vectors from
> different models aren't comparable. If you switch, delete every row in
> `chunks` and re-add your papers.

---

## 5. Fill in `.env.local` and run

```bash
cd nosramus
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
EMBEDDING_PROVIDER=voyage
VOYAGE_API_KEY=pa-...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then:

```bash
npm run dev
```

1. Open **http://localhost:3000** → you'll be redirected to sign in.
2. After signing in, open **http://localhost:3000/setup**. This page checks every
   environment variable, every table, the `match_chunks` function, and the
   storage bucket, and tells you exactly which one is wrong if something is.
3. Go to **Library**, search for a paper (try `attention is all you need`), and
   click *Add to library*. Wait for it to finish processing.
4. Go to **Chat** and ask something about it.

---

## 6. Optional

**Semantic Scholar API key.** Search works without one, using a shared rate
limit that will occasionally return 429. Request a free key at
[semanticscholar.org/product/api](https://www.semanticscholar.org/product/api)
and set `SEMANTIC_SCHOLAR_API_KEY`.

**Deploying to Vercel.** Push to GitHub, import the repo at
[vercel.com/new](https://vercel.com/new), and add every variable from
`.env.local` under Project Settings → Environment Variables. Then:

- Set `NEXT_PUBLIC_SITE_URL` to your production URL.
- In Supabase → Authentication → URL Configuration, set *Site URL* to the
  production URL and add `https://your-app.vercel.app/**` to *Redirect URLs*.

Note that ingestion runs inline in the upload/import request. Vercel's Hobby
plan caps functions at 60 seconds, which is not enough for a long paper — the
routes request 300s via `maxDuration`, which needs a Pro plan. If you stay on
Hobby, move ingestion to a background job (a Supabase Edge Function or a queue)
before relying on it in production.

---

## Troubleshooting

**"redirect_uri_mismatch" on sign-in.** The URI in Google Cloud must be your
*Supabase* callback (`https://…supabase.co/auth/v1/callback`), not localhost.

**Sign-in loops back to /login.** Check *Redirect URLs* in Supabase →
Authentication → URL Configuration includes `http://localhost:3000/**`.

**`function match_chunks does not exist`.** The migration didn't run, or ran
before `create extension vector`. Re-run the whole file.

**A paper shows "Failed: No text found in this PDF."** It's a scanned image.
Run it through OCR (macOS Preview, Adobe, or `ocrmypdf`) and upload the result.

**Chat answers "the excerpts don't cover this."** Either the paper is still
processing — check the Library — or retrieval genuinely found nothing. Try a
question using the paper's own terminology.

**Uploads fail with a storage error.** The `papers` bucket or its policy is
missing. Re-run the storage section at the bottom of the migration.
