import { PgStudyLabTransactionRunner } from "@/lib/db/transaction";
import { AuditLogDomain } from "../domains/audit-log.domain";
import { DashboardDomain } from "../domains/dashboard.domain";
import { SessionDomain } from "../domains/session.domain";
import { SummaryAggregationDomain } from "../domains/summary-aggregation.domain";
import {
  PgAuditLogRepository,
  PgDailyStudySummaryRepository,
  PgStudyRoomRepository,
  PgStudySessionRepository,
  PgStudySessionSnapshotRepository,
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
  const studySessionSnapshotRepository = new PgStudySessionSnapshotRepository();
  const dailyStudySummaryRepository = new PgDailyStudySummaryRepository();
  const auditLogRepository = new PgAuditLogRepository();
  const auditLogDomain = new AuditLogDomain({ auditLogRepository });
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
      studySessionSnapshotRepository,
      dailyStudySummaryRepository,
    }),
    studySessionSnapshotRepository,
    sessionDomain: new SessionDomain({
      txRunner,
      studySessionRepository,
      studySessionSnapshotRepository,
      studyRoomRepository,
      summaryAggregationDomain,
      auditLogDomain,
    }),
  };
}
