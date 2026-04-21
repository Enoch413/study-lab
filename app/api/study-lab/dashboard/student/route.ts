import { NextResponse } from "next/server";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";

export async function GET(request: Request) {
  try {
    const { authService, dashboardDomain } = createStudyLabRuntime();

    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const data = await dashboardDomain.getStudentDashboard(viewer);

    return NextResponse.json(
      {
        ok: true,
        data,
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
