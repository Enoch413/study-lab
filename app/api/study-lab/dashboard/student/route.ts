import { NextResponse } from "next/server";
import { DashboardDomain, type DashboardDomainDependencies } from "@/features/study-lab/server/domains/dashboard.domain";
import {
  StudyLabAuthService,
  createPlaceholderCodeLabAuthAdapter,
} from "@/features/study-lab/server/services/study-lab-auth.service";
import { toStudyLabErrorResponse } from "@/features/study-lab/server/services/study-lab-error.service";

export async function GET(request: Request) {
  try {
    const authService = getAuthService();
    const dashboardDomain = getDashboardDomain();

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

function getAuthService(): StudyLabAuthService {
  return new StudyLabAuthService(createPlaceholderCodeLabAuthAdapter());
}

function getDashboardDomain(): DashboardDomain {
  // TODO: Replace placeholder dependencies with concrete repository implementations.
  return new DashboardDomain({} as DashboardDomainDependencies);
}
