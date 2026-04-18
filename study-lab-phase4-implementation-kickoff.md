# STUDY LAB 4단계 구현 착수 문서

## 문서 목적
이 문서는 3단계 기술 설계 확정본을 실제 구현 착수 단위로 내린 문서다.  
목표는 개발자가 바로 브랜치를 만들고, DB migration을 시작하고, 서버 API 뼈대와 프론트 화면 골격을 동시에 착수할 수 있게 만드는 것이다.

## 이번 문서에서 가정한 부분
| 항목 | 이번 문서의 가정 | 이유 |
|---|---|---|
| 웹 프레임워크 | `Next.js App Router + TypeScript` 기준으로 폴더 구조를 제안한다 | 사용자가 `app/pages`, `api routes`, `lib`, `features` 구조 예시를 요청했고, CODE LAB 포털 내부 기능으로 붙이기 가장 자연스럽다 |
| DB | `PostgreSQL` 기준으로 설계한다 | `partial unique index`, `timestamptz`, `jsonb`, `Asia/Seoul` 기준 집계가 명확하게 맞는다 |
| migration 방식 | ORM 종속이 아닌 `SQL-first migration` 기준으로 작성한다 | partial unique index와 상태 제약을 가장 정확하게 구현할 수 있다 |
| 인증 연동 | CODE LAB의 기존 세션/쿠키/사용자 테이블 접근 유틸이 이미 존재한다고 본다 | STUDY LAB 전용 로그인/회원가입을 만들지 않는다는 확정 조건을 따른다 |
| 사용자 테이블 | CODE LAB `users`는 기존 테이블을 그대로 참조만 한다 | 3단계 설계 확정안 유지 |

## 전제 고정
- STUDY LAB은 CODE LAB 내부 기능이다.
- 기존 로그인/로그아웃/세션/사용자 계정을 그대로 사용한다.
- STUDY LAB 전용 로그인, 로그아웃, 회원가입, 사용자 저장소는 만들지 않는다.
- 학생은 방 목록을 보지 않는다.
- 학생은 학생 대시보드에서 바로 `입실하기`를 누른다.
- 기본 운영은 전체 공부방 1개다.
- 질문이 있을 때만 학생과 강사가 1:1 질문방으로 이동한다.
- 질문 종료 후 학생은 자동으로 전체 공부방으로 복귀한다.

---

## 1. 구현 착수 계획

### 전체 구현 순서
| 순서 | 작업 | 산출물 |
|---|---|---|
| 1 | CODE LAB 인증/권한 어댑터 연결 | `requireCodeLabSession`, `mapStudyLabRole` |
| 2 | DB enum, 테이블, 인덱스, seed migration 작성 | `study_rooms`, `study_sessions`, `question_requests`, `daily_study_summaries`, `audit_logs` |
| 3 | study session 코어 서비스 구현 | 입실, 퇴실, heartbeat, camera update, ACTIVE 세션 1개 제한 |
| 4 | summary aggregation 구현 | 오늘 공부 시간 계산, 종료 세션 집계 반영 |
| 5 | 학생 대시보드 API + 화면 골격 구현 | `/me`, `/dashboard/student`, 입실/퇴실/카메라 토글 |
| 6 | 강사 대시보드 API + 화면 골격 구현 | `/dashboard/teacher`, `/questions/pending` |
| 7 | question domain 구현 | 질문 요청, 취소, 수락, 종료, 자동 복귀 |
| 8 | 1:1 질문방 화면 + 마이크 정책 UX 구현 | 질문방 이동, mic auto-on 안내, 복귀 처리 |
| 9 | 감사 로그, 복구 로직, 에러 코드, 테스트 정리 | audit log 적재, timeout/경계/경쟁 테스트 |

### 서버/DB/프론트 우선순위
| 우선순위 | 영역 | 이유 |
|---|---|---|
| 1 | DB | 세션 상태, 질문 상태, 일별 집계 구조가 고정되어야 API와 화면이 안정된다 |
| 2 | 서버 도메인 | ACTIVE 세션 1개 제한, timeout, auto return은 프론트보다 서버가 먼저 고정되어야 한다 |
| 3 | 학생 프론트 | 입실/퇴실/오늘 공부 시간 화면이 가장 빠른 검증 루프를 만든다 |
| 4 | 강사 프론트 | 전체 현황, 질문 대기, 질문 종료 흐름 검증에 필요하다 |
| 5 | 질문방 프론트 | media UX는 마지막에 붙여도 되지만 상태 전이와 자동 복귀는 반드시 연결 검증해야 한다 |

### 선행 작업
| 항목 | 내용 |
|---|---|
| CODE LAB auth helper 확인 | 현재 로그인 세션에서 `user.id`, `role`, `adminScope`를 가져오는 유틸 존재 여부 확인 |
| users 테이블 스키마 확인 | `users.id`, `name`, `role`, `adminScope` 컬럼명 실제 확인 |
| DB migration 실행 방식 확인 | `npm script`, `pnpm`, CI/CD migration 적용 경로 확인 |
| 공통 에러 응답 형식 확인 | CODE LAB 기존 API 에러 포맷과 HTTP status 규칙 재사용 여부 확인 |
| 포털 네비 구조 확인 | CODE LAB 포털 카드/드로어 메뉴에 STUDY LAB 링크를 추가할 위치 확인 |

### 병렬 진행 가능한 작업
| 병렬 작업 | 선행 조건 | 비고 |
|---|---|---|
| DB migration 작성 | users FK 구조 확인 | 서버 도메인과 병렬 가능 |
| role mapping 유틸 작성 | auth helper 확인 | 프론트/서버 공통 사용 |
| 학생 대시보드 UI shell | route 위치 결정 | 실제 API 없을 때 mock state로 먼저 가능 |
| 강사 대시보드 UI shell | route 위치 결정 | 테이블/카드 컴포넌트부터 시작 가능 |
| 에러 코드/타입 정의 | 없음 | 전 영역 공통 기반 |
| audit log action type 상수 작성 | enum 목록 확정 | 서버 서비스 병렬 가능 |

### 가장 먼저 검증해야 할 핵심 기능 5개
| 번호 | 기능 | 검증 이유 |
|---|---|---|
| 1 | 학생 `입실하기` 시 ACTIVE 세션 1개만 생성 | 이후 모든 로직의 기준점이다 |
| 2 | heartbeat 3분 timeout으로 `DISCONNECTED` 종료 | 접속 현황과 공부 시간 신뢰성의 핵심이다 |
| 3 | 오늘 공부 시간이 KST 자정 경계 기준으로 정확히 계산 | 운영 데이터 신뢰성의 핵심이다 |
| 4 | 강사 대시보드에서 현재 학생 상태가 정확히 조회 | 운영 화면의 핵심 가치를 검증한다 |
| 5 | 질문 수락 시 질문방 이동, 종료 시 자동 복귀 | STUDY LAB만의 핵심 차별 기능이다 |

