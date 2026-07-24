-- Career Compass — in-flight test sessions
-- Run against your Neon database:
--   psql "$DATABASE_URL" -f migrations/002_sessions.sql
--
-- Backs the "resume your test on any device" feature. The session id (a random
-- uuid) is the resume link's only secret, so the public GET route never returns
-- the email/phone — only enough state to continue the test.

create table if not exists test_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  status        text not null default 'in_progress',   -- 'in_progress' | 'completed'
  student_name  text,
  student_email text,
  student_phone text,
  question_ids  jsonb not null default '[]'::jsonb,     -- selected question order, so resume shows the same questions
  answers       jsonb not null default '{}'::jsonb,     -- career_quick + career_deep answers
  constraints   jsonb not null default '{}'::jsonb,     -- personal_financial answers
  current_index int  not null default 0,
  user_agent    text
);

create index if not exists idx_test_sessions_updated_at
  on test_sessions (updated_at desc);
