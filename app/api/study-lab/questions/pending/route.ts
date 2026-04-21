import { NextResponse } from "next/server";
import { toPendingQuestionDto } from "@/features/study-lab/server/mappers/dashboard.mapper";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";

export async function GET(request: Request) {
  try {
    const { authService, questionRequestRepository } = createStudyLabRuntime();
    await authService.requireViewerWithRole(request, ["teacher", "admin"]);
    const pendingRows = await questionRequestRepository.listPending(100);

    return NextResponse.json(
      {
        ok: true,
        data: {
          items: pendingRows.map((row) =>
            toPendingQuestionDto({
              id: row.question.id,
              studentUserId: row.question.studentUserId,
              studentName: row.studentName,
              requestedAt: row.question.requestedAt,
              queuePosition: row.queuePosition,
            }),
          ),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
