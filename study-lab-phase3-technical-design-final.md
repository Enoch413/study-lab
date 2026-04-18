# STUDY LAB 3단계 기술 설계 확정본

## 문서 목적
이 문서는 CODE LAB 내부 기능인 STUDY LAB의 구현용 기술 설계 확정본이다.  
이번 문서의 목표는 개발자가 바로 구현에 들어갈 수 있도록 DB, API, 상태 전이, 화면, 예외 처리, QA 기준을 한 번에 고정하는 것이다.

## 적용 범위
- 서비스명은 `STUDY LAB`이다.
- STUDY LAB은 CODE LAB 내부 기능이며 독립 서비스가 아니다.
- CODE LAB의 기존 로그인, 로그아웃, 세션, 사용자 계정을 그대로 사용한다.
- STUDY LAB 전용 로그인, 로그아웃, 회원가입, 별도 계정 저장소는 만들지 않는다.
- 대상 사용자는 학원 내부 사용자뿐이다.
- 웹앱 기준이며 PC 브라우저와 모바일 브라우저를 모두 지원한다.

## 핵심 구조 요약
- 학생은 방 목록을 보지 않는다.
- 학생은 학생 대시보드에서 바로 `입실하기`를 누른다.
- 기본 운영은 전체 공부방 1개다.
- 질문이 있을 때만 학생과 강사가 1:1 질문방으로 이동한다.
- 질문 종료 후 학생은 자동으로 전체 공부방으로 복귀한다.
- 데이터 구조에는 `room_id`를 유지한다.
- 기술적으로 필요할 경우 내부적으로 여러 `room_id`로 분할할 수 있다.
- 학생과 강사의 경험은 항상 하나의 STUDY LAB처럼 유지한다.

---

## 산출물 1. 확정 의사결정표

| 항목 | 최종 채택안 | 이유 | 대안 | MVP 영향 |
|---|---|---|---|---|
| 권한 매핑 | `role=student -> 학생`, `role=admin and adminScope=assigned -> 강사`, `role=admin and adminScope=all -> 관리자` | CODE LAB 기존 권한 체계를 그대로 재사용할 수 있고 신규 역할 테이블이 필요 없다 | STUDY LAB 전용 `teacher` 역할 추가 | 인증 연동 구현 범위를 줄이고 권한 검사 로직을 단순화한다 |
| 질문방 구현 방식 | `고정된 소수의 질문방 재사용` 방식을 채택한다. `study_rooms`에 `room_type=QUESTION`인 room을 미리 생성해 재사용한다 | DB 구조와 권한 처리, room 정책, QA가 가장 단순하다. 질문방 입장 시 실제 room_id가 명확하다 | 가상 room session을 질문마다 동적으로 생성 | 질문방 부족 시 `QUESTION_ROOM_UNAVAILABLE` 예외가 필요하지만 구조는 단순하다 |
| 질문방 개수 | 배포 시 `QUESTION_ROOM_POOL_SIZE`로 고정 생성한다. MVP 기본값은 `4`다 | 운영 인원 규모에서 충분하고 구현이 단순하다 | teacher 수에 맞춰 동적 생성 | seed data와 운영 설정이 단순해진다 |
| 질문 취소 가능 시점 | 학생은 `PENDING` 상태일 때만 취소 가능하다 | 강사가 수락한 뒤에는 이동과 마이크 정책이 시작되므로 취소 허용 시 상태 충돌이 커진다 | `ACCEPTED` 상태에서도 취소 허용 | 서버 상태 전이가 단순해지고 동시성 충돌이 줄어든다 |
| heartbeat 3분 정책 | heartbeat 60초 주기, 최근 heartbeat 3분 이내면 연결 유지, 3분 초과면 `DISCONNECTED` 자동 종료 | 요구사항과 일치하고 구현과 운영 판단이 단순하다 | 2분 또는 5분 | 세션 종료 기준과 QA 기준이 명확해진다 |
| 강사 대시보드 30초 자동 갱신 | 강사 대시보드는 30초 주기로 전체 목록을 자동 갱신한다 | 요구사항과 일치한다 | 10초, 15초, 수동 새로고침 | 서버 부하를 제어하면서도 최소 자동 갱신을 제공한다 |
| 학생 화면 상태 동기화 | 학생 대시보드는 `5초 poll + 60초 heartbeat` 조합을 사용한다 | 질문 수락 후 자동 이동을 60초 heartbeat만으로 처리하면 너무 느리다 | SSE, WebSocket | 실시간 시스템을 추가하지 않고도 질문 수락을 빠르게 반영할 수 있다 |
| 일별 공부시간 계산 방식 | `daily_study_summaries.accumulated_seconds + ACTIVE session live delta` 방식으로 계산한다 | 강사 대시보드가 100명 기준 30초마다 열리므로 조회 성능과 정확도를 함께 확보할 수 있다 | 요청 시마다 세션 전체 재합산 | 성능과 구현 안정성의 균형을 맞춘다 |
| 집계 캐시 필요 여부 | `필요하다`. `daily_study_summaries`를 유지한다 | 학생 100명 목록을 반복 조회할 때 세션 전체 스캔을 피해야 한다 | 캐시 없이 세션 테이블만 사용 | 초기 구현은 조금 늘지만 대시보드 성능과 QA가 쉬워진다 |
| room fallback 노출 방식 | 내부 fallback room은 학생에게 절대 노출하지 않는다. 강사 대시보드에서도 기본적으로 `전체 공부방`으로만 보인다. 실제 room_id는 내부 API와 로그에서만 확인한다 | 사용자 경험을 하나의 STUDY LAB로 유지해야 한다 | 강사 화면에 실제 fallback room 코드 노출 | UI 복잡도가 줄고 운영 혼란이 줄어든다 |
| 카메라 상태 저장 방식 | `study_sessions.camera_status`에 현재값을 저장하고 변경 이벤트는 `audit_logs`에 남긴다 | 현재값 조회와 감사 추적을 동시에 충족하면서 별도 history 테이블이 필요 없다 | 별도 `camera_status_logs` 테이블 생성 | 구현이 단순하고 teacher dashboard 조회가 빠르다 |
| 마이크 상태 저장 방식 | 학생의 현재 마이크 정책은 `study_sessions.mic_policy`에 저장한다. 자동 정책 변경 이벤트는 `audit_logs`에 남긴다. 강사의 마이크 현재값은 DB에 상시 저장하지 않고 질문방 입장 이벤트로만 남긴다 | 전체 공부방에서는 학생만 강제 정책이 필요하고, teacher mic는 질문방 진입 시 기본 ON이면 충분하다 | 별도 `mic_state_logs` 테이블 생성 | DB가 단순해지고 마이크 정책 구현 포인트가 명확해진다 |
| question_request 상태 구조 | `PENDING`, `ACCEPTED`, `COMPLETED`, `CANCELED`, `FAILED`를 사용한다 | 필수 흐름만 표현하면서 API 목록과 정확히 맞는다 | `IN_PROGRESS`, `TIMED_OUT` 등 세분화 | 상태와 API가 단순해지고 구현 분기가 줄어든다 |
| study_session 상태 구조 | `ACTIVE`, `EXITED`, `DISCONNECTED`를 사용한다 | 세션 종료 이유는 `end_reason`으로 분리하는 편이 단순하다 | 질문방 여부까지 session status에 포함 | 공부 세션과 질문 흐름을 분리해 관리할 수 있다 |
| connection_status 구조 | `MAIN_ROOM`, `QUESTION_PENDING`, `QUESTION_ROOM`, `EXITED`, `DISCONNECTED`를 사용한다 | 학생 현재 위치와 UI 반응을 직접 표현할 수 있다 | room_id만으로 현재 위치 판단 | 화면 상태와 서버 상태를 맞추기 쉽다 |
| 질문방 시간 집계 | 질문방 시간도 오늘 공부 시간에 포함한다 | 질문 중에도 STUDY LAB 안에서 학습 세션이 유지되기 때문이다 | 질문방 시간 분리 집계 | 학생/강사 화면 계산이 단순해진다 |
| 자동 마이크 활성화 실패 처리 | 질문방 입장 시 mic auto-on이 실패하면 권한 안내 모달과 수동 재시도 버튼을 보여준다. 질문 자체는 유지한다 | 브라우저 권한 정책 때문에 완전 자동 보장이 어렵다 | 실패 시 질문방 입장을 취소 | 사용자 경험을 지키면서 실패 복구가 가능하다 |

