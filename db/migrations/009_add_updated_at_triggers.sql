-- STUDY LAB migration 009
-- Rollback idea:
--   drop trigger if exists trg_study_rooms_set_updated_at on study_rooms;
--   drop trigger if exists trg_study_sessions_set_updated_at on study_sessions;
--   drop trigger if exists trg_question_requests_set_updated_at on question_requests;
--   drop trigger if exists trg_daily_study_summaries_set_updated_at on daily_study_summaries;
--   drop function if exists set_updated_at_timestamp();

create or replace function set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_study_rooms_set_updated_at on study_rooms;
create trigger trg_study_rooms_set_updated_at
before update on study_rooms
for each row
execute function set_updated_at_timestamp();

drop trigger if exists trg_study_sessions_set_updated_at on study_sessions;
create trigger trg_study_sessions_set_updated_at
before update on study_sessions
for each row
execute function set_updated_at_timestamp();

drop trigger if exists trg_question_requests_set_updated_at on question_requests;
create trigger trg_question_requests_set_updated_at
before update on question_requests
for each row
execute function set_updated_at_timestamp();

drop trigger if exists trg_daily_study_summaries_set_updated_at on daily_study_summaries;
create trigger trg_daily_study_summaries_set_updated_at
before update on daily_study_summaries
for each row
execute function set_updated_at_timestamp();
