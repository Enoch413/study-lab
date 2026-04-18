-- STUDY LAB migration 002
-- Rollback idea:
--   drop table if exists study_rooms;

create table if not exists study_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code varchar(50) not null,
  room_name varchar(100) not null,
  room_type study_room_type not null,
  logical_space_key varchar(50) not null,
  is_active boolean not null default true,
  max_capacity integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_study_rooms_max_capacity_positive check (max_capacity > 0),
  constraint chk_study_rooms_room_code_not_blank check (btrim(room_code) <> ''),
  constraint chk_study_rooms_room_name_not_blank check (btrim(room_name) <> ''),
  constraint chk_study_rooms_logical_space_not_blank check (btrim(logical_space_key) <> '')
);