---

## 산출물 2. DB 스키마 초안

## 공통 원칙
- 모든 timestamp는 UTC 기준 `timestamptz`로 저장한다.
- 날짜 집계 기준은 애플리케이션 로직과 SQL 계산 모두 `Asia/Seoul`을 사용한다.
- CODE LAB의 `users` 테이블은 재사용 대상으로만 참조한다.
- STUDY LAB 전용 테이블은 모두 soft-delete 없이 상태값으로 관리한다.
- ACTIVE 세션 1개 제한은 `partial unique index + transaction lock`으로 보장한다.

### 테이블명
`study_rooms`

| 항목 | 내용 |
|---|---|
| 목적 | 전체 공부방, 질문방 풀, 내부 fallback main room을 관리한다 |
| 주요 컬럼 | `id uuid`, `room_code varchar(50)`, `room_name varchar(100)`, `room_type enum`, `logical_space_key varchar(50)`, `is_active boolean`, `max_capacity integer`, `sort_order integer`, `created_at timestamptz`, `updated_at timestamptz` |
| PK/FK | PK=`id` |
| 상태값 enum | `room_type = MAIN, QUESTION, FALLBACK_MAIN` |
| 인덱스 | `uq_study_rooms_room_code(room_code unique)`, `idx_study_rooms_type_active(room_type, is_active)`, `idx_study_rooms_logical_space(logical_space_key, is_active)` |
| 제약 조건 | `max_capacity > 0`, `room_code` unique, `room_type=MAIN`인 active room은 logical_space_key=`MAIN_STUDY` 기준 최소 1개 보장 |
| 비고 | seed data로 `MAIN_001` 1개와 `QUESTION_ROOM_01..04`를 생성한다. fallback main room은 초기 비활성 상태로 생성 가능하다 |

### 테이블명
`study_sessions`

| 항목 | 내용 |
|---|---|
| 목적 | 학생의 전체 공부 세션을 저장한다. 질문방 이동은 같은 study session 안에서 connection_status로 관리한다 |
| 주요 컬럼 | `id uuid`, `user_id uuid`, `base_room_id uuid`, `current_room_id uuid`, `status enum`, `connection_status enum`, `camera_status enum`, `mic_policy enum`, `started_at timestamptz`, `ended_at timestamptz null`, `last_heartbeat_at timestamptz`, `end_reason enum null`, `client_instance_id varchar(100) null`, `created_at timestamptz`, `updated_at timestamptz` |
| PK/FK | PK=`id`, FK=`user_id -> users.id`, FK=`base_room_id -> study_rooms.id`, FK=`current_room_id -> study_rooms.id` |
| 상태값 enum | `status = ACTIVE, EXITED, DISCONNECTED` / `connection_status = MAIN_ROOM, QUESTION_PENDING, QUESTION_ROOM, EXITED, DISCONNECTED` / `camera_status = ON, OFF` / `mic_policy = MUTED_LOCKED, OPEN` / `end_reason = USER_EXIT, HEARTBEAT_TIMEOUT, SYSTEM_TIMEOUT, UNKNOWN_ERROR` |
| 인덱스 | `uq_active_session_per_user(user_id) where status='ACTIVE'`, `idx_study_sessions_dashboard(status, connection_status, current_room_id, last_heartbeat_at)`, `idx_study_sessions_user_started(user_id, started_at desc)`, `idx_study_sessions_room_active(current_room_id, status, last_heartbeat_at)` |
| 제약 조건 | `ended_at is null` when `status='ACTIVE'`, `ended_at is not null` when `status in ('EXITED','DISCONNECTED')`, `last_heartbeat_at >= started_at`, `base_room_id` room_type must be `MAIN` or `FALLBACK_MAIN` |
| 비고 | ACTIVE 세션 1개 제한은 partial unique index로 보장하고, `enter` API에서는 `SELECT ... FOR UPDATE`로 같은 user_id 세션을 잠근다 |

### 테이블명
`question_requests`

| 항목 | 내용 |
|---|---|
| 목적 | 학생 질문 요청, 강사 수락, 질문방 배정, 질문 종료 이력을 관리한다 |
| 주요 컬럼 | `id uuid`, `study_session_id uuid`, `student_user_id uuid`, `teacher_user_id uuid null`, `question_room_id uuid null`, `status enum`, `request_note varchar(200) null`, `requested_at timestamptz`, `accepted_at timestamptz null`, `ended_at timestamptz null`, `complete_reason enum null`, `auto_returned_at timestamptz null`, `created_at timestamptz`, `updated_at timestamptz` |
| PK/FK | PK=`id`, FK=`study_session_id -> study_sessions.id`, FK=`student_user_id -> users.id`, FK=`teacher_user_id -> users.id`, FK=`question_room_id -> study_rooms.id` |
| 상태값 enum | `status = PENDING, ACCEPTED, COMPLETED, CANCELED, FAILED` / `complete_reason = STUDENT_CANCEL, TEACHER_COMPLETE, SYSTEM_TIMEOUT, STUDENT_EXIT, STUDENT_DISCONNECTED, ACCEPT_FAILED, AUTO_RECOVERY_FAILED` |
| 인덱스 | `idx_question_requests_pending(status, requested_at)`, `idx_question_requests_student_open(student_user_id, status)`, `idx_question_requests_teacher_status(teacher_user_id, status, updated_at desc)`, `uq_open_question_per_student(student_user_id) where status in ('PENDING','ACCEPTED')`, `uq_active_question_room(question_room_id) where status='ACCEPTED'` |
| 제약 조건 | `question_room_id` room_type must be `QUESTION` when not null, `teacher_user_id` required when `status='ACCEPTED'`, `accepted_at` required when `status='ACCEPTED'`, `ended_at` required when `status in ('COMPLETED','CANCELED','FAILED')` |
| 비고 | 질문방은 `study_rooms.room_type=QUESTION` 풀에서 할당한다. 상태는 `ACCEPTED`가 곧 질문방 진행 상태를 의미한다 |

### 테이블명
`daily_study_summaries`

| 항목 | 내용 |
|---|---|
| 목적 | 강사 대시보드와 학생 대시보드 성능을 위해 일별 누적 공부 시간을 캐시한다 |
| 주요 컬럼 | `id uuid`, `user_id uuid`, `summary_date_kst date`, `accumulated_seconds integer`, `last_reconciled_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz` |
| PK/FK | PK=`id`, FK=`user_id -> users.id` |
| 상태값 enum | 없음 |
| 인덱스 | `uq_daily_summary_user_date(user_id, summary_date_kst unique)`, `idx_daily_summary_date(summary_date_kst)`, `idx_daily_summary_user(user_id, summary_date_kst desc)` |
| 제약 조건 | `accumulated_seconds >= 0` |
| 비고 | CLOSED 구간만 캐시한다. ACTIVE 세션의 실시간 delta는 API 응답 시 계산해서 더한다 |

### 테이블명
`audit_logs`