---

## 2. 프로젝트 구조 제안

## 최종 제안 구조
```text
app/
  study-lab/
    page.tsx
    question/
      [questionId]/
        page.tsx
  api/
    study-lab/
      me/
        route.ts
      sessions/
        enter/
          route.ts
        [id]/
          exit/
            route.ts
          heartbeat/
            route.ts
          camera/
            route.ts
      questions/
        route.ts
        pending/
          route.ts
        [id]/
          cancel/
            route.ts
          accept/
            route.ts
          complete/
            route.ts
      dashboard/
        student/
          route.ts
        teacher/
          route.ts
      rooms/
        internal/
          route.ts

features/
  study-lab/
    components/
      student-dashboard.tsx
      teacher-dashboard.tsx
      question-room.tsx
      status-badge.tsx
      today-study-time-card.tsx
      question-queue-panel.tsx
    hooks/
      use-study-lab-me.ts
      use-student-dashboard.ts
      use-teacher-dashboard.ts
      use-question-room.ts
      use-heartbeat.ts
      use-student-polling.ts
    constants/
      enums.ts
      polling.ts
      error-codes.ts
      room-labels.ts
    types/
      api.ts
      domain.ts
      dto.ts
    validators/
      session.validator.ts
      question.validator.ts
      dashboard.validator.ts
    server/
      domains/
        session.domain.ts
        question.domain.ts
        dashboard.domain.ts
        room-allocation.domain.ts
        summary-aggregation.domain.ts
        audit-log.domain.ts
      repositories/
        study-room.repository.ts
        study-session.repository.ts
        question-request.repository.ts
        daily-study-summary.repository.ts
        audit-log.repository.ts
        user.repository.ts
      services/
        study-lab-auth.service.ts
        study-lab-error.service.ts
      mappers/
        role.mapper.ts
        dashboard.mapper.ts
        session.mapper.ts
      policies/
        session.policy.ts
        question.policy.ts
        mic.policy.ts
        camera.policy.ts
      jobs/
        heartbeat-timeout.job.ts
        daily-summary-reconcile.job.ts
      queries/
        teacher-dashboard.query.ts
        student-dashboard.query.ts

lib/
  auth/
    require-session.ts
    get-current-user.ts
  db/
    client.ts
    transaction.ts
    migrations/
  http/
    api-response.ts
    api-error.ts
  time/
    kst.ts
    duration.ts

tests/
  unit/
  integration/
  api/
  e2e/
```

### 구조 설계 원칙
| 원칙 | 적용 방식 |
|---|---|
| CODE LAB 내부 기능으로 자연스럽게 삽입 | `app/study-lab`, `app/api/study-lab` 아래로 한정 |
| 기능 단위 분리 | STUDY LAB 관련 코드는 `features/study-lab` 아래로 모은다 |
| 서버/프론트 경계 명확화 | 도메인/리포지토리/정책은 `features/study-lab/server`로 묶는다 |
| 기존 auth 재사용 | 공통 인증은 `lib/auth`, STUDY LAB role mapping은 `features/study-lab/server/services`에 둔다 |
| 테스트 위치 예측 가능 | `tests`는 유형별로 나누고 도메인 이름으로 파일명을 맞춘다 |

### 왜 이 구조를 쓰는가
| 선택 | 이유 |
|---|---|
| `app/study-lab/page.tsx` 단일 진입 | 학생/강사/관리자 모두 같은 모듈 진입점에서 역할에 따라 다른 화면을 렌더링할 수 있다 |
| `features/study-lab/server/domains` 분리 | session/question/summary가 서로 얽혀 있으므로 controller에 로직이 뭉치지 않게 한다 |
| `repositories` 분리 | DB 스키마 변경과 도메인 정책 변경의 충돌을 줄인다 |
| `policies` 분리 | 마이크/질문/세션 전이 규칙을 상수와 함수로 고정해 실수 방지한다 |
| `jobs` 분리 | heartbeat timeout, summary reconcile은 route handler와 별도의 실행점이 필요하다 |

---

## 3. DB 구현안

## 3-1. enum 정의
| enum 명 | 값 |
|---|---|
| `study_room_type` | `MAIN`, `QUESTION`, `FALLBACK_MAIN` |
| `study_session_status` | `ACTIVE`, `EXITED`, `DISCONNECTED` |
| `study_connection_status` | `MAIN_ROOM`, `QUESTION_PENDING`, `QUESTION_ROOM`, `EXITED`, `DISCONNECTED` |
| `study_camera_status` | `ON`, `OFF` |
| `study_mic_policy` | `MUTED_LOCKED`, `OPEN` |
| `study_session_end_reason` | `USER_EXIT`, `HEARTBEAT_TIMEOUT`, `SYSTEM_TIMEOUT`, `UNKNOWN_ERROR` |
| `question_request_status` | `PENDING`, `ACCEPTED`, `COMPLETED`, `CANCELED`, `FAILED` |
| `question_complete_reason` | `STUDENT_CANCEL`, `TEACHER_COMPLETE`, `SYSTEM_TIMEOUT`, `STUDENT_EXIT`, `STUDENT_DISCONNECTED`, `ACCEPT_FAILED`, `AUTO_RECOVERY_FAILED` |
| `audit_entity_type` | `STUDY_SESSION`, `QUESTION_REQUEST`, `ROOM`, `SYSTEM` |
| `audit_action_type` | `SESSION_ENTER`, `SESSION_ENTER_REUSED`, `SESSION_EXIT`, `SESSION_DISCONNECTED`, `HEARTBEAT_RECEIVED`, `QUESTION_CREATED`, `QUESTION_CANCELED`, `QUESTION_ACCEPTED`, `QUESTION_COMPLETED`, `AUTO_RETURN_APPLIED`, `CAMERA_CHANGED`, `MIC_POLICY_APPLIED`, `ERROR_RECOVERED`, `ERROR_UNRECOVERED` |

## 3-2. 테이블 정의서

### `study_rooms`
| 컬럼 | 타입 | null | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `uuid` | N | `gen_random_uuid()` | PK |
| `room_code` | `varchar(50)` | N |  | 내부 room 코드 |
| `room_name` | `varchar(100)` | N |  | 표시명 |
| `room_type` | `study_room_type` | N |  | MAIN/QUESTION/FALLBACK_MAIN |
| `logical_space_key` | `varchar(50)` | N |  | `MAIN_STUDY`, `QUESTION_POOL` 등 |
| `is_active` | `boolean` | N | `true` | 운영 가능 여부 |
| `max_capacity` | `integer` | N |  | room 최대 허용 인원 |
| `sort_order` | `integer` | N | `0` | 내부 정렬 |
| `created_at` | `timestamptz` | N | `now()` | 생성 시각 |
| `updated_at` | `timestamptz` | N | `now()` | 수정 시각 |

