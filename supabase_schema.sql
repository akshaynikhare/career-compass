-- Career Advisor: result storage
-- Run this in Supabase SQL Editor to create the results table.

create table if not exists career_test_results (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  student_name text,
  student_email text,
  student_phone text,
  riasec_vector jsonb not null,
  constraints   jsonb not null,
  top_matches   jsonb not null,
  user_agent    text
);

-- Row Level Security: allow anonymous INSERT only (no reads from browser)
alter table career_test_results enable row level security;

create policy "anon_insert_only"
  on career_test_results
  for insert
  to anon
  with check (true);
