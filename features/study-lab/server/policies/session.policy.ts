import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type {
  StudyConnectionStatus,
  StudyLabViewer,
  StudySession,
  StudySessionStatus,
} from "../../types/domain";
import { createStudyLabError } from "../services/study-lab-error.service";

const SESSION_STATUS_TRANSITIONS: Record<StudySessionStatus, readonly StudySessionStatus[]> = {
  ACTIVE: ["EXITED", "DISCONNECTED"],
  EXITED: [],
  DISCONNECTED: [],
};

const CONNECTION_STATUS_TRANSITIONS: Record<
  StudyConnectionStatus,
  readonly StudyConnectionStatus[]
> = {
  MAIN_ROOM: ["QUESTION_PENDING", "EXITED", "DISCONNECTED"],
  QUESTION_PENDING: ["MAIN_ROOM", "QUESTION_ROOM", "EXITED", "DISCONNECTED"],
  QUESTION_ROOM: ["MAIN_ROOM", "EXITED", "DISCONNECTED"],
  EXITED: [],
  DISCONNECTED: [],
};

export function assertStudentViewer(viewer: StudyLabViewer): void {
  if (viewer.mappedRole !== "student") {
    throw createStudyLabError(STUDY_LAB_ERROR_CODES.FORBIDDEN, "Student role is required.");
  }
}

export function assertSessionOwner(session: StudySession, userId: string): void {
  if (session.userId !== userId) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.SESSION_OWNER_MISMATCH,
      "The session does not belong to the current user.",
    );
  }
}

export function assertSessionActiveForMutation(session: StudySession): void {
  if (session.status !== "ACTIVE") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.SESSION_NOT_ACTIVE,
      "The study session is not active.",
      { status: session.status },
    );
  }
}

export function assertSessionMutable(session: StudySession): void {
  if (session.status !== "ACTIVE") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.SESSION_ALREADY_ENDED,
      "The study session has already ended.",
      { status: session.status },
    );
  }
}

export function assertSessionStatusTransition(
  currentStatus: StudySessionStatus,
  nextStatus: StudySessionStatus,
): void {
  if (!SESSION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.INVALID_SESSION_TRANSITION,
      `Invalid study session transition: ${currentStatus} -> ${nextStatus}`,
      { currentStatus, nextStatus },
    );
  }
}

export function assertConnectionStatusTransition(
  currentStatus: StudyConnectionStatus,
  nextStatus: StudyConnectionStatus,
): void {
  if (!CONNECTION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.INVALID_CONNECTION_STATUS_TRANSITION,
      `Invalid connection transition: ${currentStatus} -> ${nextStatus}`,
      { currentStatus, nextStatus },
    );
  }
}
