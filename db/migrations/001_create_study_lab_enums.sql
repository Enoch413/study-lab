-- STUDY LAB migration 001
-- Rollback idea:
--   drop type if exists audit_action_type;
--   drop type if exists audit_entity_type;
--   drop type if exists question_complete_reason;
--   drop type if exists question_request_status;
--   drop type if exists study_session_end_reason;
--   drop type if exists study_mic_policy;
--   drop type if exists study_camera_status;
--   drop type if exists study_connection_status;
--   drop type if exists study_session_status;
--   drop type if exists study_room_type;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'study_room_type') then
    create type study_room_type as enum (
      'MAIN',
      'QUESTION',
      'FALLBACK_MAIN'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'study_session_status') then
    create type study_session_status as enum (
      'ACTIVE',
      'EXITED',
      'DISCONNECTED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'study_connection_status') then
    create type study_connection_status as enum (
      'MAIN_ROOM',
      'QUESTION_PENDING',
      'QUESTION_ROOM',
      'EXITED',
      'DISCONNECTED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'study_camera_status') then
    create type study_camera_status as enum (
      'ON',
      'OFF'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'study_mic_policy') then
    create type study_mic_policy as enum (
      'MUTED_LOCKED',
      'OPEN'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'study_session_end_reason') then
    create type study_session_end_reason as enum (
      'USER_EXIT',
      'HEARTBEAT_TIMEOUT',
      'SYSTEM_TIMEOUT',
      'UNKNOWN_ERROR'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'question_request_status') then
    create type question_request_status as enum (
      'PENDING',
      'ACCEPTED',
      'COMPLETED',
      'CANCELED',
      'FAILED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'question_complete_reason') then
    create type question_complete_reason as enum (
      'STUDENT_CANCEL',
      'TEACHER_COMPLETE',
      'SYSTEM_TIMEOUT',
      'STUDENT_EXIT',
      'STUDENT_DISCONNECTED',
      'ACCEPT_FAILED',
      'AUTO_RECOVERY_FAILED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'audit_entity_type') then
    create type audit_entity_type as enum (
      'STUDY_SESSION',
      'QUESTION_REQUEST',
      'ROOM',
      'SYSTEM'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'audit_action_type') then
    create type audit_action_type as enum (
      'SESSION_ENTER',
      'SESSION_ENTER_REUSED',
      'SESSION_EXIT',
      'SESSION_DISCONNECTED',
      'HEARTBEAT_RECEIVED',
      'QUESTION_CREATED',
      'QUESTION_CANCELED',
      'QUESTION_ACCEPTED',
      'QUESTION_COMPLETED',
      'AUTO_RETURN_APPLIED',
      'CAMERA_CHANGED',
      'MIC_POLICY_APPLIED',
      'ERROR_RECOVERED',
      'ERROR_UNRECOVERED'
    );
  end if;
end $$;