### `study_sessions`
| 컬럼 | 타입 | null | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `uuid` | N | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | N |  | CODE LAB users FK |
| `base_room_id` | `uuid` | N |  | 기본 전체 공부방 room |
| `current_room_id` | `uuid` | N |  | 현재 연결 room |
| `status` | `study_session_status` | N | `ACTIVE` | 세션 상태 |
| `connection_status` | `study_connection_status` | N | `MAIN_ROOM` | 현재 연결 위치 |
| `camera_status` | `study_camera_status` | N | `OFF` | 학생 수동 camera 표시 |
| `mic_policy` | `study_mic_policy` | N | `MUTED_LOCKED` | 학생 mic 정책 |
| `started_at` | `timestamptz` | N | `now()` | 입실 시각 |
| `ended_at` | `timestamptz` | Y |  | 종료 시각 |
| `last_heartbeat_at` | `timestamptz` | N | `now()` | 최근 heartbeat 시각 |
| `end_reason` | `study_session_end_reason` | Y |  | 종료 사유 |
| `client_instance_id` | `varchar(100)` | Y |  | 프론트 인스턴스 식별자 |
| `created_at` | `timestamptz` | N | `now()` | 생성 시각 |
| `updated_at` | `timestamptz` | N | `now()` | 수정 시각 |

### `question_requests`
| 컬럼 | 타입 | null | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `uuid` | N | `gen_random_uuid()` | PK |
| `study_session_id` | `uuid` | N |  | 대상 study session |
| `student_user_id` | `uuid` | N |  | 질문 학생 |
| `teacher_user_id` | `uuid` | Y |  | 수락 강사 |
| `question_room_id` | `uuid` | Y |  | 배정 질문방 |
| `status` | `question_request_status` | N | `PENDING` | 질문 상태 |
| `request_note` | `varchar(200)` | Y |  | 학생 질문 메모 |
| `requested_at` | `timestamptz` | N | `now()` | 요청 시각 |
| `accepted_at` | `timestamptz` | Y |  | 수락 시각 |
| `ended_at` | `timestamptz` | Y |  | 종료 시각 |
| `complete_reason` | `question_complete_reason` | Y |  | 종료 이유 |
| `auto_returned_at` | `timestamptz` | Y |  | 자동 복귀 완료 시각 |
| `created_at` | `timestamptz` | N | `now()` | 생성 시각 |
| `updated_at` | `timestamptz` | N | `now()` | 수정 시각 |

### `daily_study_summaries`
| 컬럼 | 타입 | null | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `uuid` | N | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | N |  | CODE LAB users FK |
| `summary_date_kst` | `date` | N |  | `Asia/Seoul` 기준 날짜 |
| `accumulated_seconds` | `integer` | N | `0` | 종료된 세션 누적 초 |
| `last_reconciled_at` | `timestamptz` | N | `now()` | 마지막 정산 시각 |
| `created_at` | `timestamptz` | N | `now()` | 생성 시각 |
| `updated_at` | `timestamptz` | N | `now()` | 수정 시각 |

### `audit_logs`
| 컬럼 | 타입 | null | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `uuid` | N | `gen_random_uuid()` | PK |
| `entity_type` | `audit_entity_type` | N |  | 로그 대상 타입 |
| `entity_id` | `uuid` | N |  | 로그 대상 id |
| `actor_user_id` | `uuid` | Y |  | 행위 주체 |
| `action_type` | `audit_action_type` | N |  | 로그 액션 |
| `payload_json` | `jsonb` | N | `'{}'::jsonb` | 상세 부가 정보 |
| `created_at` | `timestamptz` | N | `now()` | 기록 시각 |

## 3-3. PK / FK
| 테이블 | PK | FK |
|---|---|---|
| `study_rooms` | `id` | 없음 |
| `study_sessions` | `id` | `user_id -> users.id`, `base_room_id -> study_rooms.id`, `current_room_id -> study_rooms.id` |
| `question_requests` | `id` | `study_session_id -> study_sessions.id`, `student_user_id -> users.id`, `teacher_user_id -> users.id`, `question_room_id -> study_rooms.id` |
| `daily_study_summaries` | `id` | `user_id -> users.id` |
| `audit_logs` | `id` | `actor_user_id -> users.id` |

## 3-4. unique / partial unique / index
| 분류 | 이름 | 대상 | 설명 |
|---|---|---|---|
| unique | `uq_study_rooms_room_code` | `study_rooms(room_code)` | room 코드 중복 방지 |
| unique | `uq_daily_summary_user_date` | `daily_study_summaries(user_id, summary_date_kst)` | 일자별 1행 보장 |
| partial unique | `uq_active_session_per_user` | `study_sessions(user_id) where status='ACTIVE'` | 학생 1명당 ACTIVE 세션 1개 제한 |
| partial unique | `uq_open_question_per_student` | `question_requests(student_user_id) where status in ('PENDING','ACCEPTED')` | open question 중복 방지 |
| partial unique | `uq_active_question_room` | `question_requests(question_room_id) where status='ACCEPTED' and question_room_id is not null` | 질문방 중복 배정 방지 |
| index | `idx_study_rooms_type_active` | `study_rooms(room_type, is_active)` | room pool 조회 |
| index | `idx_study_rooms_logical_space` | `study_rooms(logical_space_key, is_active)` | logical space 기준 조회 |
| index | `idx_study_sessions_dashboard` | `study_sessions(status, connection_status, current_room_id, last_heartbeat_at)` | 강사 대시보드 핵심 조회 |
| index | `idx_study_sessions_user_started` | `study_sessions(user_id, started_at desc)` | 학생 최근 세션 조회 |
| index | `idx_study_sessions_room_active` | `study_sessions(current_room_id, status, last_heartbeat_at)` | room 사용량 조회 |
| index | `idx_question_requests_pending` | `question_requests(status, requested_at)` | 질문 대기열 조회 |
| index | `idx_question_requests_student_open` | `question_requests(student_user_id, status)` | 학생 open question 확인 |
| index | `idx_question_requests_teacher_status` | `question_requests(teacher_user_id, status, updated_at desc)` | 강사 처리 목록 조회 |
| index | `idx_daily_summary_date` | `daily_study_summaries(summary_date_kst)` | 날짜 기준 집계 |
| index | `idx_daily_summary_user` | `daily_study_summaries(user_id, summary_date_kst desc)` | 학생별 조회 |
| index | `idx_audit_entity` | `audit_logs(entity_type, entity_id, created_at desc)` | 엔터티 단위 감사 조회 |
| index | `idx_audit_actor` | `audit_logs(actor_user_id, created_at desc)` | 행위자 기준 조회 |
| index | `idx_audit_action` | `audit_logs(action_type, created_at desc)` | 액션별 조회 |

