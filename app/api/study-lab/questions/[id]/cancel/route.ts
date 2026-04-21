import { NextResponse } from "next/server";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseQuestionIdParam } from "@/features/study-lab/validators/question.validator";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { authService, questionDomain } = createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const { id } = await context.params;
    const questionId = parseQuestionIdParam(id);
    const question = await questionDomain.cancelQuestionRequest({
      viewer,
      questionId,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          question: {
            id: question.id,
            status: question.status,
            endedAt: question.endedAt?.toISOString() ?? null,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
