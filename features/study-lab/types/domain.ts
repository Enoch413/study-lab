import type {
  AuditActionType,
  AuditEntityType,
  CodeLabAdminScope,
  CodeLabRole,
  QuestionCompleteReason,
  QuestionRequestStatus,
  StudyCameraStatus,
  StudyConnectionStatus,
  StudyLabMappedRole,
  StudyMicPolicy,
  StudyRoomType,
  StudySessionEndReason,
  StudySessionStatus,
} from "../constants/enums";

export interface StudyLabTransaction {
  readonly kind: "study-lab-transaction";
}

export interface StudyLabTransactionRunner {
  runInTransaction<T>(callback: (tx: StudyLabTransaction) => Promise<T>): Promise<T>;
}

export interface CodeLabAuthUser {
  id: string;
  name: string;
  role: CodeLabRole | string;
  adminScope?: CodeLabAdminScope | string | null;
}

export interface StudyLabViewer {
  userId: string;
  name: string;
  mappedRole: StudyLabMappedRole;
  codeLabRole: CodeLabRole | string;
  adminScope?: CodeLabAdminScope | string | null;
}

export interface StudyRoom {
  id: string;
  roomCode: string;
  roomName: string;
  roomType: StudyRoomType;
  logicalSpaceKey: string;
  isActive: boolean;
  maxCapacity: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudySession {
  id: string;
  userId: string;
  baseRoomId: string;
  currentRoomId: string;
  status: StudySessionStatus;
  connectionStatus: StudyConnectionStatus;
  cameraStatus: StudyCameraStatus;
  micPolicy: StudyMicPolicy;
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date;
  endReason: StudySessionEndReason | null;
  clientInstanceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionRequest {
  id: string;
  studySessionId: string;
  studentUserId: string;
  teacherUserId: string | null;
  questionRoomId: string | null;
  status: QuestionRequestStatus;
  requestNote: string | null;
  requestedAt: Date;
  acceptedAt: Date | null;
  endedAt: Date | null;
  completeReason: QuestionCompleteReason | null;
  autoReturnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyStudySummary {
  id: string;
  userId: string;
  summaryDateKst: string;
  accumulatedSeconds: number;
  lastReconciledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  actorUserId: string | null;
  actionType: AuditActionType;
  payloadJson: Record<string, unknown>;
  createdAt: Date;
}

export interface SessionIntervalSlice {
  summaryDateKst: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
}

export interface EnterSessionCommand {
  viewer: StudyLabViewer;
  clientInstanceId?: string | null;
  deviceLabel?: string | null;
  serverNow?: Date;
}

export interface ExitSessionCommand {
  viewer: StudyLabViewer;
  sessionId: string;
  serverNow?: Date;
}

export interface HeartbeatCommand {
  viewer: StudyLabViewer;
  sessionId: string;
  visibilityState?: string | null;
  networkState?: string | null;
  serverNow?: Date;
}

export interface CameraUpdateCommand {
  viewer: StudyLabViewer;
  sessionId: string;
  cameraStatus: StudyCameraStatus;
  serverNow?: Date;
}

export interface CreateQuestionCommand {
  viewer: StudyLabViewer;
  studySessionId: string;
  note?: string | null;
  serverNow?: Date;
}

export interface QuestionCommand {
  viewer: StudyLabViewer;
  questionId: string;
  serverNow?: Date;
}

export interface CompleteQuestionCommand extends QuestionCommand {
  reason: QuestionCompleteReason;
}

export interface SessionEnterResult {
  reused: boolean;
  session: StudySession;
}

export interface SessionExitResult {
  alreadyEnded: boolean;
  session: StudySession;
  todayStudySeconds: number;
}

export interface QuestionAcceptResult {
  question: QuestionRequest;
  studentSession: StudySession;
  questionRoom: StudyRoom;
}

export interface QuestionCompleteResult {
  question: QuestionRequest;
  studentSession: StudySession;
}

export interface TeacherDashboardFilters {
  search?: string;
  onlyActive?: boolean;
  page?: number;
  pageSize?: number;
}

export type {
  AuditActionType,
  AuditEntityType,
  CodeLabAdminScope,
  CodeLabRole,
  QuestionCompleteReason,
  QuestionRequestStatus,
  StudyCameraStatus,
  StudyConnectionStatus,
  StudyLabMappedRole,
  StudyMicPolicy,
  StudyRoomType,
  StudySessionEndReason,
  StudySessionStatus,
};
