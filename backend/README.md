# Career Compass API (backend)

FastAPI service that owns the Neon Postgres database and proxies all Gemini AI
calls. The static GitHub Pages frontend calls this instead of hitting Supabase /
Gemini directly, so **no secret key is ever shipped to the browser**.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/results` | public | Save a completed test result (replaces Supabase INSERT) |
| GET | `/api/results` | Bearer `ADMIN_TOKEN` | Read collected results (new — for export/dashboard) |
| POST | `/api/ai/rank-domains` | rate-limited | Top-4 domains + reasons |
| POST | `/api/ai/summary` | rate-limited | Personalized summary |
| POST | `/api/ai/chat` | rate-limited | "Ask about this career" Q&A |
| POST | `/api/ai/roadmap` | rate-limited | On-demand roadmap |
| GET | `/health` | public | Liveness check |

## Local development

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL, GEMINI_KEY, ADMIN_TOKEN
psql "$DATABASE_URL" -f migrations/001_init.sql
uvicorn app.main:app --reload
# open http://127.0.0.1:8000/docs
```

## Deploy to FastAPI Cloud (Hobby / free)

```bash
pip install fastapi-cloud-cli
fastapi login
cd backend
fastapi deploy
```

Then in the FastAPI Cloud dashboard, set the environment variables from
`.env.example` (`DATABASE_URL`, `GEMINI_KEY`, `ADMIN_TOKEN`, `ALLOWED_ORIGINS`).
Copy the deployed URL — it becomes the frontend's `API_BASE_URL`
(see the `Inject config` step in `.github/workflows/deploy.yml`).

Notes:
- Hobby tier scales to zero, so the first request after idle has a short cold
  start. The frontend save is fire-and-forget and AI calls are async, so this is
  invisible to users.
- Neon free tier autosuspends compute after ~5 min idle and wakes in ~500ms — it
  never pauses/deletes the project (the fix vs. Supabase's 7-day pause).

## Fallback host

The app is a standard ASGI app (`app.main:app`). If FastAPI Cloud is unavailable,
deploy the same code to Render / Railway / Fly.io with start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
