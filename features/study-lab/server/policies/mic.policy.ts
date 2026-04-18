import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { StudyConnectionStatus, StudyMicPolicy } from "../../types/domain";
import { createStudyLabError } from "../services/study-lab-error.service";

export function resolveMicPolicyForConnectionStatus(
  connectionStatus: StudyConnectionStatus,
): StudyMicPolicy {
  return connectionStatus === "QUESTION_ROOM" ? "OPEN" : "MUTED_LOCKED";
}

export function assertStudentMicToggleAllowed(connectionStatus: StudyConnectionStatus): void {
  if (connectionStatus === "MAIN_ROOM" || connectionStatus === "QUESTION_PENDING") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.FORBIDDEN,
      "Student microphone control is disabled outside the 1:1 question room.",
      { connectionStatus },
    );
  }
}