| 항목 | 내용 |
|---|---|
| 목적 | 세션, 질문 요청, 카메라 상태, 마이크 정책, 자동 복귀, 오류 복구 이력을 감사 가능하게 저장한다 |
| 주요 컬럼 | `id uuid`, `entity_type enum`, `entity_id uuid`, `actor_user_id uuid null`, `action_type enum`, `payload_json jsonb`, `created_at timestamptz` |
| PK/FK | PK=`id`, FK=`actor_user_id -> users.id` |
| 상태값 enum | `entity_type = STUDY_SESSION, QUESTION_REQUEST, ROOM, SYSTEM` / `action_type = SESSION_ENTER, SESSION_EXIT, SESSION_DISCONNECTED, HEARTBEAT_RECEIVED, QUESTION_CREATED, QUESTION_CANCELED, QUESTION_ACCEPTED, QUESTION_COMPLETED, AUTO_RETURN_APPLIED, CAMERA_CHANGED, MIC_POLICY_APPLIED, ERROR_RECOVERED, ERROR_UNRECOVERED` |
| 인덱스 | `idx_audit_entity(entity_type, entity_id, created_at desc)`, `idx_audit_actor(actor_user_id, created_at desc)`, `idx_audit_action(action_type, created_at desc)` |
| 제약 조건 | 없음 |
| 비고 | 별도 상태 로그 테이블 대신 범용 audit_logs 하나로 관리한다 |

## ACTIVE 세션 1개 제한 보장 방식

| 항목 | 최종안 |
|---|---|
| DB 보장 | `study_sessions(user_id) where status='ACTIVE'` partial unique index |
| API 보장 | `POST /sessions/enter` 시작 시 user 기준 ACTIVE 세션 row lock 확인 |
| 중복 클릭 처리 | 기존 ACTIVE 세션이 있으면 새로 만들지 않고 기존 세션을 반환 |
| 다른 기기 재로그인 | 새로운 `enter` 호출은 기존 ACTIVE 세션을 재사용하도록 하고, 기존 세션 정보만 반환한다 |

## room_type 구조

| room_type | 의미 | 학생 노출 | 강사 노출 | 비고 |
|---|---|---|---|---|
| MAIN | 기본 전체 공부방 | 노출하지 않음. UI에서는 항상 `전체 공부방`으로 표현 | 기본적으로 `전체 공부방`으로 표현 | seed 1개 |
| QUESTION | 1:1 질문방 | 학생이 직접 선택하지 않음 | 필요 시 질문방 진행 상태로만 노출 | seed pool 생성 |
| FALLBACK_MAIN | 내부 분산용 전체 공부방 | 절대 노출하지 않음 | 기본 UI에서는 숨김 | 기술 fallback용 |

## question_request 상태 구조

| 상태 | 의미 |
|---|---|
| PENDING | 학생이 질문 요청을 생성했고 아직 강사가 수락하지 않음 |
| ACCEPTED | 강사가 수락했고 질문방이 배정됨. 학생과 강사는 질문방으로 이동해야 함 |
| COMPLETED | 질문이 정상 종료되었고 학생 자동 복귀까지 완료됨 |
| CANCELED | 학생이 수락 전 취소했거나 시스템이 대기 상태 질문을 취소함 |
| FAILED | 수락 이후 질문방 연결 실패 또는 자동 복귀 실패 등 비정상 종료 |

## ended_at / end_reason / disconnected 처리 방식

| 항목 | 최종안 |
|---|---|
| 정상 퇴실 | `status=EXITED`, `ended_at=server_now`, `end_reason=USER_EXIT` |
| heartbeat timeout | `status=DISCONNECTED`, `ended_at=last_heartbeat_at`, `end_reason=HEARTBEAT_TIMEOUT` |
| 시스템 타임아웃 종료 | `status=EXITED`, `ended_at=server_now`, `end_reason=SYSTEM_TIMEOUT` |
| 질문방에서 학생 퇴실 | 먼저 open question_request를 `FAILED` 또는 `COMPLETED`로 종료한 뒤 study_session 종료 |

## 현재 상태 조회 성능을 위한 인덱스 전략

| 조회 목적 | 사용 테이블 | 사용 인덱스 |
|---|---|---|
| 강사 대시보드 현재 학생 목록 | `study_sessions`, `daily_study_summaries`, `question_requests` | `idx_study_sessions_dashboard`, `uq_daily_summary_user_date`, `idx_question_requests_student_open` |
| 질문 대기 큐 | `question_requests` | `idx_question_requests_pending` |
| 학생 대시보드 최근 세션 | `study_sessions` | `idx_study_sessions_user_started` |
| room 사용량 점검 | `study_sessions`, `study_rooms` | `idx_study_sessions_room_active`, `idx_study_rooms_type_active` |

## Asia/Seoul 기준 날짜 처리 전략

| 항목 | 최종안 |
|---|---|
| 저장 시각 | 모두 UTC `timestamptz` |
| 집계 기준일 | `summary_date_kst`는 `Asia/Seoul` 기준 date |
| 계산 방식 | 세션 구간 `[start, end]`를 KST 자정 경계로 분할해서 날짜별로 누적 |
| ACTIVE 세션 | API 조회 시 `max(started_at, today_kst_start)`부터 `server_now`까지 live delta 계산 |
| EXITED/DISCONNECTED 세션 | 종료 시점에 경계 분할 후 `daily_study_summaries.accumulated_seconds`에 반영 |

---

## 산출물 3. API 명세

## 공통 규칙
- 인증은 CODE LAB 기존 세션 쿠키 또는 인증 토큰을 사용한다.
- 모든 API는 서버에서 역할 검사를 수행한다.
- 모든 응답은 `application/json`이다.
- 예시의 timestamp는 UTC ISO8601 형식을 사용한다.

### GET `/study-lab/me`

| 항목 | 내용 |
|---|---|
| method | `GET` |
| path | `/study-lab/me` |
| 목적 | 현재 로그인 사용자의 STUDY LAB 권한 매핑과 활성 상태를 반환한다 |
| 호출 주체 | 학생, 강사, 관리자 |
| 권한 | 로그인 사용자 |
| request params/body | 없음 |
| response 예시 | `{ "user": { "id": "u_001", "name": "홍길동", "mappedRole": "student" }, "activeSession": { "id": "ss_001", "status": "ACTIVE", "connectionStatus": "MAIN_ROOM", "roomLabel": "전체 공부방", "startedAt": "2026-04-18T10:00:00Z", "todayStudySeconds": 5400, "cameraStatus": "OFF", "micPolicy": "MUTED_LOCKED" }, "activeQuestion": null }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN_ROLE_MAPPING_FAILED`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 멱등 |

### POST `/study-lab/sessions/enter`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/sessions/enter` |
| 목적 | 학생의 STUDY LAB 공부 세션을 시작한다 |
| 호출 주체 | 학생 |
| 권한 | `mappedRole=student` |
| request params/body | `{ "clientInstanceId": "web-8f2d...", "deviceLabel": "iPhone Safari" }` |
| response 예시 | `201 { "reused": false, "session": { "id": "ss_001", "status": "ACTIVE", "connectionStatus": "MAIN_ROOM", "roomId": "room_main_001", "roomLabel": "전체 공부방", "startedAt": "2026-04-18T10:00:00Z", "cameraStatus": "OFF", "micPolicy": "MUTED_LOCKED" } }` 또는 `200 { "reused": true, "session": { ...existing session... } }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `409 NO_ACTIVE_MAIN_ROOM`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 사실상 멱등. ACTIVE 세션이 있으면 기존 세션 반환 |

### POST `/study-lab/sessions/{id}/exit`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/sessions/{id}/exit` |
| 목적 | 학생의 ACTIVE 세션을 정상 종료한다 |
| 호출 주체 | 학생 |
| 권한 | 세션 소유 학생 |
| request params/body | path=`id`, body 없음 |
| response 예시 | `{ "alreadyEnded": false, "session": { "id": "ss_001", "status": "EXITED", "endedAt": "2026-04-18T12:00:00Z", "endReason": "USER_EXIT" }, "todayStudySeconds": 7200 }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`, `409 SESSION_OWNER_MISMATCH`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 멱등. 이미 종료된 세션이면 `alreadyEnded=true` 반환 |