## 3-5. 제약 조건
| 테이블 | 제약 |
|---|---|
| `study_rooms` | `max_capacity > 0` |
| `study_sessions` | `status='ACTIVE'`면 `ended_at is null` |
| `study_sessions` | `status in ('EXITED','DISCONNECTED')`면 `ended_at is not null` |
| `study_sessions` | `last_heartbeat_at >= started_at` |
| `question_requests` | `status='ACCEPTED'`면 `teacher_user_id`, `question_room_id`, `accepted_at` 필수 |
| `question_requests` | `status in ('COMPLETED','CANCELED','FAILED')`면 `ended_at`, `complete_reason` 필수 |
| `daily_study_summaries` | `accumulated_seconds >= 0` |

## 3-6. seed data 항목
| 순서 | 항목 | 값 |
|---|---|---|
| 1 | MAIN room | `room_code=MAIN_001`, `room_name=전체 공부방`, `room_type=MAIN`, `logical_space_key=MAIN_STUDY`, `is_active=true`, `max_capacity=100`, `sort_order=1` |
| 2 | QUESTION room 1 | `QUESTION_ROOM_01`, `질문방 1`, `QUESTION`, `QUESTION_POOL`, `true`, `2`, `101` |
| 3 | QUESTION room 2 | `QUESTION_ROOM_02`, `질문방 2`, `QUESTION`, `QUESTION_POOL`, `true`, `2`, `102` |
| 4 | QUESTION room 3 | `QUESTION_ROOM_03`, `질문방 3`, `QUESTION`, `QUESTION_POOL`, `true`, `2`, `103` |
| 5 | QUESTION room 4 | `QUESTION_ROOM_04`, `질문방 4`, `QUESTION`, `QUESTION_POOL`, `true`, `2`, `104` |
| 6 | fallback main room | 초기 migration에는 생성하지 않고 필요 시 후속 migration 또는 운영 script로 추가 |

## 3-7. migration 파일 단위 계획
| 순서 | 파일명 | 내용 |
|---|---|---|
| 001 | `001_create_study_lab_enums.sql` | DB enum 생성 |
| 002 | `002_create_study_rooms.sql` | `study_rooms` 테이블 생성 |
| 003 | `003_create_study_sessions.sql` | `study_sessions` 테이블, FK, check constraint 생성 |
| 004 | `004_create_question_requests.sql` | `question_requests` 테이블 생성 |
| 005 | `005_create_daily_study_summaries.sql` | `daily_study_summaries` 생성 |
| 006 | `006_create_audit_logs.sql` | `audit_logs` 생성 |
| 007 | `007_create_study_lab_indexes.sql` | 일반 index, unique, partial unique index 생성 |
| 008 | `008_seed_study_rooms.sql` | MAIN/QUESTION room seed 데이터 입력 |
| 009 | `009_add_updated_at_triggers.sql` | `updated_at` 자동 갱신 trigger 또는 공통 함수 연결 |

## 3-8. migration 순서 규칙
1. enum 먼저 생성한다.
2. FK가 적은 `study_rooms`부터 만든다.
3. `study_sessions`를 만든 뒤 `question_requests`를 만든다.
4. read 성능용 `daily_study_summaries`와 운영용 `audit_logs`를 뒤에 추가한다.
5. partial unique index는 테이블 생성 직후가 아니라 기본 컬럼과 FK가 완성된 뒤 한 번에 건다.
6. seed는 모든 제약과 인덱스 생성이 끝난 뒤 넣는다.

---

## 4. API 구현 우선순위 정리

## A. 1차 필수 구현
| API | 목적 | 사용 주체 | 선행조건 | 필요한 DB 접근 | 트랜잭션 | 멱등 | 테스트 우선순위 |
|---|---|---|---|---|---|---|---|
| `GET /study-lab/me` | 현재 사용자 role 매핑과 active 상태 조회 | 학생/강사/관리자 | 로그인 세션 확보 | `users`, `study_sessions`, `question_requests`, `daily_study_summaries` read | 아니오 | 예 | 높음 |
| `POST /study-lab/sessions/enter` | study session 시작 | 학생 | role mapping 완료, MAIN room 존재 | `study_rooms` read, `study_sessions` read/write, `audit_logs` insert | 예 | 예 | 최상 |
| `POST /study-lab/sessions/{id}/exit` | 세션 정상 종료 | 학생 | ACTIVE 세션 존재 | `study_sessions` update, `question_requests` read/update 가능, `daily_study_summaries` upsert, `audit_logs` insert | 예 | 예 | 최상 |
| `POST /study-lab/sessions/{id}/heartbeat` | 연결 유지 갱신 | 학생 | ACTIVE 세션 존재 | `study_sessions` update, `audit_logs` insert(선택) | 아니오 | 예 | 최상 |
| `POST /study-lab/sessions/{id}/camera` | 카메라 표시 상태 변경 | 학생 | ACTIVE 세션 존재 | `study_sessions` update, `audit_logs` insert | 예 | 예 | 중간 |
| `GET /study-lab/dashboard/student` | 학생 대시보드 상태 조회 | 학생 | 로그인 세션 | `study_sessions`, `question_requests`, `daily_study_summaries` read | 아니오 | 예 | 높음 |
| `GET /study-lab/dashboard/teacher` | 강사 대시보드 현황 조회 | 강사/관리자 | role mapping 완료 | `users`, `study_sessions`, `daily_study_summaries`, `question_requests` read | 아니오 | 예 | 최상 |

## B. 2차 구현
| API | 목적 | 사용 주체 | 선행조건 | 필요한 DB 접근 | 트랜잭션 | 멱등 | 테스트 우선순위 |
|---|---|---|---|---|---|---|---|
| `POST /study-lab/questions` | 질문 요청 생성 | 학생 | ACTIVE 세션, MAIN_ROOM, open question 없음 | `study_sessions` read/update, `question_requests` insert, `audit_logs` insert | 예 | 아니오 | 최상 |
| `POST /study-lab/questions/{id}/cancel` | 수락 전 질문 취소 | 학생 | question status=`PENDING` | `question_requests` update, `study_sessions` update, `audit_logs` insert | 예 | 예 | 높음 |
| `GET /study-lab/questions/pending` | 질문 대기열 조회 | 강사/관리자 | role mapping 완료 | `question_requests`, `users` read | 아니오 | 예 | 높음 |
| `POST /study-lab/questions/{id}/accept` | 질문 수락, 질문방 배정 | 강사/관리자 | `PENDING` question, 질문방 여유, student ACTIVE | `question_requests` update, `study_rooms` read/lock, `study_sessions` update, `audit_logs` insert | 예 | 아니오 | 최상 |
| `POST /study-lab/questions/{id}/complete` | 질문 종료 및 학생 복귀 | 강사/시스템 | `ACCEPTED` question 존재 | `question_requests` update, `study_sessions` update, `audit_logs` insert | 예 | 예 | 최상 |

## C. 후순위 구현
| API | 목적 | 사용 주체 | 선행조건 | 필요한 DB 접근 | 트랜잭션 | 멱등 | 테스트 우선순위 |
|---|---|---|---|---|---|---|---|
| `GET /study-lab/rooms/internal` | room pool, 사용량, fallback 상태 점검 | 관리자 | admin 권한 | `study_rooms`, `study_sessions`, `question_requests` read | 아니오 | 예 | 중간 |

