# Security Policy

## Client-side key safety

The frontend includes a Supabase **publishable (anon) key** — this is intentional and safe. Supabase anon keys are designed to be shipped in client code.

The key is locked down with Row Level Security (RLS):

- **INSERT only** — browsers can submit results but cannot read other students' data
- No SELECT, UPDATE, or DELETE access from the client

## Reporting a security issue

Please do **not** open a public GitHub Issue for security vulnerabilities.

Email **akshay.victrans@gmail.com** privately with:

- A description of the issue
- Steps to reproduce or a proof of concept
- Potential impact

Response time: within **7 days**.

After confirming the issue, a fix will be released and a public disclosure made (crediting you, if you'd like).
