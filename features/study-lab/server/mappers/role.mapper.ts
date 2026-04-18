import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { CodeLabAuthUser, StudyLabViewer } from "../../types/domain";
import { createStudyLabError } from "../services/study-lab-error.service";

export function mapStudyLabRole(user: CodeLabAuthUser): StudyLabViewer["mappedRole"] | null {
  if (user.role === "student") {
    return "student";
  }

  if (user.role === "admin" && user.adminScope === "assigned") {
    return "teacher";
  }

  if (user.role === "admin" && user.adminScope === "all") {
    return "admin";
  }

  return null;
}

export function toStudyLabViewer(user: CodeLabAuthUser): StudyLabViewer {
  const mappedRole = mapStudyLabRole(user);

  if (!mappedRole) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.FORBIDDEN_ROLE_MAPPING_FAILED,
      "Unable to map the CODE LAB role to a STUDY LAB role.",
      {
        role: user.role,
        adminScope: user.adminScope ?? null,
      },
    );
  }

  return {
    userId: user.id,
    name: user.name,
    mappedRole,
    codeLabRole: user.role,
    adminScope: user.adminScope ?? null,
  };
}
