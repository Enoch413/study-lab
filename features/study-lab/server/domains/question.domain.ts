import type {
  CompleteQuestionCommand,
  CreateQuestionCommand,
  QuestionAcceptResult,
  QuestionCommand,
  QuestionCompleteResult,
  StudyLabTransactionRunner,
} from "../../types/domain";
import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { QuestionRequestRepository } from "../repositories/question-request.repository";
import type { StudySessionRepository } from "../repositories/study-session.repository";
import {
  assertNoOpenQuestion,
  assertQuestionCancelable,
  assertPendingQuestion,
  assertQuestionAcceptable,
  assertQuestionBelongsToStudent,
  assertQuestionCompletable,
} from "../policies/question.policy";
import {
  assertCanCreateQuestionFromSession,
  assertSessionActiveForMutation,
  assertSessionOwner,
  assertStudentViewer,
} from "../policies/session.policy";
import {
  createNotImplementedStudyLabError,
  createStudyLabError,
} from "../services/study-lab-error.service";
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
    assertStudentViewer(command.viewer);
    const serverNow = command.serverNow ?? new Date();

    // Transaction boundary required:
    // 1. lock student's ACTIVE session
    // 2. verify MAIN_ROOM
    // 3. lock existing open question
    // 4. insert PENDING question
    // 5. move session connection_status -> QUESTION_PENDING
    // 6. append audit log
    return this.deps.txRunner.runInTransaction(async (tx) => {
      const session = await this.deps.studySessionRepository.findByIdForUpdate(
        command.studySessionId,
        tx,
      );

      if (!session) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND,
          "The study session does not exist.",
          { sessionId: command.studySessionId },
        );
      }

      assertSessionOwner(session, command.viewer.userId);
      assertCanCreateQuestionFromSession(session);

      const openQuestion = await this.deps.questionRequestRepository.findOpenByStudentUserIdForUpdate(
        command.viewer.userId,
        tx,
      );
      assertNoOpenQuestion(openQuestion);

      const question = await this.deps.questionRequestRepository.create(
        {
          studySessionId: session.id,
          studentUserId: command.viewer.userId,
          requestNote: command.note ?? null,
          status: "PENDING",
          requestedAt: serverNow,
        },
        tx,
      );

      await this.deps.studySessionRepository.updateById(
        session.id,
        {
          connectionStatus: "QUESTION_PENDING",
          lastHeartbeatAt: serverNow,
        },
        tx,
      );

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "QUESTION_REQUEST",
          entityId: question.id,
          actorUserId: command.viewer.userId,
          actionType: "QUESTION_CREATED",
          payloadJson: {
            studySessionId: session.id,
          },
          createdAt: serverNow,
        },
        tx,
      );

      return question;
    });
  }

  async cancelQuestionRequest(command: QuestionCommand) {
    assertStudentViewer(command.viewer);
    const serverNow = command.serverNow ?? new Date();

    // Transaction boundary required:
    // 1. lock question row
    // 2. verify owner + PENDING
    // 3. set CANCELED
    // 4. session connection_status -> MAIN_ROOM
    // 5. append audit log
    return this.deps.txRunner.runInTransaction(async (tx) => {
      const question = await this.deps.questionRequestRepository.findByIdForUpdate(
        command.questionId,
        tx,
      );

      if (!question) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.QUESTION_NOT_FOUND,
          "The question request does not exist.",
          { questionId: command.questionId },
        );
      }

      assertQuestionBelongsToStudent(question, command.viewer.userId);
      assertQuestionCancelable(question);

      const updatedQuestion = await this.deps.questionRequestRepository.updateById(
        question.id,
        {
          status: "CANCELED",
          endedAt: serverNow,
          completeReason: "STUDENT_CANCEL",
        },
        tx,
      );

      const session = await this.deps.studySessionRepository.findByIdForUpdate(
        question.studySessionId,
        tx,
      );

      if (session?.status === "ACTIVE") {
        await this.deps.studySessionRepository.updateById(
          session.id,
          {
            connectionStatus: "MAIN_ROOM",
            micPolicy: "MUTED_LOCKED",
            lastHeartbeatAt: serverNow,
          },
          tx,
        );
      }

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "QUESTION_REQUEST",
          entityId: updatedQuestion.id,
          actorUserId: command.viewer.userId,
          actionType: "QUESTION_CANCELED",
          payloadJson: {
            studySessionId: question.studySessionId,
          },
          createdAt: serverNow,
        },
        tx,
      );

      return updatedQuestion;
    });
  }

  async acceptQuestionRequest(command: QuestionCommand): Promise<QuestionAcceptResult> {
    assertTeacherOrAdmin(command.viewer.mappedRole);
    const serverNow = command.serverNow ?? new Date();

    // Transaction boundary required:
    // 1. lock question row
    // 2. ensure PENDING
    // 3. allocate QUESTION room with row lock
    // 4. lock student session
    // 5. move session -> QUESTION_ROOM and mic OPEN
    // 6. set question ACCEPTED
    // 7. append audit log
    return this.deps.txRunner.runInTransaction(async (tx) => {
      const question = await this.deps.questionRequestRepository.findByIdForUpdate(
        command.questionId,
        tx,
      );

      if (!question) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.QUESTION_NOT_FOUND,
          "The question request does not exist.",
          { questionId: command.questionId },
        );
      }

      assertQuestionAcceptable(question);

      const questionRoom = await this.deps.roomAllocationDomain.allocateQuestionRoom(tx);
      const studentSession = await this.deps.studySessionRepository.findByIdForUpdate(
        question.studySessionId,
        tx,
      );

      if (!studentSession) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND,
          "The student session does not exist.",
          { sessionId: question.studySessionId },
        );
      }

      assertSessionActiveForMutation(studentSession);

      if (studentSession.connectionStatus !== "QUESTION_PENDING") {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.STUDENT_NOT_IN_PENDING_STATE,
          "The student is not waiting for a question room.",
          { connectionStatus: studentSession.connectionStatus },
        );
      }

      const updatedSession = await this.deps.studySessionRepository.updateById(
        studentSession.id,
        {
          currentRoomId: questionRoom.id,
          connectionStatus: "QUESTION_ROOM",
          micPolicy: "OPEN",
          lastHeartbeatAt: serverNow,
        },
        tx,
      );

      const updatedQuestion = await this.deps.questionRequestRepository.updateById(
        question.id,
        {
          teacherUserId: command.viewer.userId,
          questionRoomId: questionRoom.id,
          status: "ACCEPTED",
          acceptedAt: serverNow,
        },
        tx,
      );

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "QUESTION_REQUEST",
          entityId: updatedQuestion.id,
          actorUserId: command.viewer.userId,
          actionType: "QUESTION_ACCEPTED",
          payloadJson: {
            studySessionId: updatedSession.id,
            questionRoomId: questionRoom.id,
          },
          createdAt: serverNow,
        },
        tx,
      );

      return {
        question: updatedQuestion,
        studentSession: updatedSession,
        questionRoom,
      };
    });
  }

  async completeQuestionRequest(command: CompleteQuestionCommand): Promise<QuestionCompleteResult> {
    assertTeacherOrAdmin(command.viewer.mappedRole);
    const serverNow = command.serverNow ?? new Date();

    // Transaction boundary required:
    // 1. lock question row
    // 2. ensure ACCEPTED
    // 3. lock student session
    // 4. set question COMPLETED
    // 5. move student session -> MAIN_ROOM and mic MUTED_LOCKED
    // 6. append audit log
    return this.deps.txRunner.runInTransaction(async (tx) => {
      const question = await this.deps.questionRequestRepository.findByIdForUpdate(
        command.questionId,
        tx,
      );

      if (!question) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.QUESTION_NOT_FOUND,
          "The question request does not exist.",
          { questionId: command.questionId },
        );
      }

      assertQuestionCompletable(question);

      const studentSession = await this.deps.studySessionRepository.findByIdForUpdate(
        question.studySessionId,
        tx,
      );

      if (!studentSession) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND,
          "The student session does not exist.",
          { sessionId: question.studySessionId },
        );
      }

      const updatedQuestion = await this.deps.questionRequestRepository.updateById(
        question.id,
        {
          status: "COMPLETED",
          endedAt: serverNow,
          completeReason: command.reason,
          autoReturnedAt: serverNow,
        },
        tx,
      );

      const updatedSession =
        studentSession.status === "ACTIVE"
          ? await this.deps.studySessionRepository.updateById(
              studentSession.id,
              {
                currentRoomId: studentSession.baseRoomId,
                connectionStatus: "MAIN_ROOM",
                micPolicy: "MUTED_LOCKED",
                lastHeartbeatAt: serverNow,
              },
              tx,
            )
          : studentSession;

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "QUESTION_REQUEST",
          entityId: updatedQuestion.id,
          actorUserId: command.viewer.userId,
          actionType: "QUESTION_COMPLETED",
          payloadJson: {
            studySessionId: updatedSession.id,
            completeReason: command.reason,
          },
          createdAt: serverNow,
        },
        tx,
      );

      return {
        question: updatedQuestion,
        studentSession: updatedSession,
      };
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

function assertTeacherOrAdmin(mappedRole: string) {
  if (mappedRole === "teacher" || mappedRole === "admin") {
    return;
  }

  throw createStudyLabError(
    STUDY_LAB_ERROR_CODES.FORBIDDEN,
    "Teacher or admin role is required.",
    { mappedRole },
  );
}
