import type { StudyLabViewer, TeacherDashboardFilters } from "../../types/domain";
import type { StudyLabMeDto, StudentDashboardDto, TeacherDashboardDto } from "../../types/dto";
import {
  toStudyLabMeDto,
  toStudentDashboardDto,
  toTeacherDashboardDto,
  toTeacherDashboardItemDto,
} from "../mappers/dashboard.mapper";
import type { DailyStudySummaryRepository } from "../repositories/daily-study-summary.repository";
import type { QuestionRequestRepository } from "../repositories/question-request.repository";
import type { StudySessionRepository } from "../repositories/study-session.repository";
import type { UserRepository } from "../repositories/user.repository";

export interface DashboardDomainDependencies {
  userRepository: UserRepository;
  studySessionRepository: StudySessionRepository;
  questionRequestRepository: QuestionRequestRepository;
  dailyStudySummaryRepository: DailyStudySummaryRepository;
}

export class DashboardDomain {
  constructor(private readonly deps: DashboardDomainDependencies) {}

  async getStudyLabMe(viewer: StudyLabViewer): Promise<StudyLabMeDto> {
    const serverNow = new Date();
    const activeSession = await this.deps.studySessionRepository.findActiveByUserId(viewer.userId);
    const activeQuestion = await this.deps.questionRequestRepository.findOpenByStudentUserId(viewer.userId);
    const todaySummary = await this.deps.dailyStudySummaryRepository.findByUserIdAndDate(
      viewer.userId,
      toKstDateString(serverNow),
    );

    return toStudyLabMeDto({
      viewer,
      activeSession,
      activeQuestion,
      todayStudySeconds: calculateTodayStudySeconds({
        accumulatedSeconds: todaySummary?.accumulatedSeconds ?? 0,
        activeStartedAt: activeSession?.startedAt ?? null,
        serverNow,
      }),
    });
  }

  async getStudentDashboard(viewer: StudyLabViewer): Promise<StudentDashboardDto> {
    const serverNow = new Date();
    const session = await this.deps.studySessionRepository.findActiveByUserId(viewer.userId);
    const question = await this.deps.questionRequestRepository.findOpenByStudentUserId(viewer.userId);
    const recentSessions = await this.deps.studySessionRepository.listRecentByUserId(viewer.userId, 10);
    const activeDashboardRows = await this.deps.studySessionRepository.listForTeacherDashboard({
      page: 1,
      pageSize: 1,
      onlyActive: true,
    });
    const todaySummary = await this.deps.dailyStudySummaryRepository.findByUserIdAndDate(
      viewer.userId,
      toKstDateString(serverNow),
    );

    return toStudentDashboardDto({
      session,
      question,
      recentSessions,
      todayStudySeconds: calculateTodayStudySeconds({
        accumulatedSeconds: todaySummary?.accumulatedSeconds ?? 0,
        activeStartedAt: session?.startedAt ?? null,
        serverNow,
      }),
      activeStudentCount: activeDashboardRows.total,
    });
  }

  async getTeacherDashboard(
    _viewer: StudyLabViewer,
    filters: TeacherDashboardFilters,
  ): Promise<TeacherDashboardDto> {
    const serverNow = new Date();
    const normalizedFilters = {
      search: filters.search,
      onlyActive: filters.onlyActive ?? false,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 100,
    };
    const dashboardRows =
      await this.deps.studySessionRepository.listForTeacherDashboard(normalizedFilters);
    const studentUserIds = dashboardRows.rows.map((row) => row.session.userId);
    const summaries = await this.deps.dailyStudySummaryRepository.findManyByUserIdsAndDate(
      studentUserIds,
      toKstDateString(serverNow),
    );
    const summaryByUserId = new Map(summaries.map((summary) => [summary.userId, summary]));

    const items = await Promise.all(
      dashboardRows.rows.map(async (row) => {
        const question = await this.deps.questionRequestRepository.findOpenByStudentUserId(
          row.session.userId,
        );
        const summary = summaryByUserId.get(row.session.userId);

        return toTeacherDashboardItemDto({
          studentUserId: row.session.userId,
          studentName: row.studentName,
          session: row.session,
          question,
          todayStudySeconds: calculateTodayStudySeconds({
            accumulatedSeconds: summary?.accumulatedSeconds ?? 0,
            activeStartedAt: row.session.startedAt,
            serverNow,
          }),
        });
      }),
    );

    return toTeacherDashboardDto({
      items,
      page: normalizedFilters.page,
      pageSize: normalizedFilters.pageSize,
      total: dashboardRows.total,
      serverNow,
    });
  }
}

function calculateTodayStudySeconds(args: {
  accumulatedSeconds: number;
  activeStartedAt: Date | null;
  serverNow: Date;
}): number {
  if (!args.activeStartedAt) {
    return args.accumulatedSeconds;
  }

  const liveStart =
    args.activeStartedAt > getKstDayStartUtc(args.serverNow)
      ? args.activeStartedAt
      : getKstDayStartUtc(args.serverNow);

  return (
    args.accumulatedSeconds +
    Math.max(0, Math.floor((args.serverNow.getTime() - liveStart.getTime()) / 1000))
  );
}

function toKstDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getKstDayStartUtc(date: Date): Date {
  const kstShifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  return new Date(
    Date.UTC(kstShifted.getUTCFullYear(), kstShifted.getUTCMonth(), kstShifted.getUTCDate()) -
      9 * 60 * 60 * 1000,
  );
}
