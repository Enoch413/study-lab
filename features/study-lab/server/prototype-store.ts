import { HEARTBEAT_TIMEOUT_MS } from "../constants/polling";
import type { StudyCameraStatus, StudyMicPolicy } from "../types/domain";
import type {
  PrototypeAction,
  PrototypeConnectionStatus,
  PrototypeQuestionStatus,
  StudyLabPrototypeState,
} from "../types/prototype";

const CAMERA_OFF_AUTO_EXIT_MS = 10 * 60 * 1000;

const SAMPLE_STUDENTS = [
  { id: "student-kim-minseo", studentName: "김민서" },
  { id: "student-park-junho", studentName: "박준호" },
  { id: "student-lee-seoyun", studentName: "이서윤" },
  { id: "student-choi-haram", studentName: "최하람" },
] as const;

interface MutableStudentState {
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
  accumulatedStudySeconds: number;
}

interface MutablePrototypeStore {
  students: MutableStudentState[];
  pendingQuestionStudentIds: string[];
  activeQuestionStudentId: string | null;
  lastUpdatedAt: string;
}

type PrototypeMutationPayload = {
  studentId?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __studyLabPrototypeStore: MutablePrototypeStore | undefined;
}

export function getStudyLabPrototypeState(): StudyLabPrototypeState {
  const store = getStore();
  const now = new Date();

  sweepExpiredState(store, now);

  return serializeStore(store, now);
}

export function mutateStudyLabPrototypeState(
  action: PrototypeAction,
  payload: PrototypeMutationPayload = {},
): StudyLabPrototypeState {
  const store = getStore();
  const now = new Date();

  sweepExpiredState(store, now);

  switch (action) {
    case "enter":
      handleEnter(store, payload.studentId, now);
      break;
    case "exit":
      handleExit(store, payload.studentId, now);
      break;
    case "camera_on":
      handleCameraOn(store, payload.studentId, now);
      break;
    case "camera_off":
      handleCameraOff(store, payload.studentId, now);
      break;
    case "heartbeat":
      handleHeartbeat(store, payload.studentId, now);
      break;
    case "request_question":
      handleRequestQuestion(store, payload.studentId, now);
      break;
    case "cancel_question":
      handleCancelQuestion(store, payload.studentId);
      break;
    case "accept_question":
      handleAcceptQuestion(store, payload.studentId, now);
      break;
    case "complete_question":
      handleCompleteQuestion(store, payload.studentId, now);
      break;
    case "dismiss_question_toast":
      handleDismissQuestionToast(store, payload.studentId);
      break;
    case "clear_auto_exit_reason":
      handleClearAutoExitReason(store, payload.studentId);
      break;
    default:
      break;
  }

  store.lastUpdatedAt = now.toISOString();

  return serializeStore(store, now);
}