## 그룹별 구현 원칙
| 그룹 | 구현 목적 |
|---|---|
| A | 학생 입실/퇴실과 강사 현황판까지 먼저 살아 있게 만든다 |
| B | 질문 흐름과 자동 복귀를 올린다 |
| C | 내부 운영 진단 기능을 마지막에 붙인다 |

---

## 5. 서버 도메인 로직 분리안

### `session domain`
| 항목 | 내용 |
|---|---|
| 책임 | 입실, 퇴실, heartbeat, 카메라 상태 변경, ACTIVE 세션 1개 제한, 세션 종료 시 summary 반영 호출 |
| 주요 함수 | `enterSession`, `exitSession`, `recordHeartbeat`, `updateCameraStatus`, `getActiveSessionByUser`, `markSessionDisconnected` |
| 입력 | `userId`, `sessionId`, `clientInstanceId`, `cameraStatus`, `serverNow` |
| 출력 | `StudySession`, `EnterSessionResult`, `ExitSessionResult` |
| 의존 관계 | `study-session.repository`, `study-room.repository`, `summary-aggregation.domain`, `audit-log.domain`, `session.policy` |

### `question domain`
| 항목 | 내용 |
|---|---|
| 책임 | 질문 요청 생성/취소/수락/종료, 학생 자동 복귀, 질문 실패 처리 |
| 주요 함수 | `createQuestionRequest`, `cancelQuestionRequest`, `acceptQuestionRequest`, `completeQuestionRequest`, `failQuestionRequest` |
| 입력 | `questionId`, `studentUserId`, `teacherUserId`, `studySessionId`, `serverNow` |
| 출력 | `QuestionRequest`, `QuestionAcceptResult`, `QuestionCompleteResult` |
| 의존 관계 | `question-request.repository`, `study-session.repository`, `room-allocation.domain`, `audit-log.domain`, `question.policy` |

### `dashboard domain`
| 항목 | 내용 |
|---|---|
| 책임 | 학생 대시보드 view model, 강사 대시보드 view model, 검색/필터 정규화 |
| 주요 함수 | `getStudentDashboard`, `getTeacherDashboard`, `getStudyLabMe`, `getPendingQuestions` |
| 입력 | `userId`, `search`, `onlyActive`, `page`, `pageSize` |
| 출력 | 학생/강사 API DTO |
| 의존 관계 | `teacher-dashboard.query`, `student-dashboard.query`, `daily-study-summary.repository`, `question-request.repository`, `dashboard.mapper` |

### `room allocation domain`
| 항목 | 내용 |
|---|---|
| 책임 | MAIN room 해석, 사용 가능한 QUESTION room 할당, 질문 종료 시 room 점유 해제 관점 처리 |
| 주요 함수 | `getMainStudyRoom`, `allocateQuestionRoom`, `releaseQuestionRoom`, `resolveLogicalRoomLabel` |
| 입력 | `serverNow`, `questionId` |
| 출력 | `StudyRoom`, `AllocatedQuestionRoom` |
| 의존 관계 | `study-room.repository`, `question-request.repository` |

### `summary aggregation domain`
| 항목 | 내용 |
|---|---|
| 책임 | 종료 세션을 KST 날짜 경계로 분할 집계, today live delta 계산, 일별 summary upsert |
| 주요 함수 | `reconcileClosedSession`, `calculateTodayStudySeconds`, `splitSessionByKstDate`, `upsertDailySummary` |
| 입력 | `session`, `serverNow`, `todayKstDate` |
| 출력 | `todayStudySeconds`, `DailySummary[]` |
| 의존 관계 | `daily-study-summary.repository`, `lib/time/kst`, `study-session.repository` |

### `audit log domain`
| 항목 | 내용 |
|---|---|
| 책임 | 도메인 이벤트를 공통 포맷으로 적재, 오류 복구/실패 로그 적재 |
| 주요 함수 | `appendAuditLog`, `logSessionEvent`, `logQuestionEvent`, `logErrorRecovery` |
| 입력 | `entityType`, `entityId`, `actorUserId`, `actionType`, `payload` |
| 출력 | 없음 |
| 의존 관계 | `audit-log.repository` |

## 도메인 호출 방향
```text
route handler
  -> auth service / role mapper
  -> domain
    -> policy
    -> repository
    -> other domain (필요 최소화)
  -> mapper
  -> api response
```

## 도메인 분리 규칙
1. route handler에는 권한 확인, request parse, response mapping만 둔다.
2. 상태 전이 판단은 domain/policy에서만 한다.
3. repository는 SQL 수행과 row mapping만 담당한다.
4. summary 계산은 dashboard query에서 직접 하지 않고 `summary aggregation domain`에 모은다.
5. question accept/complete는 반드시 transaction boundary 안에서 실행한다.

---

## 6. 상태 전이 구현 규칙

## 6-1. `study_session.status`
| 현재 상태 | 허용 전이 | 금지 전이 | 서버 검증 위치 | 예외 코드 | 롤백 필요 상황 |
|---|---|---|---|---|---|
| 없음 | `ACTIVE` | 직접 `EXITED`, `DISCONNECTED` 생성 | `session.domain.enterSession` | `NO_ACTIVE_MAIN_ROOM` | insert 실패, room 조회 실패 |
| `ACTIVE` | `EXITED`, `DISCONNECTED` | 다시 `ACTIVE` 생성, 종료 후 재heartbeat | `session.policy.assertSessionActiveForMutation` | `SESSION_NOT_ACTIVE`, `SESSION_ALREADY_ENDED`, `INVALID_SESSION_TRANSITION` | 종료 처리 중 summary 반영 실패, open question 정리 실패 |
| `EXITED` | 없음 | 모든 상태 | `session.policy.assertSessionMutable` | `SESSION_ALREADY_ENDED` | 없음 |
| `DISCONNECTED` | 없음 | 모든 상태 | `session.policy.assertSessionMutable` | `SESSION_ALREADY_ENDED` | 없음 |

