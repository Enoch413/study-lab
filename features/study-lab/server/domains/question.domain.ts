import type {
  CompleteQuestionCommand,
  CreateQuestionCommand,
  QuestionAcceptResult,
  QuestionCommand,
  QuestionCompleteResult,
  StudyLabTransactionRunner,
} from "../../types/domain";
import type { QuestionRequestRepository } from "../repositories/question-request.repository";
import type { StudySessionRepository } from "../repositories/study-session.repository";
import {
  assertNoOpenQuestion,
  assertPendingQuestion,
  assertQuestionAcceptable,
  assertQuestionBelongsToStudent,
  assertQuestionCompletable,
} from "../policies/question.policy";
import { createNotImplementedStudyLabError } from "../services/study-lab-error.service";
import type { AuditLogDomain } from "./audit-log.domain";
import type { RoomAllocationDomain } from "./room-allocation.domain";

export interface QuestionDomainDependencies {
  txRunner: StudyLabTransactionRunner;
  questionRequestRepository: QuestionRequestRepository;
  studySessionRepository: StudySessionRepository;
  roomAllocationDomain: RoomAllocationDomain;
  auditLogDomain: AuditLogDomain;
}

export class QuestionDomain {
  constructor(private readonly deps: QuestionDomainDependencies) {}

  async createQuestionRequest(command: CreateQuestionCommand) {
    // Transaction boundary required:
    // 1. lock student's ACTIVE session
    // 2. verify MAIN_ROOM
    // 3. lock existing open question
    // 4. insert PENDING question
    // 5. move session connection_status -> QUESTION_PENDING
    // 6. append audit log
    return this.deps.txRunner.runInTransaction(async () => {
      throw createNotImplementedStudyLabError("QuestionDomain.createQuestionRequest");
    });
  }

  async cancelQuestionRequest(command: QuestionCommand) {
    // Transaction boundary required:
    // 1. lock question row
    // 2. verify owner + PENDING
    // 3. set CANCELED
    // 4. session connection_status -> MAIN_ROOM
    // 5. append audit log
    return this.deps.txRunner.runInTransaction(async () => {
      throw createNotImplementedStudyLabError("QuestionDomain.cancelQuestionRequest");
    });
  }

  async acceptQuestionRequest(command: QuestionCommand): Promise<QuestionAcceptResult> {
    // Transaction boundary required:
    // 1. lock question row
    // 2. ensure PENDING
    // 3. allocate QUESTION room with row lock
    // 4. lock student session
    // 5. move session -> QUESTION_ROOM and mic OPEN
    // 6. set question ACCEPTED
    // 7. append audit log
    return this.deps.txRunner.runInTransaction(async () => {
      throw createNotImplementedStudyLabError("QuestionDomain.acceptQuestionRequest");
    });
  }

  async completeQuestionRequest(command: CompleteQuestionCommand): Promise<QuestionCompleteResult> {
    // Transaction boundary required:
    // 1. lock question row
    // 2. ensure ACCEPTED
    // 3. lock student session
    // 4. set question COMPLETED
    // 5. move student session -> MAIN_ROOM and mic MUTED_LOCKED
    // 6. append audit log
    return this.deps.txRunner.runInTransaction(async () => {
      throw createNotImplementedStudyLabError("QuestionDomain.completeQuestionRequest");
    });
  }

  async assertStudentHasNoOpenQuestion(studentUserId: string) {
    const openQuestion = await this.deps.questionRequestRepository.findOpenByStudentUserId(studentUserId);
    assertNoOpenQuestion(openQuestion);
  }

  async getPendingQuestionForStudentOrThrow(questionId: string, studentUserId: string) {
    const question = await this.deps.questionRequestRepository.findById(questionId);

    if (!question) {
      throw createNotImplementedStudyLabError("QuestionDomain.getPendingQuestionForStudentOrThrow missing QUESTION_NOT_FOUND handling");
    }

    assertQuestionBelongsToStudent(question, studentUserId);
    assertPendingQuestion(question);
    return question;
  }

  async getCompletableQuestionOrThrow(questionId: string) {
    const question = await this.deps.questionRequestRepository.findById(questionId);

    if (!question) {
      throw createNotImplementedStudyLabError("QuestionDomain.getCompletableQuestionOrThrow missing QUESTION_NOT_FOUND handling");
    }

    assertQuestionCompletable(question);
    return question;
  }

  async getAcceptableQuestionOrThrow(questionId: string) {
    const question = await this.deps.questionRequestRepository.findById(questionId);

    if (!question) {
      throw createNotImplementedStudyLabError("QuestionDomain.getAcceptableQuestionOrThrow missing QUESTION_NOT_FOUND handling");
    }

    assertQuestionAcceptable(question);
    return question;
  }
}
