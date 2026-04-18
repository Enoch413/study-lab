export const STUDY_ROOM_TYPES = ["MAIN", "QUESTION", "FALLBACK_MAIN"] as const;
export const STUDY_SESSION_STATUSES = ["ACTIVE", "EXITED", "DISCONNECTED"] as const;
export const STUDY_CONNECTION_STATUSES = [
  "MAIN_ROOM",
  "QUESTION_PENDING",
  "QUESTION_ROOM",
  "EXITED",
  "DISCONNECTED",
] as const;
export const STUDY_CAMERA_STATUSES = ["ON", "OFF"] as const;
export const STUDY_MIC_POLICIES = ["MUTED_LOCKED", "OPEN"] as const;
export const STUDY_SESSION_END_REASONS = [
  "USER_EXIT",
  "HEARTBEAT_TIMEOUT",
  "SYSTEM_TIMEOUT",
  "UNKNOWN_ERROR",
] as const;
export const QUESTION_REQUEST_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "COMPLETED",
  "CANCELED",
  "FAILED",
] as const;
export const QUESTION_COMPLETE_REASONS = [
  "STUDENT_CANCEL",
  "TEACHER_COMPLETE",
  "SYSTEM_TIMEOUT",
  "STUDENT_EXIT",
  "STUDENT_DISCONNECTED",
  "ACCEPT_FAILED",
  "AUTO_RECOVERY_FAILED",
] as const;
export const AUDIT_ENTITY_TYPES = ["STUDY_SESSION", "QUESTION_REQUEST", "ROOM", "SYSTEM"] as const;
export const AUDIT_ACTION_TYPES = [
  "SESSION_ENTER",
  "SESSION_ENTER_REUSED",
  "SESSION_EXIT",
  "SESSION_DISCONNECTED",
  "HEARTBEAT_RECEIVED",
  "QUESTION_CREATED",
  "QUESTION_CANCELED",
  "QUESTION_ACCEPTED",
  "QUESTION_COMPLETED",
  "AUTO_RETURN_APPLIED",
  "CAMERA_CHANGED",
  "MIC_POLICY_APPLIED",
  "ERROR_RECOVERED",
  "ERROR_UNRECOVERED",
] as const;

export const STUDY_LAB_MAPPED_ROLES = ["student", "teacher", "admin"] as const;
export const CODE_LAB_ROLES = ["student", "admin"] as const;
export const CODE_LAB_ADMIN_SCOPES = ["assigned", "all"] as const;

export type StudyRoomType = (typeof STUDY_ROOM_TYPES)[number];
export type StudySessionStatus = (typeof STUDY_SESSION_STATUSES)[number];
export type StudyConnectionStatus = (typeof STUDY_CONNECTION_STATUSES)[number];
export type StudyCameraStatus = (typeof STUDY_CAMERA_STATUSES)[number];
export type StudyMicPolicy = (typeof STUDY_MIC_POLICIES)[number];
export type StudySessionEndReason = (typeof STUDY_SESSION_END_REASONS)[number];
export type QuestionRequestStatus = (typeof QUESTION_REQUEST_STATUSES)[number];
export type QuestionCompleteReason = (typeof QUESTION_COMPLETE_REASONS)[number];
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];
export type StudyLabMappedRole = (typeof STUDY_LAB_MAPPED_ROLES)[number];
export type CodeLabRole = (typeof CODE_LAB_ROLES)[number];
export type CodeLabAdminScope = (typeof CODE_LAB_ADMIN_SCOPES)[number];

export const TERMINAL_STUDY_SESSION_STATUSES: readonly StudySessionStatus[] = ["EXITED", "DISCONNECTED"];
export const OPEN_QUESTION_REQUEST_STATUSES: readonly QuestionRequestStatus[] = ["PENDING", "ACCEPTED"];
export const TERMINAL_QUESTION_REQUEST_STATUSES: readonly QuestionRequestStatus[] = [
  "COMPLETED",
  "CANCELED",
  "FAILED",
];
