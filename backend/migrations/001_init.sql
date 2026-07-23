-- Career Compass — Neon schema
-- Run once against your Neon database:
--   psql "$DATABASE_URL" -f migrations/001_init.sql
--
-- Same shape as the old Supabase table, MINUS Row Level Security: access is now
-- controlled by the FastAPI backend, not by anonymous Postgres roles.

create table if not exists career_test_results (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  student_name  text,
  student_email text,
  student_phone text,
  riasec_vector jsonb not null default '{}'::jsonb,
  constraints   jsonb not null default '{}'::jsonb,
  top_matches   jsonb not null default '[]'::jsonb,
  user_agent    text
);

create index if not exists idx_career_results_created_at
  on career_test_results (created_at desc);
