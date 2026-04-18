import { STUDY_LAB_ERROR_CODES } from "../constants/error-codes";
import type { TeacherDashboardFilters } from "../types/domain";
import { createStudyLabError } from "../server/services/study-lab-error.service";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 100;

export function parseTeacherDashboardQuery(searchParams: URLSearchParams): TeacherDashboardFilters {
  const search = optionalTrimmedString(searchParams.get("search"));
  const onlyActive = parseOptionalBoolean(searchParams.get("onlyActive"));
  const page = parsePositiveInteger(searchParams.get("page"), "page", DEFAULT_PAGE);
  const pageSize = parsePositiveInteger(searchParams.get("pageSize"), "pageSize", DEFAULT_PAGE_SIZE);

  return {
    search: search ?? undefined,
    onlyActive: onlyActive ?? false,
    page,
    pageSize,
  };
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw createStudyLabError(
    STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
    "Boolean query params must be true or false.",
    { value },
  );
}

function parsePositiveInteger(
  value: string | null,
  fieldName: string,
  fallback: number,
): number {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      `${fieldName} must be a positive integer.`,
      { value },
    );
  }

  return parsed;
}

function optionalTrimmedString(value: string | null): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
