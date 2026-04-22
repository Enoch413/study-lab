import type {
  CameraUpdateCommand,
  EnterSessionCommand,
  ExitSessionCommand,
  HeartbeatCommand,
  SessionEnterResult,
  SessionExitResult,
  StudyLabTransactionRunner,
  StudySession,
} from "../../types/domain";
import type { StudyRoomRepository } from "../repositories/study-room.repository";
import type { StudySessionRepository } from "../repositories/study-session.repository";
import { assertCameraStatusUpdatable } from "../policies/camera.policy";
import {
  assertSessionActiveForMutation,
  assertSessionMutable,
  assertSessionOwner,
  assertStudentViewer,
} from "../policies/session.policy";
import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import {
  createNotImplementedStudyLabError,
  createStudyLabError,
} from "../services/study-lab-error.service";
import type { AuditLogDomain } from "./audit-log.domain";
import type { SummaryAggregationDomain } from "./summary-aggregation.domain";

export interface SessionDomainDependencies {
  txRunner: StudyLabTransactionRunner;
  studySessionRepository: StudySessionRepository;
  studyRoomRepository: StudyRoomRepository;
  summaryAggregationDomain: SummaryAggregationDomain;
  auditLogDomain: AuditLogDomain;
}

export class SessionDomain {
  constructor(private readonly deps: SessionDomainDependencies) {}

