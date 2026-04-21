import { PgStudyLabTransactionRunner } from "@/lib/db/transaction";
import { AuditLogDomain } from "../domains/audit-log.domain";
import { DashboardDomain } from "../domains/dashboard.domain";
import { QuestionDomain } from "../domains/question.domain";
import { RoomAllocationDomain } from "../domains/room-allocation.domain";
import { SessionDomain } from "../domains/session.domain";
import { SummaryAggregationDomain } from "../domains/summary-aggregation.domain";
import {
  PgAuditLogRepository,
  PgDailyStudySummaryRepository,
  PgQuestionRequestRepository,
  PgStudyRoomRepository,
  PgStudySessionRepository,
  PgUserRepository,
} from "../repositories/postgres-study-lab.repositories";
import {
  createHeaderBackedCodeLabAuthAdapter,
  StudyLabAuthService,
} from "./study-lab-auth.service";

export function createStudyLabRuntime() {
  const txRunner = new PgStudyLabTransactionRunner();
  const userRepository = new PgUserRepository();
  const studyRoomRepository = new PgStudyRoomRepository();
  const studySessionRepository = new PgStudySessionRepository();
  const questionRequestRepository = new PgQuestionRequestRepository();
  const dailyStudySummaryRepository = new PgDailyStudySummaryRepository();
  const auditLogRepository = new PgAuditLogRepository();
  const auditLogDomain = new AuditLogDomain({ auditLogRepository });
  const roomAllocationDomain = new RoomAllocationDomain({ studyRoomRepository });
  const summaryAggregationDomain = new SummaryAggregationDomain({
    dailyStudySummaryRepository,
  });

  return {
    authService: new StudyLabAuthService(
      createHeaderBackedCodeLabAuthAdapter(userRepository),
    ),
    dashboardDomain: new DashboardDomain({
      userRepository,
      studySessionRepository,
      questionRequestRepository,
      dailyStudySummaryRepository,
    }),
    questionDomain: new QuestionDomain({
      txRunner,
      questionRequestRepository,
      studySessionRepository,
      roomAllocationDomain,
      auditLogDomain,
    }),
    questionRequestRepository,
    sessionDomain: new SessionDomain({
      txRunner,
      studySessionRepository,
      studyRoomRepository,
      summaryAggregationDomain,
      auditLogDomain,
    }),
  };
}
