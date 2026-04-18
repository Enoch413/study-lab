import type { StudyCameraStatus, StudyMicPolicy } from "./domain";

export type PrototypeViewMode = "student" | "teacher" | "split";

export type PrototypeConnectionStatus =
  | "IDLE"
  | "MAIN_ROOM"
  | "QUESTION_PENDING"
  | "QUESTION_ROOM";

export type PrototypeQuestionStatus = "NONE" | "PENDING" | "ACCEPTED";

export type PrototypeAction =
  | "enter"
  | "exit"
  | "camera_on"
  | "camera_off"
  | "heartbeat"
  | "request_question"
  | "cancel_question"
  | "accept_question"
  | "complete_question"
  | "dismiss_question_toast"
  | "clear_auto_exit_reason";

export interface PrototypeStudentState {
  id: string;
  studentName: string;
  sessionId: string | null;
  isEntered: boolean;
  connectionStatus: PrototypeConnectionStatus;
  cameraStatus: StudyCameraStatus;
  micPolicy: StudyMicPolicy;
  enteredAt: string | null;
  cameraWarningStartedAt: string | null;
  questionStatus: PrototypeQuestionStatus;
  questionRequestedAt: string | null;
  questionAcceptedAt: string | null;
  questionEndedToast: string | null;
  lastHeartbeatAt: string | null;
  autoExitReason: string | null;
  todayStudySeconds: number;
  questionQueueOrder: number | null;
}

export interface PrototypeTeacherState {
  activeQuestionStudentId: string | null;
  pendingQuestionStudentIds: string[];
  lastUpdatedAt: string;
}

export interface StudyLabPrototypeState {
  students: PrototypeStudentState[];
  teacher: PrototypeTeacherState;
}
