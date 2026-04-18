import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { QuestionRequest } from "../../types/domain";
import { createStudyLabError } from "../services/study-lab-error.service";

export function assertNoOpenQuestion(question: QuestionRequest | null): void {
  if (question && (question.status === "PENDING" || question.status === "ACCEPTED")) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.QUESTION_ALREADY_EXISTS,
      "An open question request already exists for this student.",
      { questionId: question.id, status: question.status },
    );
  }
}

export function assertQuestionBelongsToStudent(question: QuestionRequest, studentUserId: string): void {
  if (question.studentUserId !== studentUserId) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.FORBIDDEN,
      "The question request does not belong to the current student.",
      { questionId: question.id },
    );
  }
}

export function assertQuestionAssignedToTeacher(question: QuestionRequest, teacherUserId: string): void {
  if (question.teacherUserId !== teacherUserId) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.FORBIDDEN,
      "The question request is not assigned to the current teacher.",
      { questionId: question.id, teacherUserId },
    );
  }
}

export function assertPendingQuestion(question: QuestionRequest): void {
  if (question.status !== "PENDING") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.QUESTION_NOT_CANCELABLE,
      "The question request is not in PENDING state.",
      { questionId: question.id, status: question.status },
    );
  }
}

export function assertQuestionCancelable(question: QuestionRequest): void {
  if (question.status !== "PENDING") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.QUESTION_NOT_CANCELABLE,
      "Only pending question requests can be canceled.",
      { questionId: question.id, status: question.status },
    );
  }
}

export function assertQuestionAcceptable(question: QuestionRequest): void {
  if (question.status !== "PENDING") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.QUESTION_ALREADY_ACCEPTED,
      "Only pending question requests can be accepted.",
      { questionId: question.id, status: question.status },
    );
  }
}

export function assertQuestionCompletable(question: QuestionRequest): void {
  if (question.status !== "ACCEPTED") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.QUESTION_NOT_COMPLETABLE,
      "Only accepted question requests can be completed.",
      { questionId: question.id, status: question.status },
    );
  }
}