  async enterSession(command: EnterSessionCommand): Promise<SessionEnterResult> {
    assertStudentViewer(command.viewer);
    const serverNow = command.serverNow ?? new Date();

    // Transaction boundary required:
    // 1. lock current ACTIVE session for user
    // 2. return reused session if exists
    // 3. resolve active main room
    // 4. insert new ACTIVE session
    // 5. append audit log
    return this.deps.txRunner.runInTransaction(async (tx) => {
      const existingSession = await this.deps.studySessionRepository.findActiveByUserIdForUpdate(
        command.viewer.userId,
        tx,
      );

      if (existingSession) {
        await this.deps.auditLogDomain.appendAuditLog(
          {
            entityType: "STUDY_SESSION",
            entityId: existingSession.id,
            actorUserId: command.viewer.userId,
            actionType: "SESSION_ENTER_REUSED",
            payloadJson: {
              clientInstanceId: command.clientInstanceId ?? null,
            },
            createdAt: serverNow,
          },
          tx,
        );

        return {
          reused: true,
          session: existingSession,
        };
      }

      const mainRoom = await this.deps.studyRoomRepository.findActiveMainRoom({ tx });

      if (!mainRoom) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.NO_ACTIVE_MAIN_ROOM,
          "No active main study room is available.",
        );
      }

      const session = await this.deps.studySessionRepository.create(
        {
          userId: command.viewer.userId,
          baseRoomId: mainRoom.id,
          currentRoomId: mainRoom.id,
          status: "ACTIVE",
          connectionStatus: "MAIN_ROOM",
          cameraStatus: "ON",
          micPolicy: "MUTED_LOCKED",
          startedAt: serverNow,
          lastHeartbeatAt: serverNow,
          clientInstanceId: command.clientInstanceId ?? null,
        },
        tx,
      );

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "STUDY_SESSION",
          entityId: session.id,
          actorUserId: command.viewer.userId,
          actionType: "SESSION_ENTER",
          payloadJson: {
            baseRoomId: mainRoom.id,
            clientInstanceId: command.clientInstanceId ?? null,
            deviceLabel: command.deviceLabel ?? null,
          },
          createdAt: serverNow,
        },
        tx,
      );

      return {
        reused: false,
        session,
      };
    });
  }

  async exitSession(command: ExitSessionCommand): Promise<SessionExitResult> {
    assertStudentViewer(command.viewer);
    const serverNow = command.serverNow ?? new Date();

    // Transaction boundary required:
    // 1. lock session row
    // 2. verify owner + ACTIVE
    // 3. set EXITED state
    // 4. reconcile summaries
    // 5. append audit log
    return this.deps.txRunner.runInTransaction(async (tx) => {
      const session = await this.deps.studySessionRepository.findByIdForUpdate(command.sessionId, tx);

      if (!session) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND,
          "The study session does not exist.",
          { sessionId: command.sessionId },
        );
      }

      assertSessionOwner(session, command.viewer.userId);

      if (session.status !== "ACTIVE") {
        return {
          alreadyEnded: true,
          session,
          todayStudySeconds: 0,
        };
      }

      const endedSession = await this.deps.studySessionRepository.updateById(
        session.id,
        {
          status: "EXITED",
          connectionStatus: "EXITED",
          endedAt: serverNow,
          endReason: "USER_EXIT",
          lastHeartbeatAt: serverNow,
          micPolicy: "MUTED_LOCKED",
        },
        tx,
      );

      const appliedSummaries = await this.deps.summaryAggregationDomain.reconcileClosedSession(
        endedSession,
        tx,
      );
      const todayStudySeconds =
        appliedSummaries.find((summary) => summary.summaryDateKst === toKstDateString(serverNow))
          ?.accumulatedSeconds ?? 0;

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "STUDY_SESSION",
          entityId: endedSession.id,
          actorUserId: command.viewer.userId,
          actionType: "SESSION_EXIT",
          payloadJson: {
            startedAt: endedSession.startedAt.toISOString(),
            endedAt: serverNow.toISOString(),
          },
          createdAt: serverNow,
        },
        tx,
      );

      return {
        alreadyEnded: false,
        session: endedSession,
        todayStudySeconds,
      };
    });
  }

  async recordHeartbeat(command: HeartbeatCommand): Promise<StudySession> {
    const serverNow = command.serverNow ?? new Date();

    return this.deps.txRunner.runInTransaction(async (tx) => {
      const session = await this.deps.studySessionRepository.findByIdForUpdate(command.sessionId, tx);

      if (!session) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND,
          "The study session does not exist.",
          { sessionId: command.sessionId },
        );
      }

      assertSessionOwner(session, command.viewer.userId);
      assertSessionActiveForMutation(session);

      return this.deps.studySessionRepository.updateById(
        session.id,
        {
          lastHeartbeatAt: serverNow,
        },
        tx,
      );
    });
  }

  async updateCameraStatus(command: CameraUpdateCommand): Promise<StudySession> {
    const serverNow = command.serverNow ?? new Date();

    return this.deps.txRunner.runInTransaction(async (tx) => {
      const session = await this.deps.studySessionRepository.findByIdForUpdate(command.sessionId, tx);

      if (!session) {
        throw createStudyLabError(
          STUDY_LAB_ERROR_CODES.SESSION_NOT_FOUND,
          "The study session does not exist.",
          { sessionId: command.sessionId },
        );
      }

      assertSessionOwner(session, command.viewer.userId);
      assertCameraStatusUpdatable(session);

      const updatedSession = await this.deps.studySessionRepository.updateById(
        session.id,
        {
          cameraStatus: command.cameraStatus,
          lastHeartbeatAt: serverNow,
        },
        tx,
      );

      await this.deps.auditLogDomain.appendAuditLog(
        {
          entityType: "STUDY_SESSION",
          entityId: updatedSession.id,
          actorUserId: command.viewer.userId,
          actionType: "CAMERA_CHANGED",
          payloadJson: {
            cameraStatus: command.cameraStatus,
          },
          createdAt: serverNow,
        },
        tx,
      );

      return updatedSession;
    });
  }

  async getOwnedActiveSessionOrThrow(userId: string, sessionId: string): Promise<StudySession> {
    const session = await this.deps.studySessionRepository.findById(sessionId);

    if (!session) {
      throw createNotImplementedStudyLabError("SessionDomain.getOwnedActiveSessionOrThrow missing SESSION_NOT_FOUND handling");
    }

    assertSessionOwner(session, userId);
    assertSessionMutable(session);
    return session;
  }
}

function toKstDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
