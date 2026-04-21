import { NextResponse } from "next/server";
import { toSessionSummaryDto } from "@/features/study-lab/server/mappers/session.mapper";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseSessionIdParam } from "@/features/study-lab/validators/session.validator";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { authService, sessionDomain } = createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const { id } = await context.params;
    const sessionId = parseSessionIdParam(id);
    const session = await sessionDomain.recordHeartbeat({
      viewer,
      sessionId,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          session: toSessionSummaryDto(session),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
