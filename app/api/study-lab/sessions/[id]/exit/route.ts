import { NextResponse } from "next/server";
import {
  AuditLogDomain,
  type AuditLogDomainDependencies,
} from "@/features/study-lab/server/domains/audit-log.domain";
import {
  SessionDomain,
  type SessionDomainDependencies,
} from "@/features/study-lab/server/domains/session.domain";
import {
  SummaryAggregationDomain,
  type SummaryAggregationDomainDependencies,
} from "@/features/study-lab/server/domains/summary-aggregation.domain";
import { toSessionExitResultDto } from "@/features/study-lab/server/mappers/session.mapper";
import {
  StudyLabAuthService,
  createPlaceholderCodeLabAuthAdapter,
} from "@/features/study-lab/server/services/study-lab-auth.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseSessionIdParam } from "@/features/study-lab/validators/session.validator";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const authService = getAuthService();
    const sessionDomain = getSessionDomain();

    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const { id } = await context.params;
    const sessionId = parseSessionIdParam(id);

    const result = await sessionDomain.exitSession({
      viewer,
      sessionId,
    });

    return NextResponse.json(
      {
        ok: true,
        data: toSessionExitResultDto(result.alreadyEnded, result.session, result.todayStudySeconds),
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

function getAuthService(): StudyLabAuthService {
  return new StudyLabAuthService(createPlaceholderCodeLabAuthAdapter());
}

function getSessionDomain(): SessionDomain {
  const summaryAggregationDomain = new SummaryAggregationDomain(
    {} as SummaryAggregationDomainDependencies,
  );
  const auditLogDomain = new AuditLogDomain({} as AuditLogDomainDependencies);

  return new SessionDomain({
    txRunner: {
      async runInTransaction(callback) {
        return callback({ kind: "study-lab-transaction" });
      },
    },
    studySessionRepository: {} as SessionDomainDependencies["studySessionRepository"],
    studyRoomRepository: {} as SessionDomainDependencies["studyRoomRepository"],
    summaryAggregationDomain,
    auditLogDomain,
  });
}