### POST `/study-lab/sessions/{id}/heartbeat`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/sessions/{id}/heartbeat` |
| 목적 | 학생의 연결 유지 상태를 갱신한다 |
| 호출 주체 | 학생 클라이언트 |
| 권한 | 세션 소유 학생 |
| request params/body | path=`id`, body=`{ "visibilityState": "visible", "networkState": "online" }` |
| response 예시 | `{ "sessionId": "ss_001", "accepted": true, "lastHeartbeatAt": "2026-04-18T10:05:00Z", "connectionStatus": "MAIN_ROOM", "serverNow": "2026-04-18T10:05:00Z" }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`, `409 SESSION_NOT_ACTIVE`, `410 SESSION_ALREADY_ENDED` |
| 멱등성 여부 | 멱등에 가깝다. 마지막 heartbeat 시각만 갱신 |

### POST `/study-lab/sessions/{id}/camera`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/sessions/{id}/camera` |
| 목적 | 학생 카메라 상태를 수동 갱신한다 |
| 호출 주체 | 학생 |
| 권한 | 세션 소유 학생 |
| request params/body | path=`id`, body=`{ "cameraStatus": "ON" }` |
| response 예시 | `{ "sessionId": "ss_001", "cameraStatus": "ON", "updatedAt": "2026-04-18T10:06:00Z" }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`, `409 SESSION_NOT_ACTIVE`, `422 INVALID_CAMERA_STATUS` |
| 멱등성 여부 | 멱등. 같은 값 재전송 가능 |

### POST `/study-lab/questions`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/questions` |
| 목적 | 학생이 질문 요청을 생성한다 |
| 호출 주체 | 학생 |
| 권한 | `mappedRole=student` |
| request params/body | `{ "studySessionId": "ss_001", "note": "7번 문제 질문" }` |
| response 예시 | `{ "question": { "id": "q_001", "status": "PENDING", "requestedAt": "2026-04-18T10:10:00Z", "queuePosition": 2 } }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 SESSION_NOT_FOUND`, `409 QUESTION_ALREADY_EXISTS`, `409 SESSION_NOT_IN_MAIN_ROOM`, `409 SESSION_NOT_ACTIVE` |
| 멱등성 여부 | 비멱등. open question이 있으면 실패 |

### POST `/study-lab/questions/{id}/cancel`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/questions/{id}/cancel` |
| 목적 | 학생이 수락 전 질문 요청을 취소한다 |
| 호출 주체 | 학생 |
| 권한 | 질문 요청 소유 학생 |
| request params/body | path=`id`, body 없음 |
| response 예시 | `{ "question": { "id": "q_001", "status": "CANCELED", "completeReason": "STUDENT_CANCEL", "endedAt": "2026-04-18T10:11:00Z" } }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 QUESTION_NOT_FOUND`, `409 QUESTION_NOT_CANCELABLE` |
| 멱등성 여부 | 멱등. 이미 `CANCELED`면 같은 상태 반환 |

### POST `/study-lab/questions/{id}/accept`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/questions/{id}/accept` |
| 목적 | 강사가 질문 요청을 수락하고 질문방을 배정한다 |
| 호출 주체 | 강사 |
| 권한 | `mappedRole=teacher` 또는 `mappedRole=admin` |
| request params/body | path=`id`, body 없음 |
| response 예시 | `{ "question": { "id": "q_001", "status": "ACCEPTED", "teacherUserId": "u_t_01", "questionRoom": { "id": "room_q_02", "roomLabel": "질문방" }, "acceptedAt": "2026-04-18T10:12:00Z" }, "studentSession": { "id": "ss_001", "connectionStatus": "QUESTION_ROOM", "currentRoomId": "room_q_02", "micPolicy": "OPEN" } }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 QUESTION_NOT_FOUND`, `409 QUESTION_ALREADY_ACCEPTED`, `409 QUESTION_ROOM_UNAVAILABLE`, `409 STUDENT_SESSION_NOT_ACTIVE`, `409 STUDENT_NOT_IN_PENDING_STATE` |
| 멱등성 여부 | 비멱등. 수락 경쟁 시 하나만 성공 |

### POST `/study-lab/questions/{id}/complete`

| 항목 | 내용 |
|---|---|
| method | `POST` |
| path | `/study-lab/questions/{id}/complete` |
| 목적 | 강사가 질문을 종료하고 학생을 전체 공부방으로 자동 복귀시킨다 |
| 호출 주체 | 강사, 시스템 |
| 권한 | 담당 강사 또는 시스템 |
| request params/body | path=`id`, body=`{ "reason": "TEACHER_COMPLETE" }` |
| response 예시 | `{ "question": { "id": "q_001", "status": "COMPLETED", "completeReason": "TEACHER_COMPLETE", "endedAt": "2026-04-18T10:20:00Z", "autoReturnedAt": "2026-04-18T10:20:01Z" }, "studentSession": { "id": "ss_001", "connectionStatus": "MAIN_ROOM", "currentRoomId": "room_main_001", "micPolicy": "MUTED_LOCKED" } }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 QUESTION_NOT_FOUND`, `409 QUESTION_NOT_COMPLETABLE`, `500 AUTO_RETURN_FAILED` |
| 멱등성 여부 | 멱등. 이미 `COMPLETED`면 같은 상태 반환 |

### GET `/study-lab/dashboard/student`

| 항목 | 내용 |
|---|---|
| method | `GET` |
| path | `/study-lab/dashboard/student` |
| 목적 | 학생 대시보드 전체 상태를 조회한다 |
| 호출 주체 | 학생 |
| 권한 | `mappedRole=student` |
| request params/body | 없음 |
| response 예시 | `{ "session": { "id": "ss_001", "status": "ACTIVE", "connectionStatus": "QUESTION_PENDING", "roomLabel": "전체 공부방", "startedAt": "2026-04-18T10:00:00Z", "cameraStatus": "OFF", "micPolicy": "MUTED_LOCKED" }, "todayStudySeconds": 3600, "question": { "id": "q_001", "status": "PENDING", "requestedAt": "2026-04-18T10:10:00Z" }, "recentSessions": [ { "id": "ss_prev", "startedAt": "...", "endedAt": "...", "status": "EXITED" } ] }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 멱등 |

### GET `/study-lab/dashboard/teacher`

| 항목 | 내용 |
|---|---|
| method | `GET` |
| path | `/study-lab/dashboard/teacher` |
| 목적 | 강사/관리자 현황 대시보드 데이터를 조회한다 |
| 호출 주체 | 강사, 관리자 |
| 권한 | `mappedRole=teacher` 또는 `mappedRole=admin` |
| request params/body | query=`search`, `onlyActive=true|false`, `page=1`, `pageSize=100` |
| response 예시 | `{ "items": [ { "studentUserId": "u_s_01", "studentName": "김학생", "currentStatus": "MAIN_ROOM", "startedAt": "2026-04-18T10:00:00Z", "todayStudySeconds": 4200, "cameraStatus": "ON", "questionStatus": "NONE", "roomLabel": "전체 공부방" }, { "studentUserId": "u_s_02", "studentName": "박학생", "currentStatus": "QUESTION_ROOM", "startedAt": "2026-04-18T09:30:00Z", "todayStudySeconds": 5400, "cameraStatus": "OFF", "questionStatus": "ACCEPTED", "roomLabel": "질문방" } ], "pagination": { "page": 1, "pageSize": 100, "total": 82 }, "serverNow": "2026-04-18T10:30:00Z" }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 멱등 |

