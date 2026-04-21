import { NextResponse } from "next/server";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";
import { parseTeacherDashboardQuery } from "@/features/study-lab/validators/dashboard.validator";

export async function GET(request: Request) {
  try {
    const { authService, dashboardDomain } = createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["teacher", "admin"]);
    const filters = parseTeacherDashboardQuery(new URL(request.url).searchParams);
    const data = await dashboardDomain.getTeacherDashboard(viewer, filters);

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