function getStore(): MutablePrototypeStore {
  if (!globalThis.__studyLabPrototypeStore) {
    globalThis.__studyLabPrototypeStore = {
      students: SAMPLE_STUDENTS.map((student) => createStudent(student.id, student.studentName)),
      pendingQuestionStudentIds: [],
      activeQuestionStudentId: null,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  return globalThis.__studyLabPrototypeStore;
}

function createStudent(id: string, studentName: string): MutableStudentState {
  return {
    id,
    studentName,
    sessionId: null,
    isEntered: false,
    connectionStatus: "IDLE",
    cameraStatus: "OFF",
    micPolicy: "MUTED_LOCKED",
    enteredAt: null,
    cameraWarningStartedAt: null,
    questionStatus: "NONE",
    questionRequestedAt: null,
    questionAcceptedAt: null,
    questionEndedToast: null,
    lastHeartbeatAt: null,
    autoExitReason: null,
    accumulatedStudySeconds: 0,
  };
}

function serializeStore(store: MutablePrototypeStore, now: Date): StudyLabPrototypeState {
  return {
    students: store.students.map((student) => ({
      id: student.id,
      studentName: student.studentName,
      sessionId: student.sessionId,
      isEntered: student.isEntered,
      connectionStatus: student.connectionStatus,
      cameraStatus: student.cameraStatus,
      micPolicy: student.micPolicy,
      enteredAt: student.enteredAt,
      cameraWarningStartedAt: student.cameraWarningStartedAt,
      questionStatus: student.questionStatus,
      questionRequestedAt: student.questionRequestedAt,
      questionAcceptedAt: student.questionAcceptedAt,
      questionEndedToast: student.questionEndedToast,
      lastHeartbeatAt: student.lastHeartbeatAt,
      autoExitReason: student.autoExitReason,
      todayStudySeconds: getTodayStudySeconds(student, now),
      questionQueueOrder: getQueueOrder(store.pendingQuestionStudentIds, student.id),
    })),
    teacher: {
      activeQuestionStudentId: store.activeQuestionStudentId,
      pendingQuestionStudentIds: [...store.pendingQuestionStudentIds],
      lastUpdatedAt: store.lastUpdatedAt,
    },
  };
}

function getTodayStudySeconds(student: MutableStudentState, now: Date): number {
  if (!student.isEntered || !student.enteredAt) {
    return student.accumulatedStudySeconds;
  }

  return student.accumulatedStudySeconds + diffSeconds(new Date(student.enteredAt), now);
}

function getQueueOrder(queue: string[], studentId: string): number | null {
  const index = queue.indexOf(studentId);
  return index === -1 ? null : index + 1;
}

function handleEnter(store: MutablePrototypeStore, studentId: string | null | undefined, now: Date) {
  const student = getStudent(store, studentId);
  if (!student || student.isEntered) {
    return;
  }

  student.sessionId = crypto.randomUUID();
  student.isEntered = true;
  student.connectionStatus = "MAIN_ROOM";
  student.cameraStatus = "ON";
  student.micPolicy = "MUTED_LOCKED";
  student.enteredAt = now.toISOString();
  student.lastHeartbeatAt = now.toISOString();
  student.cameraWarningStartedAt = null;
  student.questionStatus = "NONE";
  student.questionRequestedAt = null;
  student.questionAcceptedAt = null;
  student.questionEndedToast = null;
  student.autoExitReason = null;
}

function handleExit(store: MutablePrototypeStore, studentId: string | null | undefined, now: Date) {
  const student = getStudent(store, studentId);
  if (!student || !student.isEntered) {
    return;
  }

  finalizeExit(store, student, now, null);
}

function handleCameraOn(store: MutablePrototypeStore, studentId: string | null | undefined, now: Date) {
  const student = getStudent(store, studentId);
  if (!student || !student.isEntered) {
    return;
  }

  student.cameraStatus = "ON";
  student.cameraWarningStartedAt = null;
  student.lastHeartbeatAt = now.toISOString();
}

function handleCameraOff(store: MutablePrototypeStore, studentId: string | null | undefined, now: Date) {
  const student = getStudent(store, studentId);
  if (!student || !student.isEntered) {
    return;
  }

  student.cameraStatus = "OFF";
  student.cameraWarningStartedAt = now.toISOString();
  student.lastHeartbeatAt = now.toISOString();
}

function handleHeartbeat(store: MutablePrototypeStore, studentId: string | null | undefined, now: Date) {
  const student = getStudent(store, studentId);
  if (!student || !student.isEntered) {
    return;
  }

  student.lastHeartbeatAt = now.toISOString();
}

function handleRequestQuestion(
  store: MutablePrototypeStore,
  studentId: string | null | undefined,
  now: Date,
) {
  const student = getStudent(store, studentId);
  if (!student || !student.isEntered) {
    return;
  }

  if (student.connectionStatus !== "MAIN_ROOM" || student.questionStatus !== "NONE") {
    return;
  }

  student.connectionStatus = "QUESTION_PENDING";
  student.questionStatus = "PENDING";
  student.questionRequestedAt = now.toISOString();
  student.questionAcceptedAt = null;
  student.questionEndedToast = null;

  if (!store.pendingQuestionStudentIds.includes(student.id)) {
    store.pendingQuestionStudentIds.push(student.id);
  }
}

function handleCancelQuestion(store: MutablePrototypeStore, studentId: string | null | undefined) {
  const student = getStudent(store, studentId);
  if (!student || student.questionStatus !== "PENDING") {
    return;
  }

  store.pendingQuestionStudentIds = store.pendingQuestionStudentIds.filter((id) => id !== student.id);
  resetQuestionState(student);
  student.connectionStatus = student.isEntered ? "MAIN_ROOM" : "IDLE";
}

function handleAcceptQuestion(
  store: MutablePrototypeStore,
  studentId: string | null | undefined,
  now: Date,
) {
  if (store.activeQuestionStudentId) {
    return;
  }

  const targetStudentId = studentId ?? store.pendingQuestionStudentIds[0];
  if (!targetStudentId || store.pendingQuestionStudentIds[0] !== targetStudentId) {
    return;
  }

  const student = getStudent(store, targetStudentId);
  if (!student || student.questionStatus !== "PENDING") {
    return;
  }

  store.pendingQuestionStudentIds = store.pendingQuestionStudentIds.filter((id) => id !== student.id);
  store.activeQuestionStudentId = student.id;

  student.connectionStatus = "QUESTION_ROOM";
  student.questionStatus = "ACCEPTED";
  student.questionAcceptedAt = now.toISOString();
  student.micPolicy = "OPEN";
  student.lastHeartbeatAt = now.toISOString();
}

function handleCompleteQuestion(
  store: MutablePrototypeStore,
  studentId: string | null | undefined,
  now: Date,
) {
  const targetStudentId = studentId ?? store.activeQuestionStudentId;
  if (!targetStudentId) {
    return;
  }

  const student = getStudent(store, targetStudentId);
  if (!student || student.questionStatus !== "ACCEPTED") {
    return;
  }

  store.activeQuestionStudentId = null;

  student.connectionStatus = "MAIN_ROOM";
  student.questionStatus = "NONE";
  student.questionRequestedAt = null;
  student.questionAcceptedAt = null;
  student.questionEndedToast = "질문이 종료되어 전체 공부방으로 돌아왔습니다.";
  student.micPolicy = "MUTED_LOCKED";
  student.lastHeartbeatAt = now.toISOString();
}

function handleDismissQuestionToast(store: MutablePrototypeStore, studentId: string | null | undefined) {
  const student = getStudent(store, studentId);
  if (!student) {
    return;
  }

  student.questionEndedToast = null;
}

function handleClearAutoExitReason(store: MutablePrototypeStore, studentId: string | null | undefined) {
  const student = getStudent(store, studentId);
  if (!student) {
    return;
  }

  student.autoExitReason = null;
}

function sweepExpiredState(store: MutablePrototypeStore, now: Date) {
  for (const student of store.students) {
    if (!student.isEntered || !student.enteredAt) {
      continue;
    }

    if (
      student.lastHeartbeatAt &&
      now.getTime() - new Date(student.lastHeartbeatAt).getTime() > HEARTBEAT_TIMEOUT_MS
    ) {
      finalizeExit(store, student, new Date(student.lastHeartbeatAt), "연결이 끊겨 자동 퇴실 처리되었습니다.");
      continue;
    }

    if (
      student.cameraStatus === "OFF" &&
      student.cameraWarningStartedAt &&
      now.getTime() - new Date(student.cameraWarningStartedAt).getTime() >= CAMERA_OFF_AUTO_EXIT_MS
    ) {
      finalizeExit(store, student, now, "카메라가 10분 이상 꺼져 있어 자동 퇴실 처리되었습니다.");
    }
  }
}

function finalizeExit(
  store: MutablePrototypeStore,
  student: MutableStudentState,
  endedAt: Date,
  autoExitReason: string | null,
) {
  if (student.enteredAt) {
    student.accumulatedStudySeconds += diffSeconds(new Date(student.enteredAt), endedAt);
  }

  store.pendingQuestionStudentIds = store.pendingQuestionStudentIds.filter((id) => id !== student.id);

  if (store.activeQuestionStudentId === student.id) {
    store.activeQuestionStudentId = null;
  }

  student.sessionId = null;
  student.isEntered = false;
  student.connectionStatus = "IDLE";
  student.micPolicy = "MUTED_LOCKED";
  student.enteredAt = null;
  student.lastHeartbeatAt = null;
  student.cameraWarningStartedAt = null;
  student.questionEndedToast = null;
  student.autoExitReason = autoExitReason;
  student.cameraStatus = autoExitReason ? "OFF" : student.cameraStatus;

  resetQuestionState(student);
}

function resetQuestionState(student: MutableStudentState) {
  student.questionStatus = "NONE";
  student.questionRequestedAt = null;
  student.questionAcceptedAt = null;
}

function getStudent(
  store: MutablePrototypeStore,
  studentId: string | null | undefined,
): MutableStudentState | null {
  if (!studentId) {
    return store.students[0] ?? null;
  }

  return store.students.find((student) => student.id === studentId) ?? null;
}

function diffSeconds(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}
