import { STUDY_LAB_ERROR_CODES, type StudyLabErrorCode } from "../../constants/error-codes";

export class StudyLabError extends Error {
  readonly code: StudyLabErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: StudyLabErrorCode,
    message: string,
    options?: {
      status?: number;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "StudyLabError";
    this.code = code;
    this.status = options?.status ?? getHttpStatusForStudyLabErrorCode(code);
    this.details = options?.details;

    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function getHttpStatusForStudyLabErrorCode(code: StudyLabErrorCode): number {
  switch (code) {
    case STUDY_LAB_ERROR_CODES.UNAUTHORIZED:
      return 401;
    case STUDY_LAB_ERROR_CODES.FORBIDDEN:
    case STUDY_LAB_ERROR_CODES.FORBIDDEN_ROLE_MAPPING_FAILED:
      return 403;
    case STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND:
    case STUDY_LAB_ERROR_CODES.QUESTION_NOT_FOUND:
      return 404;
    case STUDY_LAB_ERROR_CODES.VALIDATION_ERROR:
    case STUDY_LAB_ERROR_CODES.INVALID_REQUEST:
    case STUDY_LAB_ERROR_CODES.INVALID_SESSION_TRANSITION:
    case STUDY_LAB_ERROR_CODES.INVALID_CONNECTION_STATUS_TRANSITION:
    case STUDY_LAB_ERROR_CODES.INVALID_CAMERA_STATUS:
      return 422;
    case STUDY_LAB_ERROR_CODES.NOT_IMPLEMENTED:
      return 501;
    case STUDY_LAB_ERROR_CODES.INTERNAL_ERROR:
      return 500;
    default:
      return 409;
  }
}

export function createStudyLabError(
  code: StudyLabErrorCode,
  message: string,
  details?: Record<string, unknown>,
): StudyLabError {
  return new StudyLabError(code, message, { details });
}

export function createNotImplementedStudyLabError(feature: string): StudyLabError {
  return new StudyLabError(
    STUDY_LAB_ERROR_CODES.NOT_IMPLEMENTED,
    `${feature} is not wired yet.`,
    { details: { feature } },
  );
}

export function isStudyLabError(value: unknown): value is StudyLabError {
  return value instanceof StudyLabError;
}

export function normalizeStudyLabError(error: unknown): StudyLabError {
  if (isStudyLabError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new StudyLabError(STUDY_LAB_ERROR_CODES.INTERNAL_ERROR, error.message, {
      cause: error,
    });
  }

  return new StudyLabError(STUDY_LAB_ERROR_CODES.INTERNAL_ERROR, "Unexpected error");
}

export function toStudyLabErrorResponse(error: unknown): {
  status: number;
  body: {
    ok: false;
    error: {
      code: StudyLabErrorCode;
      message: string;
      details?: Record<string, unknown>;
    };
  };
} {
  const normalized = normalizeStudyLabError(error);

  return {
    status: normalized.status,
    body: {
      ok: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
      },
    },
  };
}