### GET `/study-lab/questions/pending`

| 항목 | 내용 |
|---|---|
| method | `GET` |
| path | `/study-lab/questions/pending` |
| 목적 | 질문 대기열을 요청 시각 오름차순으로 조회한다 |
| 호출 주체 | 강사, 관리자 |
| 권한 | `mappedRole=teacher` 또는 `mappedRole=admin` |
| request params/body | query=`limit=50` |
| response 예시 | `{ "items": [ { "id": "q_001", "studentUserId": "u_s_01", "studentName": "김학생", "requestedAt": "2026-04-18T10:10:00Z", "queuePosition": 1 }, { "id": "q_002", "studentUserId": "u_s_02", "studentName": "이학생", "requestedAt": "2026-04-18T10:12:00Z", "queuePosition": 2 } ] }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 멱등 |

### GET `/study-lab/rooms/internal`

| 항목 | 내용 |
|---|---|
| method | `GET` |
| path | `/study-lab/rooms/internal` |
| 목적 | 내부 room 구성과 사용량을 확인한다 |
| 호출 주체 | 관리자, 내부 운영 도구 |
| 권한 | `mappedRole=admin` |
| request params/body | 없음 |
| response 예시 | `{ "rooms": [ { "id": "room_main_001", "roomType": "MAIN", "logicalSpaceKey": "MAIN_STUDY", "activeSessionCount": 73, "isActive": true }, { "id": "room_q_01", "roomType": "QUESTION", "activeQuestionRequestId": "q_001", "isActive": true }, { "id": "room_fb_01", "roomType": "FALLBACK_MAIN", "activeSessionCount": 0, "isActive": false } ] }` |
| 오류 케이스 | `401 UNAUTHORIZED`, `403 FORBIDDEN`, `500 INTERNAL_ERROR` |
| 멱등성 여부 | 멱등 |

---

## 산출물 4. 상태 전이도

## 1) `study_session.status` 상태 전이

| 상태 | 진입 조건 | 이탈 조건 | 허용 이벤트 | 금지 이벤트 | 서버 처리 | UI 반응 |
|---|---|---|---|---|---|---|
| ACTIVE | 학생이 `enter` 성공 | 정상 퇴실 또는 heartbeat timeout | `exit`, `heartbeat`, `camera update`, `question create`, `question accept`, `question complete` | 중복 `enter`로 새 세션 생성 | 세션 row 생성, `current_room_id=base_room_id`, `mic_policy=MUTED_LOCKED` | 학생 대시보드에 `입실 중` 표시 |
| EXITED | 학생이 `exit` 성공 또는 시스템 정상 종료 | 없음 | 조회 | `heartbeat`, `question create`, `camera update`, `accept` | `ended_at`, `end_reason` 저장, summary 반영 | 학생 대시보드에 `퇴실됨` 표시 |
| DISCONNECTED | heartbeat 3분 초과 | 없음 | 조회 | `heartbeat`, `question create`, `camera update`, `accept` | `ended_at=last_heartbeat_at`, `end_reason=HEARTBEAT_TIMEOUT`, summary 반영 | 학생 대시보드에 `연결 끊김 종료` 표시 |

## 2) `question_request.status` 상태 전이

| 상태 | 진입 조건 | 이탈 조건 | 허용 이벤트 | 금지 이벤트 | 서버 처리 | UI 반응 |
|---|---|---|---|---|---|---|
| PENDING | 학생이 `POST /questions` 성공 | 강사 수락 또는 학생 취소 또는 시스템 실패 | `cancel`, `accept` | `complete`, 중복 `create` | 요청 시각 저장, queue order는 `requested_at` 순서로 계산 | 학생은 `질문 요청 대기`, 강사는 대기열에 표시 |
| ACCEPTED | 강사가 `accept` 성공, 질문방 배정 완료 | 강사 완료 또는 시스템 실패 | `complete` | `cancel`, 재accept | 질문방 할당, student session `QUESTION_ROOM`, mic policy `OPEN` 적용 | 학생과 강사가 질문방 화면으로 이동 |
| COMPLETED | 강사 또는 시스템이 `complete` 성공 | 없음 | 조회 | `accept`, `cancel`, 재complete로 상태 변경 | `ended_at`, `complete_reason`, `auto_returned_at` 저장 | 학생 자동 복귀, 강사 대시보드에서 질문 종료 상태 반영 |
| CANCELED | 학생이 수락 전 취소 | 없음 | 조회 | `accept`, `complete` | `ended_at`, `complete_reason=STUDENT_CANCEL` 저장 | 학생 대기 상태 제거 |
| FAILED | 수락 후 연결 실패, 자동 복귀 실패, 학생/강사 연결 끊김 | 없음 | 조회 | `cancel`, `accept`, `complete` | `ended_at`, 실패 사유 기록, 필요 시 복구 작업 로그 저장 | 학생 또는 강사에게 오류 안내 표시 |

## 3) `study_session.connection_status` 상태 전이

| 상태 | 진입 조건 | 이탈 조건 | 허용 이벤트 | 금지 이벤트 | 서버 처리 | UI 반응 |
|---|---|---|---|---|---|---|
| MAIN_ROOM | 세션 시작 성공 또는 질문 종료 후 자동 복귀 완료 | 질문 요청 생성, 세션 종료, 연결 끊김 | `question create`, `heartbeat`, `exit`, `camera update` | 학생 mic on 요청 | `current_room_id=base_room_id`, `mic_policy=MUTED_LOCKED` | 학생은 전체 공부방 UI, 마이크 비활성 표시 |
| QUESTION_PENDING | 학생이 질문 요청 생성 | 강사 수락, 학생 취소, 세션 종료, 연결 끊김 | `cancel`, `heartbeat`, `exit` | 중복 질문 요청 | open question 존재 확인 | 학생은 `질문 요청 대기` 배지 표시 |
| QUESTION_ROOM | 강사가 질문 수락하고 질문방 배정 | 질문 완료, 세션 종료, 연결 끊김 | `complete`, `heartbeat`, `exit`, `camera update` | 새 질문 요청 생성 | `current_room_id=question_room_id`, `mic_policy=OPEN` | 학생과 강사는 질문방 화면, 마이크 on 기본값 |
| EXITED | 세션 정상 종료 | 없음 | 조회 | `heartbeat`, `question create` | 세션 종료 확정 | 학생은 퇴실 상태 |
| DISCONNECTED | heartbeat timeout | 없음 | 조회 | `heartbeat`, `question create` | 세션 자동 종료 확정 | 학생은 재입실 필요 안내 |

---

## 산출물 5. 화면 명세

## 학생 대시보드

| 항목 | 내용 |
|---|---|
| 목적 | 학생이 현재 자습 상태, 오늘 공부 시간, 질문 상태를 확인하고 입실/퇴실/질문 요청을 수행한다 |
| 진입 조건 | CODE LAB 로그인 완료, STUDY LAB 카드 진입 |
| 주요 컴포넌트 | 상태 요약 카드, 오늘 공부 시간 카드, `입실하기`, `퇴실하기`, `질문 요청`, 카메라 토글, 세션 기록 목록, 질문 상태 배지 |
| 빈 상태 | 세션 이력이 없으면 `오늘 아직 입실 기록이 없습니다` 표시 |
| 로딩 상태 | skeleton 카드 3개, 버튼 disabled, 세션 기록 placeholder 3줄 |
| 오류 상태 | `STUDY LAB 정보를 불러오지 못했습니다. 다시 시도해 주세요.`와 재시도 버튼 |
| 버튼 액션 | `입실하기` -> `POST /sessions/enter`, `퇴실하기` -> `POST /sessions/{id}/exit`, `질문 요청` -> `POST /questions`, 카메라 토글 -> `POST /sessions/{id}/camera` |
| 상태 변화 시 UI 반응 | MAIN_ROOM이면 `마이크는 전체 공부방에서 자동 음소거됩니다` 표시, QUESTION_PENDING이면 `질문 요청 대기 중`, QUESTION_ROOM이면 자동으로 1:1 질문방 화면으로 이동, COMPLETED 후에는 `질문이 종료되어 전체 공부방으로 복귀했습니다` 토스트 |
| 모바일에서 줄여도 되는 요소 | 세션 기록 목록의 종료 사유, 마지막 갱신 시각, 보조 설명 문구 |
| 접근 권한 | 학생만 가능 |
| 추가 구현 규칙 | active session이 없으면 5초 poll 중지, active session이 있으면 5초 poll 유지, heartbeat는 별도 60초 주기 |

## 강사 대시보드

| 항목 | 내용 |
|---|---|
| 목적 | 강사가 전체 학생 현황과 질문 대기열을 확인하고 질문을 수락/종료한다 |
| 진입 조건 | CODE LAB 로그인 완료, mappedRole이 teacher 또는 admin |
| 주요 컴포넌트 | 학생 현황 테이블 또는 카드 리스트, 검색 입력, `입실 중만 보기` 토글, 질문 대기 영역, 질문 수락 버튼, 자동 갱신 표시 |
| 빈 상태 | 학생 목록이 없으면 `현재 표시할 학생이 없습니다`, 질문 대기가 없으면 `대기 중인 질문이 없습니다` |
| 로딩 상태 | 현황 카드 skeleton 8개, 질문 대기 skeleton 3개 |
| 오류 상태 | `현황판을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`와 수동 새로고침 버튼 |
| 버튼 액션 | 질문 수락 -> `POST /questions/{id}/accept`, 질문 종료 -> `POST /questions/{id}/complete`, 검색 -> `GET /dashboard/teacher?search=...`, 필터 -> `GET /dashboard/teacher?onlyActive=true` |
| 상태 변화 시 UI 반응 | 질문 요청이 생기면 대기열 최상단에 추가, 수락 성공 시 학생 row 상태가 `질문방`으로 변경, 완료 성공 시 학생 row 상태가 `전체 공부방`으로 복귀 |
| 모바일에서 줄여도 되는 요소 | roomLabel, 마지막 갱신 시각, 세부 보조 텍스트 |
| 접근 권한 | 강사, 관리자 |
| 추가 구현 규칙 | 전체 목록은 30초 주기로 poll, 검색 중에는 마지막 검색 조건 유지, accept 버튼 클릭 시 즉시 disabled |

## 1:1 질문방 화면

| 항목 | 내용 |
|---|---|
| 목적 | 질문 학생과 강사가 1:1로 연결되어 질문을 진행하고 종료한다 |
| 진입 조건 | question_request.status=`ACCEPTED`이고 현재 사용자에게 room 접근 권한이 있음 |
| 주요 컴포넌트 | 질문 상태 헤더, 상대방 이름, 현재 마이크 상태 배지, 권한 안내 문구, `질문 종료` 버튼, 마이크 재시도 버튼 |
| 빈 상태 | 없음. room 배정이 없으면 질문방에 진입시키지 않는다 |
| 로딩 상태 | `질문방에 연결 중입니다` 로딩 오버레이, 마이크 권한 준비 안내 |
| 오류 상태 | `질문방 연결에 실패했습니다. 다시 시도해 주세요.`와 `권한 다시 확인`, `대시보드로 돌아가기` 버튼 |
| 버튼 액션 | 강사의 `질문 종료` -> `POST /questions/{id}/complete`, `마이크 다시 켜기`는 브라우저 오디오 권한 재시도 UX만 수행 |
| 상태 변화 시 UI 반응 | 진입 직후 mic auto-on 시도, 실패 시 권한 안내 모달 노출, complete 성공 시 학생은 자동으로 학생 대시보드로, 강사는 강사 대시보드로 복귀 |
| 모바일에서 줄여도 되는 요소 | room id, 개발용 디버그 텍스트, 세부 상태 로그 |
| 접근 권한 | 해당 질문의 학생, 해당 질문을 수락한 강사만 가능 |
| 추가 구현 규칙 | 학생은 직접 이 화면 URL을 열 수 없고 서버 상태가 `ACCEPTED`일 때만 진입 가능 |

---

## 산출물 6. 예외 처리 정책

| 예외 | 감지 조건 | 서버 처리 | 사용자 메시지 | 로그 기록 여부 | QA 확인 포인트 |
|---|---|---|---|---|---|
| 중복 입실 | ACTIVE 세션이 있는 상태에서 `enter` 호출 | 새 세션 생성 금지, 기존 ACTIVE 세션 반환 | `이미 입실 중입니다. 기존 세션으로 복귀합니다.` | 예, `SESSION_ENTER_REUSED` | 중복 클릭과 재로그인에서 세션이 늘어나지 않는지 확인 |
| 질문 중 퇴실 | QUESTION_ROOM 상태에서 `exit` 호출 | open question을 `FAILED` 또는 `COMPLETED` 종료 후 study_session 종료 | `질문을 종료하고 퇴실했습니다.` | 예 | 질문 기록과 세션 종료 순서가 보존되는지 확인 |
| heartbeat 누락 | `server_now - last_heartbeat_at > 3m` | study_session을 `DISCONNECTED` 종료, ended_at=last_heartbeat_at | `연결이 끊겨 세션이 종료되었습니다. 다시 입실해 주세요.` | 예 | 3분 기준이 정확히 적용되는지 확인 |
| 브라우저 새로고침 | active session 존재 + 동일 clientInstanceId로 재조회 | 세션 유지, 학생 대시보드 복구 | `세션을 복구했습니다.` | 선택적 | 새로고침 후 active session이 살아 있는지 확인 |
| 모바일 백그라운드 전환 | visibility change 후 heartbeat 지연 | 3분 이내면 유지, 3분 초과 시 DISCONNECTED | `백그라운드 전환으로 연결이 끊겼습니다.` | 예 | 1분, 2분, 4분 백그라운드 전환 케이스 확인 |
| 다른 기기에서 재로그인 | 동일 user가 다른 device에서 `enter` 호출 | 기존 ACTIVE 세션 재사용 반환 | `기존 입실 세션을 이어서 사용합니다.` | 예 | 두 기기에서 ACTIVE 세션 2개가 생기지 않는지 확인 |
| 질문 수락 경쟁 | 두 강사가 같은 question accept 요청 | 첫 요청만 성공, 나머지는 `409 QUESTION_ALREADY_ACCEPTED` | `이미 다른 강사가 수락한 질문입니다.` | 예 | 동시 클릭에서 room 중복 할당이 없는지 확인 |
| 질문방 자동 입장 실패 | accept 후 학생 또는 강사가 question room 접속 실패 | question 상태 유지, 1회 자동 재시도 후 계속 실패하면 `FAILED` 종료 | `질문방 연결에 실패했습니다. 권한을 확인하고 다시 시도해 주세요.` | 예 | mic 권한 거부, 네트워크 지연에서 실패 처리가 되는지 확인 |
| 자동 복귀 실패 | complete 후 student session의 current_room_id 복귀 업데이트 실패 | question을 `FAILED`로 전환하고 복구 작업 큐에 기록 | `질문 종료 후 복귀 처리에 실패했습니다. 대시보드로 돌아가 다시 확인해 주세요.` | 예 | room 복귀 실패 시 상태가 꼬이지 않는지 확인 |
| 강사 연결 끊김 | question ACCEPTED 상태에서 강사 브라우저 종료 또는 네트워크 단절 | question 상태를 `FAILED`로 종료, 학생 session을 MAIN_ROOM으로 복귀 시도 | `강사 연결이 종료되어 질문이 끝났습니다.` | 예 | teacher disconnect 후 student가 고립되지 않는지 확인 |
| 학생 연결 끊김 | question ACCEPTED 상태에서 학생 브라우저 종료 또는 heartbeat timeout | question 상태 `FAILED`, study_session은 timeout 정책에 따라 종료 또는 복귀 | `학생 연결이 끊겨 질문이 종료되었습니다.` | 예 | question과 session 종료 관계가 일관적인지 확인 |
| 서버 오류 | 500 또는 DB transaction 실패 | 상태 변경 rollback, 사용자에게 generic error 반환 | `처리를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.` | 예 | transaction rollback으로 중간 상태가 남지 않는지 확인 |
| 권한 불일치 | 학생이 teacher API 호출 또는 teacher가 student session 소유 API 호출 | `403 FORBIDDEN` 반환 | `이 작업을 수행할 권한이 없습니다.` | 예 | 프론트 숨김 없이 직접 API 호출 시에도 차단되는지 확인 |

---

## 산출물 7. QA 시나리오

| 번호 | 사전조건 | 테스트 단계 | 기대 결과 | 중요도 |
|---|---|---|---|---|
| QA-01 | 학생 계정 로그인 완료 | STUDY LAB 진입 후 `입실하기` 클릭 | ACTIVE 세션 생성, MAIN_ROOM 상태, mic_policy=`MUTED_LOCKED` | 높음 |
| QA-02 | ACTIVE 세션 없음 | 학생 대시보드 조회 | `입실하기` 버튼 보임, `퇴실하기` 숨김 | 높음 |
| QA-03 | ACTIVE 세션 존재 | 학생 대시보드 조회 | `퇴실하기` 버튼 보임, 오늘 공부 시간 표시 | 높음 |
| QA-04 | ACTIVE 세션 존재 | `입실하기`를 연속 두 번 클릭 | 세션은 1개만 유지되고 기존 세션 반환 | 높음 |
| QA-05 | ACTIVE 세션 존재 | `POST /sessions/{id}/camera`에 `ON` 전송 | camera_status가 `ON`으로 저장되고 화면 반영 | 중간 |
| QA-06 | ACTIVE 세션 존재 | `POST /sessions/{id}/camera`에 동일 값 `ON` 재전송 | 오류 없이 같은 상태 유지 | 중간 |
| QA-07 | ACTIVE 세션 존재 | `퇴실하기` 클릭 | 세션 상태 `EXITED`, ended_at 저장, 오늘 공부 시간 반영 | 높음 |
| QA-08 | 이미 EXITED 세션 | `exit` API 재호출 | `alreadyEnded=true` 반환 | 중간 |
| QA-09 | ACTIVE 세션 존재 | heartbeat 60초마다 3회 전송 | last_heartbeat_at 갱신, 세션 유지 | 높음 |
| QA-10 | ACTIVE 세션 존재 | heartbeat 중단 후 3분 초과 | 세션 상태 `DISCONNECTED`, ended_at=last_heartbeat_at | 높음 |
| QA-11 | 학생 세션이 자정 전후에 걸침 | 오늘 공부 시간 조회 | KST 기준 날짜 경계로 정확히 분할 집계 | 높음 |
| QA-12 | 학생 ACTIVE 세션 존재 | 학생이 question 요청 생성 | question_request가 `PENDING` 생성 | 높음 |
| QA-13 | 학생 question `PENDING` | 학생이 질문 취소 | 상태 `CANCELED`, queue에서 제거 | 높음 |
| QA-14 | 학생 question `PENDING` | 학생이 질문 2회 생성 시도 | 두 번째 요청은 409 또는 중복 금지 처리 | 높음 |
| QA-15 | PENDING 질문 존재 | 강사가 pending 목록 조회 | 요청 시각 오름차순으로 정렬 표시 | 높음 |
| QA-16 | PENDING 질문 존재 | 강사가 질문 수락 | question status=`ACCEPTED`, question_room_id 할당 | 높음 |
| QA-17 | ACCEPTED 질문 존재 | 학생 화면 poll | 학생이 질문방 화면으로 자동 이동 | 높음 |
| QA-18 | ACCEPTED 질문 존재 | 강사 화면 | 강사가 질문방 화면으로 진입 | 높음 |
| QA-19 | 학생이 질문방 진입 | 브라우저 mic 권한 허용 | 학생 mic 기본값 ON 표시 | 높음 |
| QA-20 | 강사가 질문방 진입 | 브라우저 mic 권한 허용 | 강사 mic 기본값 ON 표시 | 높음 |
| QA-21 | 학생이 MAIN_ROOM 상태 | mic 켜기 UI 조작 시도 | UI에서 차단되고 서버 상태 변화 없음 | 높음 |
| QA-22 | 강사가 question complete 호출 | 학생이 MAIN_ROOM으로 자동 복귀 | connection_status=`MAIN_ROOM`, mic_policy=`MUTED_LOCKED` | 높음 |
| QA-23 | question complete 완료 | 학생 대시보드 조회 | 질문 상태는 `COMPLETED`, todayStudySeconds에 질문 시간 포함 | 높음 |
| QA-24 | 두 강사가 같은 질문에 동시에 accept 요청 | 두 요청 동시 전송 | 하나만 성공, 하나는 409 | 높음 |
| QA-25 | 질문방 pool이 모두 사용 중 | 강사가 accept 호출 | `QUESTION_ROOM_UNAVAILABLE` 반환, 질문은 PENDING 유지 | 높음 |
| QA-26 | 학생이 PENDING 상태 | 강사가 수락 직전 학생이 cancel 호출 | 하나만 성공하고 최종 상태가 일관됨 | 높음 |
| QA-27 | ACCEPTED 질문 존재 | 학생 브라우저를 종료 | question 상태 `FAILED`, 세션은 disconnect 정책에 따라 처리 | 높음 |
| QA-28 | ACCEPTED 질문 존재 | 강사 브라우저를 종료 | question 상태 `FAILED`, 학생은 MAIN_ROOM 복귀 시도 | 높음 |
| QA-29 | ACTIVE 세션 존재 | 모바일에서 앱 백그라운드 2분 | 세션 유지 | 중간 |
| QA-30 | ACTIVE 세션 존재 | 모바일에서 앱 백그라운드 4분 | 세션 `DISCONNECTED` 종료 | 높음 |
| QA-31 | 학생 로그인 완료 | 모바일 학생 대시보드 확인 | 핵심 버튼과 상태 카드가 화면 폭에 맞게 보임 | 중간 |
| QA-32 | 강사 로그인 완료 | 모바일 강사 대시보드 확인 | 최소 컬럼이 카드형으로 보이고 검색 가능 | 중간 |
| QA-33 | teacher 권한 없음 학생 계정 | `/dashboard/teacher` 직접 호출 | 403 반환 | 높음 |
| QA-34 | student 권한 없음 강사 계정 | `/questions/{id}/accept` 직접 호출 학생 계정으로 시도 | 403 반환 | 높음 |
| QA-35 | admin 계정 | `/rooms/internal` 호출 | room pool 정보 조회 가능 | 중간 |
| QA-36 | teacher 계정 | `/rooms/internal` 호출 | 403 반환 | 중간 |
| QA-37 | ACTIVE 세션 존재 | 브라우저 새로고침 | active session 복구, 중복 세션 생성 없음 | 높음 |
| QA-38 | 다른 기기에서 같은 학생 로그인 | STUDY LAB 진입 후 `입실하기` | 기존 ACTIVE 세션 재사용 | 높음 |
| QA-39 | teacher dashboard open | 30초 자동 갱신 대기 | 목록이 30초 주기로 갱신되고 검색 조건 유지 | 중간 |
| QA-40 | student dashboard active | 5초 poll 중 accept 발생 | 5초 내 질문방 이동 상태 반영 | 높음 |
| QA-41 | ACTIVE 세션 존재 | 서버 오류로 exit transaction 실패 유도 | 상태 rollback, 세션 ACTIVE 유지, 오류 메시지 표시 | 높음 |
| QA-42 | question ACCEPTED 상태 | complete 중 auto return DB update 실패 유도 | question status=`FAILED`, 복구 로그 생성 | 높음 |
| QA-43 | teacher dashboard search 사용 | 검색어 입력 후 자동 갱신 발생 | 검색어 유지된 상태로 갱신 | 중간 |
| QA-44 | 100명 seed 데이터 | teacher dashboard 로딩 | 페이지가 허용 시간 내 렌더링되고 브라우저가 멈추지 않음 | 높음 |
| QA-45 | session started yesterday, still ACTIVE today | student dashboard 조회 | todayStudySeconds는 오늘 00:00 KST 이후만 계산 | 높음 |
| QA-46 | ACTIVE 세션 + PENDING 질문 | 학생이 퇴실 | question 상태 정리 후 session EXITED | 높음 |
| QA-47 | question ACCEPTED 상태 | 학생이 question room URL 직접 새 탭으로 열기 | 권한과 상태가 맞으면 접근, 아니면 차단 | 중간 |
| QA-48 | 강사 여러 명, 질문 여러 건 | pending queue 조회 | requested_at 기준으로 순서가 고정 | 높음 |

---

## 산출물 8. 개발 착수 우선순위

## 최종 개발 순서

| 순서 | 작업 | 이유 |
|---|---|---|
| 1 | 인증/권한 연동 | 모든 API와 화면이 CODE LAB 세션과 권한 매핑에 의존하므로 가장 먼저 고정해야 한다 |
| 2 | DB 스키마 및 seed data | `study_rooms`, `study_sessions`, `question_requests`, `daily_study_summaries`, `audit_logs` 구조가 먼저 있어야 나머지 구현이 가능하다 |
| 3 | 입실/퇴실/heartbeat/집계 코어 서비스 | STUDY LAB의 중심은 study_session과 todayStudySeconds이므로 질문 기능보다 먼저 안정화해야 한다 |
| 4 | 학생 대시보드 | 학생이 세션을 만들고 상태를 보는 UI가 먼저 완성되어야 전체 흐름을 검증할 수 있다 |
| 5 | 강사 대시보드 | teacher view가 있어야 session 상태와 summary가 실제 운영 화면에서 검증된다 |
| 6 | 질문 요청/수락/종료 API | 질문 생명주기를 서버에서 먼저 완성해야 1:1 질문방 UI와 미디어 정책을 올릴 수 있다 |
| 7 | 질문방 이동 및 마이크 정책 | 상태 전이가 안정된 뒤에 room 이동과 mic auto-on 정책을 붙여야 디버깅이 가능하다 |
| 8 | 감사 로그/복구 로직/QA 자동화 | 예외 처리와 운영 안정성은 마지막에 붙이는 것이 아니라 release 전 필수 마무리 단계다 |

## 순서 조정 이유
- 질문방 미디어 정책은 세션/질문 상태 모델이 먼저 안정돼야 구현 실수가 줄어든다.
- `daily_study_summaries`는 teacher dashboard 성능과 직결되므로 학생 UI보다 서버 코어 단계에서 함께 구현한다.
- audit_logs는 초반부터 스키마에 넣되, 화면 기능이 안정된 뒤 상세 로그 포맷을 확정한다.

---

## 개발자가 바로 질문할 가능성이 높은 추가 확인 포인트 10개

1. `QUESTION_ROOM_POOL_SIZE`를 이번 배포에서 몇 개로 둘지 최종 확정이 필요하다.
2. teacher dashboard의 `pageSize` 기본값을 100으로 고정할지 확인이 필요하다.
3. student dashboard의 5초 poll 주기를 그대로 확정할지 확인이 필요하다.
4. 질문 요청 메모 `note`를 MVP에서 실제 노출할지, 백엔드만 받을지 결정이 필요하다.
5. question complete의 시스템 타임아웃 기준 시간을 몇 분으로 둘지 확정이 필요하다.
6. teacher가 question room에서 `질문 종료`를 누르지 않고 브라우저를 닫을 때 즉시 종료로 볼지 타임아웃 처리할지 결정이 필요하다.
7. fallback main room이 활성화되었을 때 teacher dashboard에서 roomLabel을 항상 `전체 공부방`으로만 보여줄지 확인이 필요하다.
8. student가 question room에서 브라우저 mic 권한을 거부했을 때 질문을 계속 진행할지 종료할지 정책 확인이 필요하다.
9. admin이 `/rooms/internal`에서 실제 room 활성/비활성 수정까지 할지, 조회 전용으로 둘지 확정이 필요하다.
10. seed data에서 `MAIN_001`, `QUESTION_ROOM_01..04` naming 규칙을 그대로 사용할지 확인이 필요하다.

---

## 카메라/영상 정책 최종 확정 부칙

이 부칙은 기존 문서 내 `카메라 단순 상태 표시` 관련 표현보다 우선한다.

### 최종 운영 기준
- 학생은 입실 전에 카메라 안내 문구를 먼저 확인해야 한다.
- 학생은 카메라 권한을 허용하고 실제 카메라 영상을 켜야만 입실할 수 있다.
- 카메라를 거부하거나 실제 영상이 켜지지 않으면 입실은 완료되지 않는다.
- 전체 공부방에서는 학생들이 서로의 공부 영상을 볼 수 있어야 한다.
- 강사와 관리자는 전체 학생 영상을 CCTV처럼 한눈에 볼 수 있어야 한다.
- 강사와 관리자는 학생별 오늘 공부 시간도 함께 확인할 수 있어야 한다.
- 질문방으로 이동해도 영상은 유지되어야 하며, 질문방에서는 마이크만 자동으로 켜진다.
- 질문 종료 후 학생은 전체 공부방으로 자동 복귀하며, 복귀 즉시 학생 마이크는 다시 음소거 상태가 된다.
- 입실 중 카메라가 꺼지면 즉시 경고를 띄운다.
- 카메라가 연속 10분 이상 꺼져 있으면 자동 퇴실 처리한다.

### 구현 기준 변경점
- `POST /study-lab/sessions/enter`는 더 이상 단순 입실 API가 아니다.
- 입실 성공 조건에는 `카메라 권한 허용 + 실제 영상 활성화 확인`이 포함된다.
- teacher dashboard는 더 이상 카메라 상태만 보지 않고 학생 영상 타일도 보여줘야 한다.
- `POST /study-lab/sessions/{id}/camera`는 단순 수동 토글이 아니라 실제 카메라 활성/비활성 상태를 서버에 반영하는 API로 해석한다.
- 카메라 OFF 상태가 시작된 시각을 기준으로 10분 초과 시 자동 퇴실 로직이 필요하다.

### 예외 처리 추가 기준
- 카메라 권한 거부: 입실 실패, 재시도 안내
- 카메라 장치 인식 실패: 입실 실패, 장치 확인 안내
- 입실 후 카메라 OFF: 즉시 경고 표시
- 경고 후 10분 내 복구: 세션 유지
- 경고 후 10분 초과: 자동 퇴실

### QA 추가 기준
- 카메라 허용 시에만 입실되는지 확인
- 카메라 거부 시 입실이 막히는지 확인
- 강사 화면에서 학생 영상이 실제로 보이는지 확인
- 질문방 이동 후에도 영상이 유지되는지 확인
- 질문 종료 후 전체방 복귀와 마이크 재음소거가 정상 동작하는지 확인
- 카메라 OFF 후 10분이 지나면 자동 퇴실되는지 확인
