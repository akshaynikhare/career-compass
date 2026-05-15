# Deployment Guide

## A. GitHub repo setup

1. Create repo on GitHub, push all code to `main`.
2. Go to **Settings → Pages → Source** → select **"GitHub Actions"**.
3. Go to **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `SUPABASE_URL` — your Supabase project URL (e.g. `https://abcdef.supabase.co`)
   - `SUPABASE_ANON_KEY` — your Supabase anon/public key
4. Push to `main` — the `Deploy to GitHub Pages` Action runs automatically.
5. Your app is live at `https://<your-username>.github.io/<repo-name>/`.

## B. Supabase project setup

1. Go to [supabase.com](https://supabase.com) → New Project (free tier works).
2. Once project is ready: **SQL Editor** → paste contents of `supabase_schema.sql` → Run.
3. Verify: **Table Editor** → you should see `career_test_results` table.
4. Go to **Settings → API** → copy:
   - "Project URL" → `SUPABASE_URL` GitHub secret
   - "anon public" key → `SUPABASE_ANON_KEY` GitHub secret
5. The RLS policy in the SQL ensures browser users can only INSERT (not read other students' results).

## C. Local development

1. Clone the repo.
2. Create `src/config.js` locally:
   ```js
   window.__CFG = {
     SUPABASE_URL: 'https://your-project.supabase.co',
     SUPABASE_ANON_KEY: 'your-anon-key'
   };
   ```
   (This file is gitignored — never commit real keys.)
3. Serve locally: `npx serve .` or use VS Code Live Server.
4. Run data validation: `node scripts/validate_data.mjs`

## D. Smoke test after deploy

- Open the live GitHub Pages URL.
- Complete all 25 questions.
- On the results page, fill name/email/phone and click "Save my result".
- Open Supabase dashboard → **Table Editor** → `career_test_results` → confirm your row appears.
