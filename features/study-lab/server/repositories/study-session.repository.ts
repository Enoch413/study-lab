import type {
  StudyCameraStatus,
  StudyConnectionStatus,
  StudyLabTransaction,
  StudyMicPolicy,
  StudySession,
  StudySessionEndReason,
  StudySessionStatus,
} from "../../types/domain";

export interface StudySessionLookupOptions {
  tx?: StudyLabTransaction;
  forUpdate?: boolean;
}

export interface CreateStudySessionInput {
  userId: string;
  baseRoomId: string;
  currentRoomId: string;
  status: StudySessionStatus;
  connectionStatus: StudyConnectionStatus;
  cameraStatus: StudyCameraStatus;
  micPolicy: StudyMicPolicy;
  startedAt: Date;
  lastHeartbeatAt: Date;
  clientInstanceId?: string | null;
}

export interface UpdateStudySessionPatch {
  currentRoomId?: string;
  status?: StudySessionStatus;
  connectionStatus?: StudyConnectionStatus;
  cameraStatus?: StudyCameraStatus;
  micPolicy?: StudyMicPolicy;
  endedAt?: Date | null;
  endReason?: StudySessionEndReason | null;
  lastHeartbeatAt?: Date;
  clientInstanceId?: string | null;
}

export interface ActiveStudySessionDashboardRow {
  session: StudySession;
  studentName: string;
}

export interface TeacherDashboardSessionFilters {
  search?: string;
  onlyActive?: boolean;
  page: number;
  pageSize: number;
}

export interface StudySessionRepository {
  findById(sessionId: string, options?: StudySessionLookupOptions): Promise<StudySession | null>;
  findActiveByUserId(userId: string, options?: StudySessionLookupOptions): Promise<StudySession | null>;

  // Transaction + lock required before creating/reusing an ACTIVE session.
  findActiveByUserIdForUpdate(userId: string, tx: StudyLabTransaction): Promise<StudySession | null>;

  // Transaction + lock required before terminal state mutation.
  findByIdForUpdate(sessionId: string, tx: StudyLabTransaction): Promise<StudySession | null>;

  create(input: CreateStudySessionInput, tx: StudyLabTransaction): Promise<StudySession>;

  // Use only inside transaction when state transitions matter.
  updateById(sessionId: string, patch: UpdateStudySessionPatch, tx: StudyLabTransaction): Promise<StudySession>;

  listRecentByUserId(userId: string, limit: number, options?: StudySessionLookupOptions): Promise<StudySession[]>;
  listForTeacherDashboard(
    filters: TeacherDashboardSessionFilters,
    options?: StudySessionLookupOptions,
  ): Promise<{ rows: ActiveStudySessionDashboardRow[]; total: number }>;
}
