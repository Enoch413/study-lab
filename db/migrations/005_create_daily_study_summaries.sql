-- STUDY LAB migration 005
-- Rollback idea:
--   drop table if exists daily_study_summaries;

create table if not exists daily_study_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  summary_date_kst date not null,
  accumulated_seconds integer not null default 0,
  last_reconciled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_daily_study_summaries_accumulated_non_negative check (accumulated_seconds >= 0)
);
