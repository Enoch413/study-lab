import { NextResponse } from "next/server";
import { toQuestionAcceptResultDto } from "@/features/study-lab/server/mappers/session.mapper";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseQuestionIdParam } from "@/features/study-lab/validators/question.validator";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { authService, questionDomain } = createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["teacher", "admin"]);
    const { id } = await context.params;
    const questionId = parseQuestionIdParam(id);
    const result = await questionDomain.acceptQuestionRequest({
      viewer,
      questionId,
    });

    return NextResponse.json(
      {
        ok: true,
        data: toQuestionAcceptResultDto({
          questionId: result.question.id,
          status: result.question.status,
          teacherUserId: result.question.teacherUserId,
          acceptedAt: result.question.acceptedAt,
          questionRoomId: result.questionRoom.id,
          roomLabel: result.questionRoom.roomName,
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
