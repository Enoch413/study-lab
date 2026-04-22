import type {
  StudyLabViewer,
  StudySession,
  StudySessionSnapshot,
  TeacherDashboardFilters,
} from "../../types/domain";
import type { StudyLabMeDto, StudentDashboardDto, TeacherDashboardDto } from "../../types/dto";
import {
  toStudyLabMeDto,
  toStudentDashboardDto,
  toTeacherDashboardDto,
  toTeacherDashboardItemDto,
} from "../mappers/dashboard.mapper";
import type { DailyStudySummaryRepository } from "../repositories/daily-study-summary.repository";
import type { StudySessionRepository } from "../repositories/study-session.repository";
import type { StudySessionSnapshotRepository } from "../repositories/study-session-snapshot.repository";
import type { UserRepository } from "../repositories/user.repository";

export interface DashboardDomainDependencies {
  userRepository: UserRepository;
  studySessionRepository: StudySessionRepository;
  studySessionSnapshotRepository: StudySessionSnapshotRepository;
  dailyStudySummaryRepository: DailyStudySummaryRepository;
}

const SNAPSHOT_VISIBLE_WINDOW_MS = 35_000;

export class DashboardDomain {
  constructor(private readonly deps: DashboardDomainDependencies) {}

  async getStudyLabMe(viewer: StudyLabViewer): Promise<StudyLabMeDto> {
    const serverNow = new Date();
    const activeSession = await this.deps.studySessionRepository.findActiveByUserId(viewer.userId);
    const todaySummary = await this.deps.dailyStudySummaryRepository.findByUserIdAndDate(
      viewer.userId,
      toKstDateString(serverNow),
    );

    return toStudyLabMeDto({
      viewer,
      activeSession,
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
    const recentSessions = await this.deps.studySessionRepository.listRecentByUserId(viewer.userId, 10);
    const activeDashboardRows = await this.deps.studySessionRepository.listForTeacherDashboard({
      page: 1,
      pageSize: 12,
      onlyActive: true,
    });
    const todaySummary = await this.deps.dailyStudySummaryRepository.findByUserIdAndDate(
      viewer.userId,
      toKstDateString(serverNow),
    );
    const totalSummary = await this.deps.dailyStudySummaryRepository.findTotalsByUserId(
      viewer.userId,
    );
    const snapshots = await this.deps.studySessionSnapshotRepository.findManyBySessionIds(
      activeDashboardRows.rows.map((row) => row.session.id),
    );
    const snapshotBySessionId = new Map(
      snapshots.map((snapshot) => [snapshot.studySessionId, snapshot]),
    );

    return toStudentDashboardDto({
      session,
      recentSessions,
      todayStudySeconds: calculateTodayStudySeconds({
        accumulatedSeconds: todaySummary?.accumulatedSeconds ?? 0,
        activeStartedAt: session?.startedAt ?? null,
        serverNow,
      }),
      totalStudyDays: totalSummary.totalStudyDays,
      totalStudySeconds: totalSummary.totalStudySeconds,
      activeStudentCount: activeDashboardRows.total,
      activeStudents: activeDashboardRows.rows
        .filter((row) => row.session.userId !== viewer.userId)
        .map((row) => {
          const snapshot = resolveVisibleSnapshot(
            row.session,
            snapshotBySessionId.get(row.session.id) ?? null,
            serverNow,
          );

          return {
            userId: row.session.userId,
            studentName: row.studentName,
            connectionStatus: row.session.connectionStatus,
            cameraStatus: row.session.cameraStatus,
            snapshotImageSrc: snapshot?.imageDataUrl ?? null,
            snapshotCapturedAt: snapshot?.capturedAt.toISOString() ?? null,
          };
        }),
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
    const snapshots = await this.deps.studySessionSnapshotRepository.findManyBySessionIds(
      dashboardRows.rows.map((row) => row.session.id),
    );
    const summaries = await this.deps.dailyStudySummaryRepository.findManyByUserIdsAndDate(
      studentUserIds,
      toKstDateString(serverNow),
    );
    const summaryByUserId = new Map(summaries.map((summary) => [summary.userId, summary]));
    const snapshotBySessionId = new Map(
      snapshots.map((snapshot) => [snapshot.studySessionId, snapshot]),
    );

    const items = dashboardRows.rows.map((row) => {
      const summary = summaryByUserId.get(row.session.userId);
      const snapshot = resolveVisibleSnapshot(
        row.session,
        snapshotBySessionId.get(row.session.id) ?? null,
        serverNow,
      );

      return toTeacherDashboardItemDto({
        studentUserId: row.session.userId,
        studentName: row.studentName,
        session: row.session,
        todayStudySeconds: calculateTodayStudySeconds({
          accumulatedSeconds: summary?.accumulatedSeconds ?? 0,
          activeStartedAt: row.session.startedAt,
          serverNow,
        }),
        snapshotImageSrc: snapshot?.imageDataUrl ?? null,
        snapshotCapturedAt: snapshot?.capturedAt.toISOString() ?? null,
      });
    });

    return toTeacherDashboardDto({
      items,
      page: normalizedFilters.page,
      pageSize: normalizedFilters.pageSize,
      total: dashboardRows.total,
      serverNow,
    });
  }
}

function resolveVisibleSnapshot(
  session: StudySession,
  snapshot: StudySessionSnapshot | null,
  serverNow: Date,
): StudySessionSnapshot | null {
  if (session.cameraStatus !== "ON" || !snapshot) {
    return null;
  }

  if (serverNow.getTime() - snapshot.capturedAt.getTime() > SNAPSHOT_VISIBLE_WINDOW_MS) {
    return null;
  }

  return snapshot;
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
