import type {
  AuditLog,
  CodeLabAuthUser,
  DailyStudySummary,
  QuestionCompleteReason,
  QuestionRequest,
  QuestionRequestStatus,
  StudyCameraStatus,
  StudyConnectionStatus,
  StudyLabTransaction,
  StudyMicPolicy,
  StudyRoom,
  StudyRoomType,
  StudySession,
  StudySessionEndReason,
  StudySessionSnapshot,
  StudySessionStatus,
} from "../../types/domain";
import type {
  AuditLogRepository,
  CreateAuditLogInput,
} from "./audit-log.repository";
import type {
  DailyStudySummaryLookupOptions,
  DailyStudySummaryRepository,
  UpsertDailyStudySummaryInput,
} from "./daily-study-summary.repository";
import type {
  CreateQuestionRequestInput,
  PendingQuestionQueueRow,
  QuestionRequestLookupOptions,
  QuestionRequestRepository,
  UpdateQuestionRequestPatch,
} from "./question-request.repository";
import type {
  InternalRoomUsageRow,
  StudyRoomLookupOptions,
  StudyRoomRepository,
} from "./study-room.repository";
import type {
  ActiveStudySessionDashboardRow,
  CreateStudySessionInput,
  StudySessionLookupOptions,
  StudySessionRepository,
  TeacherDashboardSessionFilters,
  UpdateStudySessionPatch,
} from "./study-session.repository";
import type {
  StudySessionSnapshotRepository,
  UpsertStudySessionSnapshotInput,
  StudySessionSnapshotLookupOptions,
} from "./study-session-snapshot.repository";
import type {
  UpsertFirebaseUserInput,
  UserLookupOptions,
  UserRepository,
} from "./user.repository";
import { pgQueryInContext } from "@/lib/db/transaction";

