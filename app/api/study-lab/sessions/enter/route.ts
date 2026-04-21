import { NextResponse } from "next/server";
import { toSessionEnterResultDto } from "@/features/study-lab/server/mappers/session.mapper";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseEnterSessionBody } from "@/features/study-lab/validators/session.validator";

export async function POST(request: Request) {
  try {
    const { authService, sessionDomain } = createStudyLabRuntime();

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