## 6-2. `study_session.connection_status`
| 현재 상태 | 허용 전이 | 금지 전이 | 서버 검증 위치 | 예외 코드 | 롤백 필요 상황 |
|---|---|---|---|---|---|
| `MAIN_ROOM` | `QUESTION_PENDING`, `EXITED`, `DISCONNECTED` | 바로 `QUESTION_ROOM`로 점프 | `question.domain.createQuestionRequest`, `session.domain.exitSession` | `SESSION_NOT_IN_MAIN_ROOM`, `INVALID_CONNECTION_STATUS_TRANSITION` | question 생성 insert 실패 |
| `QUESTION_PENDING` | `MAIN_ROOM`, `QUESTION_ROOM`, `EXITED`, `DISCONNECTED` | 중복 `QUESTION_PENDING` 생성 | `question.domain.cancelQuestionRequest`, `question.domain.acceptQuestionRequest` | `QUESTION_ALREADY_EXISTS`, `INVALID_CONNECTION_STATUS_TRANSITION` | accept 트랜잭션 실패 |
| `QUESTION_ROOM` | `MAIN_ROOM`, `EXITED`, `DISCONNECTED` | 새 질문 요청 생성, 다시 `QUESTION_PENDING` | `question.domain.completeQuestionRequest`, `session.domain.exitSession` | `QUESTION_NOT_COMPLETABLE`, `INVALID_CONNECTION_STATUS_TRANSITION` | auto return 실패 |
| `EXITED` | 없음 | 모든 상태 | `session.policy.assertConnectionMutable` | `SESSION_ALREADY_ENDED` | 없음 |
| `DISCONNECTED` | 없음 | 모든 상태 | `session.policy.assertConnectionMutable` | `SESSION_ALREADY_ENDED` | 없음 |

## 6-3. `question_request.status`
| 현재 상태 | 허용 전이 | 금지 전이 | 서버 검증 위치 | 예외 코드 | 롤백 필요 상황 |
|---|---|---|---|---|---|
| 없음 | `PENDING` | 직접 `ACCEPTED`, `COMPLETED`, `FAILED` 생성 | `question.domain.createQuestionRequest` | `QUESTION_ALREADY_EXISTS`, `SESSION_NOT_IN_MAIN_ROOM` | insert 실패 |
| `PENDING` | `CANCELED`, `ACCEPTED` | `COMPLETED`, `FAILED` 직접 전이 | `question.policy.assertPendingQuestion`, `question.domain.acceptQuestionRequest` | `QUESTION_NOT_CANCELABLE`, `QUESTION_ALREADY_ACCEPTED`, `QUESTION_ROOM_UNAVAILABLE` | room 할당 실패, session 상태 업데이트 실패 |
| `ACCEPTED` | `COMPLETED`, `FAILED` | `CANCELED`, 재`ACCEPTED` | `question.policy.assertAcceptedQuestion`, `question.domain.completeQuestionRequest` | `QUESTION_NOT_COMPLETABLE`, `QUESTION_ALREADY_COMPLETED` | auto return 실패, session room update 실패 |
| `COMPLETED` | 없음 | 모든 상태 | `question.policy.assertQuestionOpen` | `QUESTION_ALREADY_COMPLETED` | 없음 |
| `CANCELED` | 없음 | 모든 상태 | `question.policy.assertQuestionOpen` | `QUESTION_NOT_CANCELABLE` | 없음 |
| `FAILED` | 없음 | 모든 상태 | `question.policy.assertQuestionOpen` | `QUESTION_ALREADY_FAILED` | 없음 |

## 구현 규칙
1. 상태 전이는 반드시 domain 함수 내부에서만 일어난다.
2. repository update는 항상 `WHERE current_status = ...` 조건을 포함한다.
3. accept/complete/exit는 다중 테이블을 수정하므로 transaction으로 감싼다.
4. 상태 전이와 audit log는 같은 transaction 안에서 처리한다.
5. transaction 중 하나라도 실패하면 상태 전이 전체를 rollback한다.

---

## 7. 프론트 구현 순서

## 7-1. 학생 대시보드
| 항목 | 내용 |
|---|---|
| 구현 순서 | 1순위 |
| 필요한 API | `GET /study-lab/me`, `GET /study-lab/dashboard/student`, `POST /study-lab/sessions/enter`, `POST /study-lab/sessions/{id}/exit`, `POST /study-lab/sessions/{id}/camera`, `POST /study-lab/questions`, `POST /study-lab/questions/{id}/cancel` |
| 필요한 상태값 | `mappedRole`, `session.status`, `connectionStatus`, `todayStudySeconds`, `cameraStatus`, `question.status`, `recentSessions` |
| 로딩 상태 | 첫 진입 skeleton 카드, 버튼 disabled |
| 빈 상태 | 오늘 세션 없음, 질문 없음 |
| 오류 상태 | 초기 로드 실패, mutation 실패, heartbeat 종료 감지 |
| 버튼 액션 | `입실하기`, `퇴실하기`, `카메라 ON/OFF`, `질문 요청`, `질문 취소` |
| polling 필요 여부 | `active session` 있으면 5초 poll + 60초 heartbeat, 없으면 poll 중지 |
| 권한 체크 방식 | `GET /study-lab/me`의 `mappedRole=student` 확인 후 렌더링 |
| 구현 메모 | 질문 수락 감지는 5초 poll로 받고, `QUESTION_ROOM` 전이 시 자동 라우팅 |

## 7-2. 강사 대시보드
| 항목 | 내용 |
|---|---|
| 구현 순서 | 2순위 |
| 필요한 API | `GET /study-lab/me`, `GET /study-lab/dashboard/teacher`, `GET /study-lab/questions/pending`, `POST /study-lab/questions/{id}/accept`, `POST /study-lab/questions/{id}/complete` |
| 필요한 상태값 | 학생 목록, 검색어, `onlyActive`, `questionStatus`, `cameraStatus`, `todayStudySeconds`, `serverNow` |
| 로딩 상태 | 리스트 skeleton, pending queue skeleton |
| 빈 상태 | 학생 없음, 대기 질문 없음 |
| 오류 상태 | 대시보드 조회 실패, 질문 수락/종료 실패 |
| 버튼 액션 | 질문 수락, 질문 종료, 검색, `입실 중만 보기` 필터 |
| polling 필요 여부 | 30초 poll |
| 권한 체크 방식 | `mappedRole=teacher` 또는 `mappedRole=admin` |
| 구현 메모 | 검색 중 자동 갱신이 발생해도 마지막 query string 유지 |

## 7-3. 1:1 질문방 화면
| 항목 | 내용 |
|---|---|
| 구현 순서 | 3순위 |
| 필요한 API | `GET /study-lab/me`, `GET /study-lab/dashboard/student` 또는 `GET /study-lab/dashboard/teacher`, `POST /study-lab/questions/{id}/complete` |
| 필요한 상태값 | `question.status`, `question.id`, `session.connectionStatus`, `micPolicy`, `roomLabel`, 상대방 이름 |
| 로딩 상태 | `질문방에 연결 중입니다` 오버레이 |
| 빈 상태 | 없음. 권한이 없으면 바로 진입 차단 |
| 오류 상태 | mic auto-on 실패, 질문방 진입 권한 실패, 질문 종료 실패 |
| 버튼 액션 | 강사의 `질문 종료`, 학생/강사의 `마이크 다시 켜기` 브라우저 권한 재시도 |
| polling 필요 여부 | 5초 poll 유지. 상태가 `MAIN_ROOM`으로 돌아오면 자동 이탈 |
| 권한 체크 방식 | question의 student/teacher 소유자와 현재 사용자 일치 여부 확인 |
| 구현 메모 | mic 상태 자체는 브라우저 권한/장치 상태 기반으로 UI 처리하고, DB에는 학생 `mic_policy`만 반영 |

