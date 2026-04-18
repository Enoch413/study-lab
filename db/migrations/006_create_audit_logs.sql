-- STUDY LAB migration 006
-- Rollback idea:
--   drop table if exists audit_logs;

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type audit_entity_type not null,
  entity_id uuid not null,
  actor_user_id uuid null references users(id),
  action_type audit_action_type not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
