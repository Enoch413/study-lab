import { MAIN_STUDY_ROOM_LABEL } from "../../constants/room-labels";
import type { StudyLabViewer, StudySession } from "../../types/domain";
import type {
  ActiveStudentTileDto,
  StudentDashboardDto,
  StudyLabMeDto,
  TeacherDashboardDto,
  TeacherDashboardItemDto,
} from "../../types/dto";
import { toSessionSummaryDto } from "./session.mapper";

export function toStudyLabMeDto(args: {
  viewer: StudyLabViewer;
  activeSession: StudySession | null;
  todayStudySeconds: number;
}): StudyLabMeDto {
  return {
    user: {
      id: args.viewer.userId,
      name: args.viewer.name,
      mappedRole: args.viewer.mappedRole,
    },
    activeSession: args.activeSession
      ? {
          ...toSessionSummaryDto(args.activeSession, MAIN_STUDY_ROOM_LABEL),
          todayStudySeconds: args.todayStudySeconds,
        }
      : null,
  };
}

export function toStudentDashboardDto(args: {
  session: StudySession | null;
  todayStudySeconds: number;
  totalStudyDays: number;
  totalStudySeconds: number;
  activeStudentCount: number;
  activeStudents: ActiveStudentTileDto[];
  recentSessions: StudySession[];
}): StudentDashboardDto {
  return {
    session: args.session ? toSessionSummaryDto(args.session, MAIN_STUDY_ROOM_LABEL) : null,
    todayStudySeconds: args.todayStudySeconds,
    totalStudyDays: args.totalStudyDays,
    totalStudySeconds: args.totalStudySeconds,
    activeStudentCount: args.activeStudentCount,
    activeStudents: args.activeStudents,
    recentSessions: args.recentSessions.map((session) =>
      toSessionSummaryDto(session, MAIN_STUDY_ROOM_LABEL),
    ),
  };
}

export function toTeacherDashboardItemDto(args: {
  studentUserId: string;
  studentName: string;
  session: StudySession | null;
  todayStudySeconds: number;
  roomLabel?: string | null;
}): TeacherDashboardItemDto {
  return {
    studentUserId: args.studentUserId,
    studentName: args.studentName,
    currentStatus: args.session?.connectionStatus ?? "NONE",
    startedAt: args.session?.startedAt.toISOString() ?? null,
    todayStudySeconds: args.todayStudySeconds,
    cameraStatus: args.session?.cameraStatus ?? null,
    roomLabel: args.roomLabel ?? (args.session ? MAIN_STUDY_ROOM_LABEL : null),
  };
}

export function toTeacherDashboardDto(args: {
  items: TeacherDashboardItemDto[];
  page: number;
  pageSize: number;
  total: number;
  serverNow: Date;
}): TeacherDashboardDto {
  return {
    items: args.items,
    pagination: {
      page: args.page,
      pageSize: args.pageSize,
      total: args.total,
    },
    serverNow: args.serverNow.toISOString(),
  };
}
