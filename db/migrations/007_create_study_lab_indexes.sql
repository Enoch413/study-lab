-- STUDY LAB migration 007
-- Rollback idea:
--   drop index if exists uq_study_rooms_room_code;
--   drop index if exists uq_daily_summary_user_date;
--   drop index if exists uq_active_session_per_user;
--   drop index if exists uq_open_question_per_student;
--   drop index if exists uq_active_question_room;
--   drop index if exists idx_study_rooms_type_active;
--   drop index if exists idx_study_rooms_logical_space;
--   drop index if exists idx_study_sessions_dashboard;
--   drop index if exists idx_study_sessions_user_started;
--   drop index if exists idx_study_sessions_room_active;
--   drop index if exists idx_question_requests_pending;
--   drop index if exists idx_question_requests_student_open;
--   drop index if exists idx_question_requests_teacher_status;
--   drop index if exists idx_daily_summary_date;
--   drop index if exists idx_daily_summary_user;
--   drop index if exists idx_audit_entity;
--   drop index if exists idx_audit_actor;
--   drop index if exists idx_audit_action;

create unique index if not exists uq_study_rooms_room_code
  on study_rooms (room_code);

create unique index if not exists uq_daily_summary_user_date
  on daily_study_summaries (user_id, summary_date_kst);

create unique index if not exists uq_active_session_per_user
  on study_sessions (user_id)
  where status = 'ACTIVE';

create unique index if not exists uq_open_question_per_student
  on question_requests (student_user_id)
  where status in ('PENDING', 'ACCEPTED');

create unique index if not exists uq_active_question_room
  on question_requests (question_room_id)
  where status = 'ACCEPTED' and question_room_id is not null;

create index if not exists idx_study_rooms_type_active
  on study_rooms (room_type, is_active);

create index if not exists idx_study_rooms_logical_space
  on study_rooms (logical_space_key, is_active);

create index if not exists idx_study_sessions_dashboard
  on study_sessions (status, connection_status, current_room_id, last_heartbeat_at desc);

create index if not exists idx_study_sessions_user_started
  on study_sessions (user_id, started_at desc);

create index if not exists idx_study_sessions_room_active
  on study_sessions (current_room_id, status, last_heartbeat_at desc);

create index if not exists idx_question_requests_pending
  on question_requests (status, requested_at asc);

create index if not exists idx_question_requests_student_open
  on question_requests (student_user_id, status);

create index if not exists idx_question_requests_teacher_status
  on question_requests (teacher_user_id, status, updated_at desc);

create index if not exists idx_daily_summary_date
  on daily_study_summaries (summary_date_kst);

create index if not exists idx_daily_summary_user
  on daily_study_summaries (user_id, summary_date_kst desc);

create index if not exists idx_audit_entity
  on audit_logs (entity_type, entity_id, created_at desc);

create index if not exists idx_audit_actor
  on audit_logs (actor_user_id, created_at desc);

create index if not exists idx_audit_action
  on audit_logs (action_type, created_at desc);
