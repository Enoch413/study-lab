import { STUDY_LAB_ERROR_CODES } from "../constants/error-codes";
import type { EnterSessionRequestBody } from "../types/api";
import { createStudyLabError } from "../server/services/study-lab-error.service";

export function parseEnterSessionBody(payload: unknown): EnterSessionRequestBody {
  if (payload == null) {
    return {};
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Enter session body must be an object.",
    );
  }

  const body = payload as Record<string, unknown>;
  return {
    clientInstanceId: optionalTrimmedString(body.clientInstanceId),
    deviceLabel: optionalTrimmedString(body.deviceLabel),
  };
}

export function parseSessionIdParam(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "sessionId param is required.",
      { value },
    );
  }

  return value.trim();
}

function optionalTrimmedString(value: unknown): string | null | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Expected a string value.",
      { value },
    );
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
