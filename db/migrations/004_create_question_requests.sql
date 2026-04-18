-- STUDY LAB migration 004
-- Rollback idea:
--   drop table if exists question_requests;

create table if not exists question_requests (
  id uuid primary key default gen_random_uuid(),
  study_session_id uuid not null references study_sessions(id),
  student_user_id uuid not null references users(id),
  teacher_user_id uuid null references users(id),
  question_room_id uuid null references study_rooms(id),
  status question_request_status not null default 'PENDING',
  request_note varchar(200) null,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz null,
  ended_at timestamptz null,
  complete_reason question_complete_reason null,
  auto_returned_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_question_requests_note_not_blank check (
    request_note is null or btrim(request_note) <> ''
  ),
  constraint chk_question_requests_requested_before_accepted check (
    accepted_at is null or accepted_at >= requested_at
  ),
  constraint chk_question_requests_requested_before_ended check (
    ended_at is null or ended_at >= requested_at
  ),
  constraint chk_question_requests_completed_before_autoreturn check (
    auto_returned_at is null or ended_at is not null and auto_returned_at >= ended_at
  ),
  constraint chk_question_requests_state_fields check (
    (
      status = 'PENDING'
      and teacher_user_id is null
      and question_room_id is null
      and accepted_at is null
      and ended_at is null
      and complete_reason is null
      and auto_returned_at is null
    ) or (
      status = 'ACCEPTED'
      and teacher_user_id is not null
      and question_room_id is not null
      and accepted_at is not null
      and ended_at is null
      and complete_reason is null
    ) or (
      status = 'CANCELED'
      and ended_at is not null
      and complete_reason = 'STUDENT_CANCEL'
    ) or (
      status = 'COMPLETED'
      and ended_at is not null
      and complete_reason is not null
      and auto_returned_at is not null
    ) or (
      status = 'FAILED'
      and ended_at is not null
      and complete_reason is not null
    )
  )
);

comment on table question_requests is
'Question lifecycle table. question_room_id room_type QUESTION validation is enforced in domain logic.';
