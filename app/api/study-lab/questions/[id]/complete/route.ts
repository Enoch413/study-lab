import { NextResponse } from "next/server";
import { toQuestionCompleteResultDto } from "@/features/study-lab/server/mappers/session.mapper";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import {
  parseCompleteQuestionBody,
  parseQuestionIdParam,
} from "@/features/study-lab/validators/question.validator";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { authService, questionDomain } = createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["teacher", "admin"]);
    const { id } = await context.params;
    const questionId = parseQuestionIdParam(id);
    const body = parseCompleteQuestionBody(await request.json());
    const result = await questionDomain.completeQuestionRequest({
      viewer,
      questionId,
      reason: body.reason,
    });

    return NextResponse.json(
      {
        ok: true,
        data: toQuestionCompleteResultDto({
          questionId: result.question.id,
          status: result.question.status,
          completeReason: result.question.completeReason,
          endedAt: result.question.endedAt,
          autoReturnedAt: result.question.autoReturnedAt,
          studentSession: result.studentSession,
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
