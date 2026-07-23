# Security Policy

## Key safety

**No database or AI keys are shipped to the browser.** The only value in the
client config (`window.__CFG.API_BASE_URL`) is the public URL of the backend.

- The **Neon Postgres** connection string and the **Gemini API key** live only in
  the FastAPI backend's server-side environment (FastAPI Cloud env vars).
- The frontend can only **write** results via `POST /api/results`. Reading stored
  results (`GET /api/results`) requires a server-side admin bearer token.
- AI endpoints are per-IP rate-limited and CORS is restricted to the site origin.

## Reporting a security issue

Please do **not** open a public GitHub Issue for security vulnerabilities.

Email **akshay.victrans@gmail.com** privately with:

- A description of the issue
- Steps to reproduce or a proof of concept
- Potential impact

Response time: within **7 days**.

After confirming the issue, a fix will be released and a public disclosure made (crediting you, if you'd like).
