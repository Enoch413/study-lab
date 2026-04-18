-- STUDY LAB migration 008
-- Seed rooms for MVP.
-- Rollback idea:
--   delete from study_rooms where room_code in ('MAIN_001', 'QUESTION_ROOM_01', 'QUESTION_ROOM_02', 'QUESTION_ROOM_03', 'QUESTION_ROOM_04');

insert into study_rooms (
  room_code,
  room_name,
  room_type,
  logical_space_key,
  is_active,
  max_capacity,
  sort_order
)
values
  ('MAIN_001', '전체 공부방', 'MAIN', 'MAIN_STUDY', true, 100, 1),
  ('QUESTION_ROOM_01', '질문방 1', 'QUESTION', 'QUESTION_POOL', true, 2, 101),
  ('QUESTION_ROOM_02', '질문방 2', 'QUESTION', 'QUESTION_POOL', true, 2, 102),
  ('QUESTION_ROOM_03', '질문방 3', 'QUESTION', 'QUESTION_POOL', true, 2, 103),
  ('QUESTION_ROOM_04', '질문방 4', 'QUESTION', 'QUESTION_POOL', true, 2, 104)
on conflict (room_code) do update
set
  room_name = excluded.room_name,
  room_type = excluded.room_type,
  logical_space_key = excluded.logical_space_key,
  is_active = excluded.is_active,
  max_capacity = excluded.max_capacity,
  sort_order = excluded.sort_order,
  updated_at = now();