## 프론트 구현 순서 요약
1. `app/study-lab/page.tsx`에서 역할 분기 골격을 만든다.
2. 학생 대시보드에 입실/퇴실/오늘 공부 시간만 먼저 붙인다.
3. 강사 대시보드에 현재 학생 목록과 검색/필터를 붙인다.
4. 질문 버튼과 대기 상태를 학생/강사 화면에 붙인다.
5. 마지막에 질문방 화면과 자동 라우팅을 붙인다.

---

## 8. 테스트 계획

## 가장 먼저 작성할 테스트
| 순서 | 테스트 | 이유 |
|---|---|---|
| 1 | `enterSession`가 ACTIVE 세션 1개만 유지하는지 | 전체 도메인의 기준 |
| 2 | `splitSessionByKstDate`가 자정 경계를 정확히 나누는지 | 공부 시간 정확도의 핵심 |
| 3 | `recordHeartbeat`와 timeout 처리 | 자동 종료 정책의 핵심 |
| 4 | `acceptQuestionRequest` 동시성 테스트 | 질문 수락 경쟁의 핵심 |
| 5 | `completeQuestionRequest`가 학생을 MAIN_ROOM으로 자동 복귀시키는지 | 질문 흐름 완결성의 핵심 |

## 단위 테스트
| 범위 | 테스트 항목 |
|---|---|
| session policy | ACTIVE 세션 전이 허용/금지 규칙 |
| question policy | PENDING/ACCEPTED/terminal 상태 규칙 |
| role mapper | `student`, `admin+assigned`, `admin+all` 매핑 |
| summary aggregation | KST 날짜 경계 분할, live delta 계산 |
| dashboard mapper | 학생/강사 응답 DTO 포맷 |
| error mapping | 예외 코드 -> HTTP status 변환 |

## 통합 테스트
| 범위 | 테스트 항목 |
|---|---|
| DB + session domain | 중복 입실 시 기존 ACTIVE 세션 재사용 |
| DB + session domain | heartbeat 3분 초과 시 DISCONNECTED 종료 |
| DB + question domain | open question 중복 생성 차단 |
| DB + question domain | 질문 수락 시 question room 단일 배정 |
| DB + question domain | 질문 종료 시 session이 MAIN_ROOM으로 복귀 |
| DB + summary domain | EXITED/DISCONNECTED 종료 시 summary upsert |
| DB + dashboard query | teacher dashboard 100명 조회 성능 기준 확인 |

## API 테스트
| API 그룹 | 테스트 항목 |
|---|---|
| 세션 API | enter/exit/heartbeat/camera의 권한, 상태코드, 멱등 처리 |
| 질문 API | create/cancel/accept/complete의 상태 전이, 오류 코드 |
| 대시보드 API | 학생은 본인 정보만, 강사는 전체 학생 조회 가능 |
| internal API | admin만 `/rooms/internal` 접근 가능 |

## E2E 테스트
| 시나리오 | 테스트 항목 |
|---|---|
| 학생 기본 흐름 | 로그인 -> STUDY LAB 진입 -> 입실 -> 공부 시간 증가 -> 퇴실 |
| 강사 현황 흐름 | 강사 로그인 -> 학생 입실 확인 -> 검색/필터 확인 |
| 질문 흐름 | 학생 질문 요청 -> 강사 수락 -> 질문방 이동 -> 질문 종료 -> 자동 복귀 |
| 오류 흐름 | 학생 heartbeat 중단 -> DISCONNECTED 표시 |
| 모바일 흐름 | 백그라운드 2분 유지 / 4분 종료 |

## 꼭 포함해야 하는 핵심 테스트
| 항목 | 테스트 설명 |
|---|---|
| 동시성 이슈 테스트 | 같은 question에 두 강사가 동시에 accept할 때 1건만 성공 |
| 중복 입실 테스트 | 학생이 입실 버튼을 여러 번 눌러도 ACTIVE 세션 1개만 존재 |
| 질문 수락 경쟁 테스트 | partial unique + transaction이 room 이중 배정을 막는지 확인 |
| heartbeat timeout 테스트 | `last_heartbeat_at` 기준으로 `ended_at`이 저장되는지 확인 |
| 자정 경계 집계 테스트 | 23:50~00:10 세션이 KST 기준으로 하루씩 분할되는지 확인 |

---

## 9. 이번 단계 산출물

## 개발 착수 체크리스트
| 체크 | 항목 |
|---|---|
| [ ] | CODE LAB auth helper에서 `user.id`, `role`, `adminScope` 읽기 확인 |
| [ ] | users 테이블 실제 컬럼명 확인 |
| [ ] | migration 실행 경로 결정 |
| [ ] | `study-lab` route 경로 확정 |
| [ ] | 에러 응답 공통 포맷 확정 |
| [ ] | enum/migration 파일 생성 |
| [ ] | MAIN/QUESTION room seed 적용 |
| [ ] | session domain 골격 작성 |
| [ ] | `/sessions/enter` API 작성 |
| [ ] | `/dashboard/student`, `/dashboard/teacher` 첫 응답 연결 |
| [ ] | heartbeat scheduler/hook 연결 |
| [ ] | question domain transaction 구현 |
| [ ] | 질문방 자동 복귀 검증 |
| [ ] | 핵심 테스트 5개 작성 |

## migration 파일 목록 초안
| 순서 | 파일명 |
|---|---|
| 001 | `db/migrations/001_create_study_lab_enums.sql` |
| 002 | `db/migrations/002_create_study_rooms.sql` |
| 003 | `db/migrations/003_create_study_sessions.sql` |
| 004 | `db/migrations/004_create_question_requests.sql` |
| 005 | `db/migrations/005_create_daily_study_summaries.sql` |
| 006 | `db/migrations/006_create_audit_logs.sql` |
| 007 | `db/migrations/007_create_study_lab_indexes.sql` |
| 008 | `db/migrations/008_seed_study_rooms.sql` |
| 009 | `db/migrations/009_add_updated_at_triggers.sql` |

## API 파일 목록 초안
| 경로 |
|---|
| `app/api/study-lab/me/route.ts` |
| `app/api/study-lab/sessions/enter/route.ts` |
| `app/api/study-lab/sessions/[id]/exit/route.ts` |
| `app/api/study-lab/sessions/[id]/heartbeat/route.ts` |
| `app/api/study-lab/sessions/[id]/camera/route.ts` |
| `app/api/study-lab/questions/route.ts` |
| `app/api/study-lab/questions/pending/route.ts` |
| `app/api/study-lab/questions/[id]/cancel/route.ts` |
| `app/api/study-lab/questions/[id]/accept/route.ts` |
| `app/api/study-lab/questions/[id]/complete/route.ts` |
| `app/api/study-lab/dashboard/student/route.ts` |
| `app/api/study-lab/dashboard/teacher/route.ts` |
| `app/api/study-lab/rooms/internal/route.ts` |

