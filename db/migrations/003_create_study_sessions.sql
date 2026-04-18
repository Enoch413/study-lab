-- STUDY LAB migration 003
-- Rollback idea:
--   drop table if exists study_sessions;

create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  base_room_id uuid not null references study_rooms(id),
  current_room_id uuid not null references study_rooms(id),
  status study_session_status not null default 'ACTIVE',
  connection_status study_connection_status not null default 'MAIN_ROOM',
  camera_status study_camera_status not null default 'OFF',
  mic_policy study_mic_policy not null default 'MUTED_LOCKED',
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  last_heartbeat_at timestamptz not null default now(),
  end_reason study_session_end_reason null,
  client_instance_id varchar(100) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_study_sessions_heartbeat_after_start check (last_heartbeat_at >= started_at),
  constraint chk_study_sessions_client_instance_not_blank check (
    client_instance_id is null or btrim(client_instance_id) <> ''
  ),
  constraint chk_study_sessions_status_end_fields check (
    (
      status = 'ACTIVE'
      and ended_at is null
      and end_reason is null
      and connection_status in ('MAIN_ROOM', 'QUESTION_PENDING', 'QUESTION_ROOM')
    ) or (
      status = 'EXITED'
      and ended_at is not null
      and end_reason is not null
      and connection_status = 'EXITED'
    ) or (
      status = 'DISCONNECTED'
      and ended_at is not null
      and end_reason = 'HEARTBEAT_TIMEOUT'
      and connection_status = 'DISCONNECTED'
    )
  )
);

comment on table study_sessions is
'STUDY LAB student study session table. base_room_id/current_room_id room type validation is enforced in domain logic.';
