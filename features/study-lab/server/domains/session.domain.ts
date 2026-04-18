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
  assertCanCreateQuestionFromSession,
  assertSessionActiveForMutation,
  assertSessionMutable,
  assertSessionOwner,
  assertStudentViewer,
} from "../policies/session.policy";
import { createNotImplementedStudyLabError } from "../services/study-lab-error.service";
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

    // Transaction boundary required:
    // 1. lock current ACTIVE session for user
    // 2. return reused session if exists
    // 3. resolve active main room
    // 4. insert new ACTIVE session
    // 5. append audit log
    return this.deps.txRunner.runInTransaction(async () => {
      throw createNotImplementedStudyLabError("SessionDomain.enterSession");
    });
  }

  async exitSession(command: ExitSessionCommand): Promise<SessionExitResult> {
    assertStudentViewer(command.viewer);

    // Transaction boundary required:
    // 1. lock session row
    // 2. verify owner + ACTIVE
    // 3. close open question if needed
    // 4. set EXITED state
    // 5. reconcile summaries
    // 6. append audit log
    return this.deps.txRunner.runInTransaction(async () => {
      throw createNotImplementedStudyLabError("SessionDomain.exitSession");
    });
  }

  async recordHeartbeat(command: HeartbeatCommand): Promise<StudySession> {
    const session = await this.deps.studySessionRepository.findById(command.sessionId);

    if (!session) {
      throw createNotImplementedStudyLabError("SessionDomain.recordHeartbeat missing SESSION_NOT_FOUND handling");
    }

    assertSessionOwner(session, command.viewer.userId);
    assertSessionActiveForMutation(session);

    // TODO: update last_heartbeat_at with server time and append optional audit log.
    throw createNotImplementedStudyLabError("SessionDomain.recordHeartbeat");
  }

  async updateCameraStatus(command: CameraUpdateCommand): Promise<StudySession> {
    const session = await this.deps.studySessionRepository.findById(command.sessionId);

    if (!session) {
      throw createNotImplementedStudyLabError("SessionDomain.updateCameraStatus missing SESSION_NOT_FOUND handling");
    }

    assertSessionOwner(session, command.viewer.userId);
    assertCameraStatusUpdatable(session);

    // TODO: persist camera status + append audit log in a transaction.
    throw createNotImplementedStudyLabError("SessionDomain.updateCameraStatus");
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

  assertCanCreateQuestionFromSession(session: StudySession): void {
    assertCanCreateQuestionFromSession(session);
  }
}