## 프론트 화면 파일 목록 초안
| 경로 |
|---|
| `app/study-lab/page.tsx` |
| `app/study-lab/question/[questionId]/page.tsx` |
| `features/study-lab/components/student-dashboard.tsx` |
| `features/study-lab/components/teacher-dashboard.tsx` |
| `features/study-lab/components/question-room.tsx` |
| `features/study-lab/components/question-queue-panel.tsx` |
| `features/study-lab/components/status-badge.tsx` |
| `features/study-lab/hooks/use-study-lab-me.ts` |
| `features/study-lab/hooks/use-student-dashboard.ts` |
| `features/study-lab/hooks/use-teacher-dashboard.ts` |
| `features/study-lab/hooks/use-question-room.ts` |
| `features/study-lab/hooks/use-heartbeat.ts` |
| `features/study-lab/hooks/use-student-polling.ts` |

## 구현 순서 요약
1. auth + role mapper를 만든다.
2. migration과 seed를 적용한다.
3. session domain과 enter/exit/heartbeat API를 먼저 만든다.
4. student dashboard를 붙여 실제 세션이 보이게 한다.
5. teacher dashboard를 붙여 운영자 관점에서 상태를 검증한다.
6. question domain과 질문방 흐름을 붙인다.
7. audit log와 timeout/경쟁 테스트를 정리한다.

## 위험한 부분 TOP 10
| 번호 | 위험 요소 | 이유 |
|---|---|---|
| 1 | ACTIVE 세션 중복 생성 | 모든 데이터 신뢰성을 깨뜨린다 |
| 2 | question accept 경쟁 처리 | 질문방 이중 배정과 강사 충돌이 날 수 있다 |
| 3 | auto return 실패 | 학생이 질문방 상태에 고립될 수 있다 |
| 4 | heartbeat timeout 기준 오차 | 공부 시간 계산이 틀어질 수 있다 |
| 5 | KST 날짜 경계 집계 오류 | 오늘 공부 시간이 잘못 나온다 |
| 6 | teacher dashboard join 성능 | 100명 기준 화면이 느려질 수 있다 |
| 7 | role mapping 오해 | 학생이 강사 API를 보거나 반대 케이스가 날 수 있다 |
| 8 | 새로고침/다른 기기 진입 처리 | 세션이 끊기거나 중복 생성될 수 있다 |
| 9 | 브라우저 mic auto-on 실패 UX | 질문방 진입 후 사용자가 혼란을 겪을 수 있다 |
| 10 | audit log 누락 | 운영 이슈 발생 시 복구와 추적이 어려워진다 |

## 내가 바로 코딩 시작할 때 가장 먼저 만들 파일 10개
| 순서 | 파일 |
|---|---|
| 1 | `features/study-lab/server/mappers/role.mapper.ts` |
| 2 | `features/study-lab/constants/error-codes.ts` |
| 3 | `features/study-lab/server/policies/session.policy.ts` |
| 4 | `features/study-lab/server/policies/question.policy.ts` |
| 5 | `features/study-lab/server/repositories/study-session.repository.ts` |
| 6 | `features/study-lab/server/repositories/study-room.repository.ts` |
| 7 | `features/study-lab/server/domains/session.domain.ts` |
| 8 | `app/api/study-lab/sessions/enter/route.ts` |
| 9 | `app/api/study-lab/dashboard/student/route.ts` |
| 10 | `features/study-lab/components/student-dashboard.tsx` |

---

## 추천 구현 시작 순서

### 하루차
- 인증 연동 확인
- role mapper 작성
- enum migration 작성
- `study_rooms`, `study_sessions` migration 작성
- `enterSession` 도메인 + `POST /sessions/enter` 구현
- 학생 대시보드 기본 페이지와 `입실하기` 버튼 연결

### 이틀차
- `exitSession`, `recordHeartbeat`, `updateCameraStatus` 구현
- `daily_study_summaries` migration + summary aggregation 구현
- 학생 대시보드의 오늘 공부 시간, 퇴실, 카메라 토글 연결
- 강사 대시보드 read API와 기본 목록 화면 연결

### 삼일차
- `question_requests` migration + question domain 구현
- 질문 요청/취소/수락/종료 API 구현
- 질문방 화면, 자동 이동, 자동 복귀 구현
- 동시성/timeout/KST 집계 테스트 작성

## 마지막 정리
이번 4단계의 구현 착수 기준은 다음 세 줄로 요약된다.

1. 먼저 `세션 생성/종료/heartbeat/집계`를 안정화한다.
2. 그 다음 `학생/강사 대시보드`로 운영 흐름을 검증한다.
3. 마지막으로 `질문 요청 -> 수락 -> 질문방 -> 자동 복귀`를 transaction 중심으로 올린다.

---

## 카메라/영상 정책 최종 반영 메모

이 메모는 기존 문서 내 `카메라 상태 표시` 중심 설명보다 우선한다.

### 최종 구현 기준
- 학생은 `입실하기`를 누른 뒤 바로 입실되는 것이 아니라, 먼저 카메라 안내 문구를 본다.
- 학생은 카메라 권한을 허용하고 실제 영상이 켜진 상태여야만 입실이 완료된다.
- 카메라를 거부하면 입실이 막힌다.
- 강사/관리자 화면은 전체 학생의 실제 영상을 CCTV 보듯 확인할 수 있어야 한다.
- 질문방 이동 후에도 영상은 유지되어야 한다.
- 질문방에서는 마이크만 자동으로 켜지고, 전체방 복귀 시 다시 음소거된다.
- 입실 후 카메라가 꺼지면 즉시 경고를 띄운다.
- 카메라가 연속 10분 이상 꺼져 있으면 자동 퇴실 처리한다.

### 구현 우선순위 보정
| 순서 | 작업 |
|---|---|
| 1 | CODE LAB 인증 연결 |
| 2 | DB migration 적용 |
| 3 | 카메라 권한 안내 + 카메라 필수 입실 흐름 구현 |
| 4 | 세션 입실/퇴실/heartbeat/공부시간 집계 구현 |
| 5 | 강사용 전체 학생 영상 현황판 구현 |
| 6 | 질문 요청/수락/자동 이동/자동 복귀 구현 |
| 7 | 카메라 OFF 경고 및 10분 자동 퇴실 구현 |

### 비개발자 확인 포인트
1. 카메라 허용 전에는 입실이 되지 않는가
2. 카메라를 켜야만 입실 완료가 되는가
3. 강사 화면에 학생 영상이 모두 보이는가
4. 질문방 이동 후에도 영상이 이어지는가
5. 질문 종료 후 전체방으로 자동 복귀하는가
6. 카메라를 끄면 경고가 뜨는가
7. 10분 이상 카메라가 꺼져 있으면 자동 퇴실되는가
