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
import { toSessionEnterResultDto } from "@/features/study-lab/server/mappers/session.mapper";
import {
  StudyLabAuthService,
  createPlaceholderCodeLabAuthAdapter,
} from "@/features/study-lab/server/services/study-lab-auth.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseEnterSessionBody } from "@/features/study-lab/validators/session.validator";

export async function POST(request: Request) {
  try {
    const authService = getAuthService();
    const sessionDomain = getSessionDomain();

    const viewer = await authService.requireViewerWithRole(request, ["student"]);

    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    const body = parseEnterSessionBody(payload);
    const result = await sessionDomain.enterSession({
      viewer,
      clientInstanceId: body.clientInstanceId ?? null,
      deviceLabel: body.deviceLabel ?? null,
    });

    return NextResponse.json(
      {
        ok: true,
        data: toSessionEnterResultDto(result.reused, result.session),
      },
      { status: result.reused ? 200 : 201 },
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
