import { QUESTION_COMPLETE_REASONS } from "../constants/enums";
import { STUDY_LAB_ERROR_CODES } from "../constants/error-codes";
import type { QuestionCompleteReason } from "../types/domain";
import type { CompleteQuestionRequestBody, CreateQuestionRequestBody } from "../types/api";
import { createStudyLabError } from "../server/services/study-lab-error.service";

export function parseCreateQuestionBody(payload: unknown): CreateQuestionRequestBody {
  if (typeof payload !== "object" || payload == null || Array.isArray(payload)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Question request body must be an object.",
    );
  }

  const body = payload as Record<string, unknown>;
  const studySessionId = stringField(body.studySessionId, "studySessionId");
  const note = optionalTrimmedString(body.note);

  return { studySessionId, note };
}

export function parseCompleteQuestionBody(payload: unknown): CompleteQuestionRequestBody {
  if (typeof payload !== "object" || payload == null || Array.isArray(payload)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Question complete body must be an object.",
    );
  }

  const body = payload as Record<string, unknown>;
  const reason = stringField(body.reason, "reason");

  if (!QUESTION_COMPLETE_REASONS.includes(reason as (typeof QUESTION_COMPLETE_REASONS)[number])) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Invalid question complete reason.",
      { reason },
    );
  }

  return { reason: reason as QuestionCompleteReason };
}

export function parseQuestionIdParam(value: unknown): string {
  return stringField(value, "questionId");
}

function stringField(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} is required.`,
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
