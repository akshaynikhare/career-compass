# Migration & Go-Live Guide (Supabase → Neon + FastAPI, AI upgrade, SEO)

This guide is the sequence of steps **you** run (they need accounts / secrets I
can't create). Everything else — backend code, frontend rewiring, 507 SEO pages,
sitemap, OG image — is already done in the repo.

## New architecture

```
Browser (GitHub Pages, static)
   │  window.__CFG.API_BASE_URL   ← the ONLY value shipped to the browser
   ▼
FastAPI backend (FastAPI Cloud, free Hobby tier)
   ├── POST /api/results        → Neon Postgres (result capture)
   ├── GET  /api/results        → admin-only (read your leads)
   └── /api/ai/*                → Gemini (key stays server-side)
```

No database or AI keys are in the browser anymore. Neon replaces Supabase and
never pauses/deletes on inactivity (it just autosuspends compute and wakes in
~500ms). All code lives in [`backend/`](../backend).

---

## Step 1 — Create the Neon database

1. Sign up at https://neon.tech (free plan) and create a project (region close to
   your users, e.g. AWS ap-south-1 Mumbai).
2. Copy the **pooled** connection string (Dashboard → Connection Details → check
   "Pooled connection"). It looks like
   `postgresql://user:pass@ep-xxxx-pooler.ap-south-1.aws.neon.tech/dbname?sslmode=require`.
3. Create the table:
   ```bash
   psql "<NEON_DB_URL>" -f backend/migrations/001_init.sql
   ```

## Step 2 — Get a Gemini API key

You already use one. If you need a fresh one: https://aistudio.google.com/apikey
(the free tier is enough for this traffic). Keep it secret — it now lives only on
the server.

## Step 3 — Deploy the backend to FastAPI Cloud

The backend is already deploy-ready: it has a `pyproject.toml` (required by the
CLI) and FastAPI Cloud auto-discovers the app as `app.main:app` (verified).

Run these **in your terminal** (the `login` step opens a browser and binds to your
account, so it can't be automated):

```bash
pip install fastapi-cloud-cli
cd backend                         # must run from the dir with pyproject.toml
python -m fastapi_cloud_cli login  # or: fastapi login
python -m fastapi_cloud_cli deploy # or: fastapi deploy
```

Then, in the FastAPI Cloud dashboard, set these environment variables (see
`backend/.env.example`) — you already have the first two from Steps 1 & 2:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | your Neon pooled connection string |
| `GEMINI_KEY` | your Gemini API key |
| `ADMIN_TOKEN` | a long random string — `openssl rand -hex 24` |
| `ALLOWED_ORIGINS` | `https://akshaynikhare.github.io` |

Copy the deployed URL (e.g. `https://career-compass-api-xxxx.fastapicloud.app`).
Test it: `curl <URL>/health` → `{"ok":true,...}`.

> Fallback: if FastAPI Cloud gives trouble, the same app runs on Render/Railway/Fly
> with start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

## Step 4 — Migrate existing Supabase data into Neon

1. Get your **Supabase** direct Postgres URL (Supabase Dashboard → Project
   Settings → Database → Connection string / URI).
2. Run the migration script (it first prints the row count so you can decide):
   ```bash
   export SUPABASE_DB_URL='postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres'
   export NEON_DB_URL='<your Neon pooled URL>'
   bash scripts/migrate_supabase_to_neon.sh
   ```
   It preserves `id` and `created_at`, then prints both row counts to confirm.
   (If the count is 0, it tells you to just start fresh.)
3. Delete the local `career_test_results.data.sql` dump afterward — it contains PII.

## Step 5 — Point the frontend at the backend, remove old secrets

In **GitHub → repo → Settings → Secrets and variables → Actions**:
- **Add** secret `API_BASE_URL` = your FastAPI Cloud URL (no trailing slash).
- **Delete** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_KEY` (no longer used;
  the workflow no longer references them).

Push to `main` (or run the Deploy workflow). The deploy now also generates the 507
SEO pages and sitemap automatically.

### Verify the cutover
- Open the live site, complete a test → a row appears in Neon:
  `psql "<NEON_DB_URL>" -c "select count(*) from career_test_results;"`
- View page source → only `API_BASE_URL` is present, **no keys**.
- On the results page: the "Personalised Summary", domain reasons, and "Ask About a
  Career" chat all work.
- Read your leads anytime:
  `curl -H "Authorization: Bearer <ADMIN_TOKEN>" "<URL>/api/results"`

---

## Step 6 — SEO submission (drive traffic)

1. **Google Search Console** (https://search.google.com/search-console):
   - Add property (URL prefix) `https://akshaynikhare.github.io/career-compass/`.
   - Verify via the HTML-tag method: paste the `<meta name="google-site-verification" ...>`
     into [`index.html`](../index.html) where the placeholder comment is (line ~16), push.
   - Sitemaps → submit `sitemap.xml`.
   - URL Inspection → request indexing for `/`, `/careers/index.html`, and a few
     top career pages.
2. **Bing Webmaster Tools** (https://www.bing.com/webmasters): add the site,
   import from Search Console (fastest), submit the same sitemap. (This also covers
   DuckDuckGo/Ecosia.)
3. **First traffic seeds** (optional but effective):
   - Share career pages in Indian student/parent communities (r/Indian_Academia,
     r/JEENEETards, school WhatsApp/Telegram groups) — link the specific career
     page relevant to the discussion, not just the homepage.
   - The `careers/field-*.html` hub pages are good link targets for "careers in X".

### What's already optimized for you
- 507 `careers/<slug>.html` pages with `Occupation` + `FAQPage` + `BreadcrumbList`
  structured data (test any URL in Google's Rich Results Test).
- Real PNG OG image (`icons/og-image.png`) so social/WhatsApp previews render.
- `sitemap.xml` auto-regenerated on every deploy with all pages + fresh `lastmod`.
- Thin personalized pages (`result.html`, etc.) set to `noindex` so they don't
  dilute rankings.
- Fixed `manifest.json` / service-worker paths so the PWA + Lighthouse pass under
  the `/career-compass/` subpath.

---

## Rollback

The old Supabase table is untouched by this migration (we only read from it). If
anything goes wrong, revert the `API_BASE_URL` change and restore the old secrets —
but note Supabase will re-pause after 7 idle days, which is what we're leaving.
