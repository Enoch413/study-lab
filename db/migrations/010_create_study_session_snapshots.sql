create table if not exists study_session_snapshots (
  study_session_id uuid primary key references study_sessions(id) on delete cascade,
  student_user_id uuid not null references users(id) on delete cascade,
  image_data_url text not null,
  captured_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint study_session_snapshots_image_is_jpeg
    check (image_data_url like 'data:image/jpeg;base64,%'),
  constraint study_session_snapshots_image_size
    check (length(image_data_url) <= 300000)
);

create index if not exists idx_study_session_snapshots_student_user_id
  on study_session_snapshots(student_user_id);

create index if not exists idx_study_session_snapshots_captured_at
  on study_session_snapshots(captured_at desc);