interface StudyRoomRow {
  id: string;
  room_code: string;
  room_name: string;
  room_type: StudyRoomType;
  logical_space_key: string;
  is_active: boolean;
  max_capacity: number;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface StudySessionRow {
  id: string;
  user_id: string;
  base_room_id: string;
  current_room_id: string;
  status: StudySessionStatus;
  connection_status: StudyConnectionStatus;
  camera_status: StudyCameraStatus;
  mic_policy: StudyMicPolicy;
  started_at: Date | string;
  ended_at: Date | string | null;
  last_heartbeat_at: Date | string;
  end_reason: StudySessionEndReason | null;
  client_instance_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface StudySessionSnapshotRow {
  study_session_id: string;
  student_user_id: string;
  image_data_url: string;
  captured_at: Date | string;
  updated_at: Date | string;
}

interface QuestionRequestRow {
  id: string;
  study_session_id: string;
  student_user_id: string;
  teacher_user_id: string | null;
  question_room_id: string | null;
  status: QuestionRequestStatus;
  request_note: string | null;
  requested_at: Date | string;
  accepted_at: Date | string | null;
  ended_at: Date | string | null;
  complete_reason: QuestionCompleteReason | null;
  auto_returned_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DailyStudySummaryRow {
  id: string;
  user_id: string;
  summary_date_kst: Date | string;
  accumulated_seconds: number;
  last_reconciled_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AuditLogRow {
  id: string;
  entity_type: AuditLog["entityType"];
  entity_id: string;
  actor_user_id: string | null;
  action_type: AuditLog["actionType"];
  payload_json: Record<string, unknown>;
  created_at: Date | string;
}

interface UserRow {
  id: string;
  firebase_uid: string;
  email: string | null;
  name: string;
  role: string;
  admin_scope: string | null;
}

export class PgUserRepository implements UserRepository {
  async findById(userId: string, options: UserLookupOptions = {}): Promise<CodeLabAuthUser | null> {
    const result = await pgQueryInContext<UserRow>(
      options.tx,
      "select id, firebase_uid, email, name, role, admin_scope from users where id = $1",
      [userId],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findByFirebaseUid(
    firebaseUid: string,
    options: UserLookupOptions = {},
  ): Promise<CodeLabAuthUser | null> {
    const result = await pgQueryInContext<UserRow>(
      options.tx,
      "select id, firebase_uid, email, name, role, admin_scope from users where firebase_uid = $1",
      [firebaseUid],
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async upsertFirebaseUser(
    input: UpsertFirebaseUserInput,
    options: UserLookupOptions = {},
  ): Promise<CodeLabAuthUser> {
    const result = await pgQueryInContext<UserRow>(
      options.tx,
      `insert into users (firebase_uid, email, name, role, admin_scope)
       values ($1, $2, $3, $4, $5)
       on conflict (firebase_uid) do update
       set
         email = excluded.email,
         name = excluded.name,
         role = excluded.role,
         admin_scope = excluded.admin_scope
       returning id, firebase_uid, email, name, role, admin_scope`,
      [
        input.firebaseUid,
        input.email ?? null,
        input.name,
        input.role,
        input.adminScope ?? null,
      ],
    );

    return mapUser(result.rows[0]);
  }

  async findByIds(userIds: string[], options: UserLookupOptions = {}): Promise<CodeLabAuthUser[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await pgQueryInContext<UserRow>(
      options.tx,
      "select id, firebase_uid, email, name, role, admin_scope from users where id = any($1::uuid[])",
      [userIds],
    );

    return result.rows.map(mapUser);
  }
}

export class PgStudyRoomRepository implements StudyRoomRepository {
  async findById(roomId: string, options: StudyRoomLookupOptions = {}): Promise<StudyRoom | null> {
    const result = await pgQueryInContext<StudyRoomRow>(
      options.tx,
      `select * from study_rooms where id = $1 ${options.forUpdate ? "for update" : ""}`,
      [roomId],
    );

    return result.rows[0] ? mapStudyRoom(result.rows[0]) : null;
  }

  async findByCode(roomCode: string, options: StudyRoomLookupOptions = {}): Promise<StudyRoom | null> {
    const result = await pgQueryInContext<StudyRoomRow>(
      options.tx,
      `select * from study_rooms where room_code = $1 ${options.forUpdate ? "for update" : ""}`,
      [roomCode],
    );

    return result.rows[0] ? mapStudyRoom(result.rows[0]) : null;
  }

  async findActiveMainRoom(options: StudyRoomLookupOptions = {}): Promise<StudyRoom | null> {
    const result = await pgQueryInContext<StudyRoomRow>(
      options.tx,
      `select *
       from study_rooms
       where room_type in ('MAIN', 'FALLBACK_MAIN') and is_active = true
       order by case when room_type = 'MAIN' then 0 else 1 end, sort_order asc
       limit 1
       ${options.forUpdate ? "for update" : ""}`,
    );

    return result.rows[0] ? mapStudyRoom(result.rows[0]) : null;
  }

  async findActiveRoomsByType(
    roomType: StudyRoomType,
    options: StudyRoomLookupOptions = {},
  ): Promise<StudyRoom[]> {
    const result = await pgQueryInContext<StudyRoomRow>(
      options.tx,
      `select *
       from study_rooms
       where room_type = $1 and is_active = true
       order by sort_order asc
       ${options.forUpdate ? "for update" : ""}`,
      [roomType],
    );

    return result.rows.map(mapStudyRoom);
  }

  async findAvailableQuestionRoomForUpdate(tx: StudyLabTransaction): Promise<StudyRoom | null> {
    const result = await pgQueryInContext<StudyRoomRow>(
      tx,
      `select r.*
       from study_rooms r
       where r.room_type = 'QUESTION'
         and r.is_active = true
         and not exists (
           select 1
           from question_requests q
           where q.question_room_id = r.id
             and q.status = 'ACCEPTED'
         )
       order by r.sort_order asc
       limit 1
       for update skip locked`,
    );

    return result.rows[0] ? mapStudyRoom(result.rows[0]) : null;
  }

  async listInternalRoomUsage(options: StudyRoomLookupOptions = {}): Promise<InternalRoomUsageRow[]> {
    const result = await pgQueryInContext<
      StudyRoomRow & { active_session_count: number; active_question_request_id: string | null }
    >(
      options.tx,
      `select
         r.*,
         count(s.id)::int as active_session_count,
         max(q.id::text) as active_question_request_id
       from study_rooms r
       left join study_sessions s on s.current_room_id = r.id and s.status = 'ACTIVE'
       left join question_requests q on q.question_room_id = r.id and q.status = 'ACCEPTED'
       group by r.id
       order by r.sort_order asc`,
    );

    return result.rows.map((row) => ({
      room: mapStudyRoom(row),
      activeSessionCount: row.active_session_count,
      activeQuestionRequestId: row.active_question_request_id,
    }));
  }
}

export class PgStudySessionRepository implements StudySessionRepository {
  async findById(
    sessionId: string,
    options: StudySessionLookupOptions = {},
  ): Promise<StudySession | null> {
    const result = await pgQueryInContext<StudySessionRow>(
      options.tx,
      `select * from study_sessions where id = $1 ${options.forUpdate ? "for update" : ""}`,
      [sessionId],
    );

    return result.rows[0] ? mapStudySession(result.rows[0]) : null;
  }

  async findActiveByUserId(
    userId: string,
    options: StudySessionLookupOptions = {},
  ): Promise<StudySession | null> {
    const result = await pgQueryInContext<StudySessionRow>(
      options.tx,
      `select *
       from study_sessions
       where user_id = $1 and status = 'ACTIVE'
       order by started_at desc
       limit 1
       ${options.forUpdate ? "for update" : ""}`,
      [userId],
    );

    return result.rows[0] ? mapStudySession(result.rows[0]) : null;
  }

  async findActiveByUserIdForUpdate(
    userId: string,
    tx: StudyLabTransaction,
  ): Promise<StudySession | null> {
    return this.findActiveByUserId(userId, { tx, forUpdate: true });
  }

  async findByIdForUpdate(sessionId: string, tx: StudyLabTransaction): Promise<StudySession | null> {
    return this.findById(sessionId, { tx, forUpdate: true });
  }

  async create(input: CreateStudySessionInput, tx: StudyLabTransaction): Promise<StudySession> {
    const result = await pgQueryInContext<StudySessionRow>(
      tx,
      `insert into study_sessions (
         user_id,
         base_room_id,
         current_room_id,
         status,
         connection_status,
         camera_status,
         mic_policy,
         started_at,
         last_heartbeat_at,
         client_instance_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        input.userId,
        input.baseRoomId,
        input.currentRoomId,
        input.status,
        input.connectionStatus,
        input.cameraStatus,
        input.micPolicy,
        input.startedAt,
        input.lastHeartbeatAt,
        input.clientInstanceId ?? null,
      ],
    );

    return mapStudySession(result.rows[0]);
  }

  async updateById(
    sessionId: string,
    patch: UpdateStudySessionPatch,
    tx: StudyLabTransaction,
  ): Promise<StudySession> {
    const { fragments, values } = buildPatch([
      ["currentRoomId", "current_room_id", patch.currentRoomId],
      ["status", "status", patch.status],
      ["connectionStatus", "connection_status", patch.connectionStatus],
      ["cameraStatus", "camera_status", patch.cameraStatus],
      ["micPolicy", "mic_policy", patch.micPolicy],
      ["endedAt", "ended_at", patch.endedAt],
      ["endReason", "end_reason", patch.endReason],
      ["lastHeartbeatAt", "last_heartbeat_at", patch.lastHeartbeatAt],
      ["clientInstanceId", "client_instance_id", patch.clientInstanceId],
    ]);

    if (fragments.length === 0) {
      const existing = await this.findByIdForUpdate(sessionId, tx);

      if (!existing) {
        throw new Error(`Study session not found: ${sessionId}`);
      }

      return existing;
    }

    values.push(sessionId);
    const result = await pgQueryInContext<StudySessionRow>(
      tx,
      `update study_sessions
       set ${fragments.join(", ")}
       where id = $${values.length}
       returning *`,
      values,
    );

    return mapStudySession(result.rows[0]);
  }

  async listRecentByUserId(
    userId: string,
    limit: number,
    options: StudySessionLookupOptions = {},
  ): Promise<StudySession[]> {
    const result = await pgQueryInContext<StudySessionRow>(
      options.tx,
      `select *
       from study_sessions
       where user_id = $1
       order by started_at desc
       limit $2`,
      [userId, limit],
    );

    return result.rows.map(mapStudySession);
  }

  async listForTeacherDashboard(
    filters: TeacherDashboardSessionFilters,
    options: StudySessionLookupOptions = {},
  ): Promise<{ rows: ActiveStudySessionDashboardRow[]; total: number }> {
    const where: string[] = ["s.status = 'ACTIVE'"];
    const values: unknown[] = [];

    if (filters.search) {
      values.push(`%${filters.search}%`);
      where.push(`u.name ilike $${values.length}`);
    }

    const offset = (filters.page - 1) * filters.pageSize;
    values.push(filters.pageSize, offset);

    const result = await pgQueryInContext<
      StudySessionRow & { student_name: string; total_count: number }
    >(
      options.tx,
      `select s.*, u.name as student_name, count(*) over()::int as total_count
       from study_sessions s
       join users u on u.id = s.user_id
       where ${where.join(" and ")}
       order by s.started_at asc
       limit $${values.length - 1}
       offset $${values.length}`,
      values,
    );

    return {
      rows: result.rows.map((row) => ({
        session: mapStudySession(row),
        studentName: row.student_name,
      })),
      total: result.rows[0]?.total_count ?? 0,
    };
  }
}

export class PgStudySessionSnapshotRepository implements StudySessionSnapshotRepository {
  async upsert(
    input: UpsertStudySessionSnapshotInput,
    options: StudySessionSnapshotLookupOptions = {},
  ): Promise<StudySessionSnapshot> {
    const result = await pgQueryInContext<StudySessionSnapshotRow>(
      options.tx,
      `insert into study_session_snapshots (
         study_session_id,
         student_user_id,
         image_data_url,
         captured_at
       )
       values ($1, $2, $3, $4)
       on conflict (study_session_id) do update
       set
         student_user_id = excluded.student_user_id,
         image_data_url = excluded.image_data_url,
         captured_at = excluded.captured_at,
         updated_at = now()
       returning *`,
      [input.studySessionId, input.studentUserId, input.imageDataUrl, input.capturedAt],
    );

    return mapStudySessionSnapshot(result.rows[0]);
  }

  async findManyBySessionIds(
    sessionIds: string[],
    options: StudySessionSnapshotLookupOptions = {},
  ): Promise<StudySessionSnapshot[]> {
    if (sessionIds.length === 0) {
      return [];
    }

    try {
      const result = await pgQueryInContext<StudySessionSnapshotRow>(
        options.tx,
        `select *
         from study_session_snapshots
         where study_session_id = any($1::uuid[])`,
        [sessionIds],
      );

      return result.rows.map(mapStudySessionSnapshot);
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return [];
      }

      throw error;
    }
  }

  async deleteBySessionId(
    studySessionId: string,
    options: StudySessionSnapshotLookupOptions = {},
  ): Promise<void> {
    try {
      await pgQueryInContext(
        options.tx,
        "delete from study_session_snapshots where study_session_id = $1",
        [studySessionId],
      );
    } catch (error) {
      if (!isUndefinedTableError(error)) {
        throw error;
      }
    }
  }

  async deleteByStudentUserId(
    studentUserId: string,
    options: StudySessionSnapshotLookupOptions = {},
  ): Promise<void> {
    try {
      await pgQueryInContext(
        options.tx,
        "delete from study_session_snapshots where student_user_id = $1",
        [studentUserId],
      );
    } catch (error) {
      if (!isUndefinedTableError(error)) {
        throw error;
      }
    }
  }
}

export class PgQuestionRequestRepository implements QuestionRequestRepository {
  async findById(
    questionId: string,
    options: QuestionRequestLookupOptions = {},
  ): Promise<QuestionRequest | null> {
    const result = await pgQueryInContext<QuestionRequestRow>(
      options.tx,
      `select * from question_requests where id = $1 ${options.forUpdate ? "for update" : ""}`,
      [questionId],
    );

    return result.rows[0] ? mapQuestionRequest(result.rows[0]) : null;
  }

  async findOpenByStudentUserId(
    studentUserId: string,
    options: QuestionRequestLookupOptions = {},
  ): Promise<QuestionRequest | null> {
    const result = await pgQueryInContext<QuestionRequestRow>(
      options.tx,
      `select *
       from question_requests
       where student_user_id = $1 and status in ('PENDING', 'ACCEPTED')
       order by requested_at desc
       limit 1
       ${options.forUpdate ? "for update" : ""}`,
      [studentUserId],
    );

    return result.rows[0] ? mapQuestionRequest(result.rows[0]) : null;
  }

  async findByIdForUpdate(
    questionId: string,
    tx: StudyLabTransaction,
  ): Promise<QuestionRequest | null> {
    return this.findById(questionId, { tx, forUpdate: true });
  }

  async findOpenByStudentUserIdForUpdate(
    studentUserId: string,
    tx: StudyLabTransaction,
  ): Promise<QuestionRequest | null> {
    return this.findOpenByStudentUserId(studentUserId, { tx, forUpdate: true });
  }

  async create(input: CreateQuestionRequestInput, tx: StudyLabTransaction): Promise<QuestionRequest> {
    const result = await pgQueryInContext<QuestionRequestRow>(
      tx,
      `insert into question_requests (
         study_session_id,
         student_user_id,
         status,
         request_note,
         requested_at
       )
       values ($1, $2, $3, $4, $5)
       returning *`,
      [
        input.studySessionId,
        input.studentUserId,
        input.status,
        input.requestNote ?? null,
        input.requestedAt,
      ],
    );

    return mapQuestionRequest(result.rows[0]);
  }

  async updateById(
    questionId: string,
    patch: UpdateQuestionRequestPatch,
    tx: StudyLabTransaction,
  ): Promise<QuestionRequest> {
    const { fragments, values } = buildPatch([
      ["teacherUserId", "teacher_user_id", patch.teacherUserId],
      ["questionRoomId", "question_room_id", patch.questionRoomId],
      ["status", "status", patch.status],
      ["acceptedAt", "accepted_at", patch.acceptedAt],
      ["endedAt", "ended_at", patch.endedAt],
      ["completeReason", "complete_reason", patch.completeReason],
      ["autoReturnedAt", "auto_returned_at", patch.autoReturnedAt],
    ]);

    if (fragments.length === 0) {
      const existing = await this.findByIdForUpdate(questionId, tx);

      if (!existing) {
        throw new Error(`Question request not found: ${questionId}`);
      }

      return existing;
    }

    values.push(questionId);
    const result = await pgQueryInContext<QuestionRequestRow>(
      tx,
      `update question_requests
       set ${fragments.join(", ")}
       where id = $${values.length}
       returning *`,
      values,
    );

    return mapQuestionRequest(result.rows[0]);
  }

  async listPending(
    limit: number,
    options: QuestionRequestLookupOptions = {},
  ): Promise<PendingQuestionQueueRow[]> {
    const result = await pgQueryInContext<
      QuestionRequestRow & { student_name: string; queue_position: number }
    >(
      options.tx,
      `select
         q.*,
         u.name as student_name,
         row_number() over (order by q.requested_at asc)::int as queue_position
       from question_requests q
       join users u on u.id = q.student_user_id
       where q.status = 'PENDING'
       order by q.requested_at asc
       limit $1`,
      [limit],
    );

    return result.rows.map((row) => ({
      question: mapQuestionRequest(row),
      studentName: row.student_name,
      queuePosition: row.queue_position,
    }));
  }

  async findAcceptedByQuestionRoomId(
    questionRoomId: string,
    options: QuestionRequestLookupOptions = {},
  ): Promise<QuestionRequest | null> {
    const result = await pgQueryInContext<QuestionRequestRow>(
      options.tx,
      `select *
       from question_requests
       where question_room_id = $1 and status = 'ACCEPTED'
       limit 1
       ${options.forUpdate ? "for update" : ""}`,
      [questionRoomId],
    );

    return result.rows[0] ? mapQuestionRequest(result.rows[0]) : null;
  }
}

export class PgDailyStudySummaryRepository implements DailyStudySummaryRepository {
  async findByUserIdAndDate(
    userId: string,
    summaryDateKst: string,
    options: DailyStudySummaryLookupOptions = {},
  ): Promise<DailyStudySummary | null> {
    const result = await pgQueryInContext<DailyStudySummaryRow>(
      options.tx,
      `select *
       from daily_study_summaries
       where user_id = $1 and summary_date_kst = $2`,
      [userId, summaryDateKst],
    );

    return result.rows[0] ? mapDailyStudySummary(result.rows[0]) : null;
  }

  async findManyByUserIdsAndDate(
    userIds: string[],
    summaryDateKst: string,
    options: DailyStudySummaryLookupOptions = {},
  ): Promise<DailyStudySummary[]> {
    if (userIds.length === 0) {
      return [];
    }

    const result = await pgQueryInContext<DailyStudySummaryRow>(
      options.tx,
      `select *
       from daily_study_summaries
       where user_id = any($1::uuid[]) and summary_date_kst = $2`,
      [userIds, summaryDateKst],
    );

    return result.rows.map(mapDailyStudySummary);
  }

  async findTotalsByUserId(
    userId: string,
    options: DailyStudySummaryLookupOptions = {},
  ): Promise<{ totalStudyDays: number; totalStudySeconds: number }> {
    const result = await pgQueryInContext<{
      total_study_days: number;
      total_study_seconds: number | string;
    }>(
      options.tx,
      `select
         count(*) filter (where accumulated_seconds > 0)::int as total_study_days,
         coalesce(sum(accumulated_seconds), 0)::bigint as total_study_seconds
       from daily_study_summaries
       where user_id = $1`,
      [userId],
    );
    const row = result.rows[0];

    return {
      totalStudyDays: Number(row?.total_study_days ?? 0),
      totalStudySeconds: Number(row?.total_study_seconds ?? 0),
    };
  }

  async upsert(
    input: UpsertDailyStudySummaryInput,
    tx: StudyLabTransaction,
  ): Promise<DailyStudySummary> {
    const result = await pgQueryInContext<DailyStudySummaryRow>(
      tx,
      `insert into daily_study_summaries (
         user_id,
         summary_date_kst,
         accumulated_seconds,
         last_reconciled_at
       )
       values ($1, $2, $3, $4)
       on conflict (user_id, summary_date_kst) do update
       set
         accumulated_seconds = excluded.accumulated_seconds,
         last_reconciled_at = excluded.last_reconciled_at
       returning *`,
      [
        input.userId,
        input.summaryDateKst,
        input.accumulatedSeconds,
        input.lastReconciledAt,
      ],
    );

    return mapDailyStudySummary(result.rows[0]);
  }
}

export class PgAuditLogRepository implements AuditLogRepository {
  async create(input: CreateAuditLogInput, tx?: StudyLabTransaction): Promise<AuditLog> {
    const result = await pgQueryInContext<AuditLogRow>(
      tx,
      `insert into audit_logs (
         entity_type,
         entity_id,
         actor_user_id,
         action_type,
         payload_json,
         created_at
       )
       values ($1, $2, $3, $4, $5::jsonb, $6)
       returning *`,
      [
        input.entityType,
        input.entityId,
        input.actorUserId ?? null,
        input.actionType,
        JSON.stringify(input.payloadJson ?? {}),
        input.createdAt ?? new Date(),
      ],
    );

    return mapAuditLog(result.rows[0]);
  }
}

function buildPatch(
  entries: Array<[string, string, unknown]>,
): { fragments: string[]; values: unknown[] } {
  const fragments: string[] = [];
  const values: unknown[] = [];

  for (const [, column, value] of entries) {
    if (value === undefined) {
      continue;
    }

    values.push(value);
    fragments.push(`${column} = $${values.length}`);
  }

  return { fragments, values };
}

function mapUser(row: UserRow): CodeLabAuthUser {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    adminScope: row.admin_scope,
  };
}

function mapStudyRoom(row: StudyRoomRow): StudyRoom {
  return {
    id: row.id,
    roomCode: row.room_code,
    roomName: row.room_name,
    roomType: row.room_type,
    logicalSpaceKey: row.logical_space_key,
    isActive: row.is_active,
    maxCapacity: row.max_capacity,
    sortOrder: row.sort_order,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapStudySession(row: StudySessionRow): StudySession {
  return {
    id: row.id,
    userId: row.user_id,
    baseRoomId: row.base_room_id,
    currentRoomId: row.current_room_id,
    status: row.status,
    connectionStatus: row.connection_status,
    cameraStatus: row.camera_status,
    micPolicy: row.mic_policy,
    startedAt: toDate(row.started_at),
    endedAt: toNullableDate(row.ended_at),
    lastHeartbeatAt: toDate(row.last_heartbeat_at),
    endReason: row.end_reason,
    clientInstanceId: row.client_instance_id,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapStudySessionSnapshot(row: StudySessionSnapshotRow): StudySessionSnapshot {
  return {
    studySessionId: row.study_session_id,
    studentUserId: row.student_user_id,
    imageDataUrl: row.image_data_url,
    capturedAt: toDate(row.captured_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapQuestionRequest(row: QuestionRequestRow): QuestionRequest {
  return {
    id: row.id,
    studySessionId: row.study_session_id,
    studentUserId: row.student_user_id,
    teacherUserId: row.teacher_user_id,
    questionRoomId: row.question_room_id,
    status: row.status,
    requestNote: row.request_note,
    requestedAt: toDate(row.requested_at),
    acceptedAt: toNullableDate(row.accepted_at),
    endedAt: toNullableDate(row.ended_at),
    completeReason: row.complete_reason,
    autoReturnedAt: toNullableDate(row.auto_returned_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapDailyStudySummary(row: DailyStudySummaryRow): DailyStudySummary {
  return {
    id: row.id,
    userId: row.user_id,
    summaryDateKst: toDateOnlyString(row.summary_date_kst),
    accumulatedSeconds: row.accumulated_seconds,
    lastReconciledAt: toDate(row.last_reconciled_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorUserId: row.actor_user_id,
    actionType: row.action_type,
    payloadJson: row.payload_json,
    createdAt: toDate(row.created_at),
  };
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  return value == null ? null : toDate(value);
}

function toDateOnlyString(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}
