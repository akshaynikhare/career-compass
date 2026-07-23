# Deployment Guide

> **Architecture note (updated):** The app now uses a **FastAPI backend on FastAPI
> Cloud** with a **Neon Postgres** database, and all AI calls are proxied
> server-side. Supabase and the browser-side Gemini key are gone. For the full
> migration/go-live sequence see **[MIGRATION.md](MIGRATION.md)**. This file
> covers the frontend (GitHub Pages) only.

## A. GitHub Pages setup

1. Create repo on GitHub, push all code to `main`.
2. **Settings → Pages → Source** → select **"GitHub Actions"**.
3. **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `API_BASE_URL` — the deployed FastAPI Cloud URL (e.g.
     `https://career-compass-api-xxxx.fastapicloud.app`, no trailing slash).
   - (Remove any old `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `GEMINI_KEY` secrets —
     they are no longer used.)
4. Push to `main` — the `Deploy to GitHub Pages` Action injects the config,
   generates the 507 SEO pages + sitemap, and publishes.
5. Live at `https://<your-username>.github.io/<repo-name>/`.

## B. Backend + database

See **[MIGRATION.md](MIGRATION.md)** — create Neon, deploy `backend/` to FastAPI
Cloud, set its env vars, and (optionally) migrate existing Supabase rows.

## C. Local frontend development

1. Clone the repo.
2. Create `src/config.js` locally (gitignored):
   ```js
   window.__CFG = { API_BASE_URL: 'http://127.0.0.1:8000' };
   ```
   (Run the backend locally with `uvicorn app.main:app --reload` from `backend/`.)
3. Generate the SEO pages once: `node scripts/build_profession_pages.mjs`
4. Serve locally: `npx serve .` or VS Code Live Server.
5. Validate data: `node scripts/validate_data.mjs`

## D. Smoke test after deploy

- Open the live URL, complete the test.
- Confirm the row landed in Neon:
  `psql "<NEON_DB_URL>" -c "select count(*) from career_test_results;"`
- On the results page, confirm the AI summary + "Ask About a Career" chat work.
- View source → only `API_BASE_URL` is present (no secret keys).
