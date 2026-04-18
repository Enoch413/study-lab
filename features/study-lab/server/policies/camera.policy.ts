import { STUDY_CAMERA_STATUSES } from "../../constants/enums";
import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { StudyCameraStatus, StudySession } from "../../types/domain";
import { createStudyLabError } from "../services/study-lab-error.service";
import { assertSessionActiveForMutation } from "./session.policy";

export function normalizeCameraStatus(value: unknown): StudyCameraStatus {
  if (typeof value !== "string" || !STUDY_CAMERA_STATUSES.includes(value as StudyCameraStatus)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.INVALID_CAMERA_STATUS,
      "cameraStatus must be either ON or OFF.",
      { value },
    );
  }

  return value as StudyCameraStatus;
}

export function assertCameraStatusUpdatable(session: StudySession): void {
  assertSessionActiveForMutation(session);
}
