import { NextResponse } from "next/server";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { parseCreateQuestionBody } from "@/features/study-lab/validators/question.validator";

export async function POST(request: Request) {
  try {
    const { authService, questionDomain } = createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const body = parseCreateQuestionBody(await request.json());
    const question = await questionDomain.createQuestionRequest({
      viewer,
      studySessionId: body.studySessionId,
      note: body.note,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          question: {
            id: question.id,
            status: question.status,
            requestedAt: question.requestedAt.toISOString(),
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
