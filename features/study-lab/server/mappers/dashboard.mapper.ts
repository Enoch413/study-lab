import { MAIN_STUDY_ROOM_LABEL } from "../../constants/room-labels";
import type {
  QuestionRequest,
  StudyLabViewer,
  StudySession,
} from "../../types/domain";
import type {
  ActiveStudentTileDto,
  PendingQuestionDto,
  StudentDashboardDto,
  StudyLabMeDto,
  TeacherDashboardDto,
  TeacherDashboardItemDto,
} from "../../types/dto";
import { toSessionSummaryDto } from "./session.mapper";

function toQuestionSummary(question: QuestionRequest | null, queuePosition?: number) {
  if (!question) {
    return null;
  }

  return {
    id: question.id,
    status: question.status,
    requestedAt: question.requestedAt.toISOString(),
    acceptedAt: question.acceptedAt ? question.acceptedAt.toISOString() : null,
    endedAt: question.endedAt ? question.endedAt.toISOString() : null,
    completeReason: question.completeReason,
    queuePosition,
  };
}

export function toStudyLabMeDto(args: {
  viewer: StudyLabViewer;
  activeSession: StudySession | null;
  todayStudySeconds: number;
  activeQuestion: QuestionRequest | null;
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
    activeQuestion: toQuestionSummary(args.activeQuestion),
  };
}

export function toStudentDashboardDto(args: {
  session: StudySession | null;
  todayStudySeconds: number;
  activeStudentCount: number;
  activeStudents: ActiveStudentTileDto[];
  question: QuestionRequest | null;
  recentSessions: StudySession[];
}): StudentDashboardDto {
  return {
    session: args.session ? toSessionSummaryDto(args.session, MAIN_STUDY_ROOM_LABEL) : null,
    todayStudySeconds: args.todayStudySeconds,
    activeStudentCount: args.activeStudentCount,
    activeStudents: args.activeStudents,
    question: toQuestionSummary(args.question),
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
  question: QuestionRequest | null;
  roomLabel?: string | null;
}): TeacherDashboardItemDto {
  return {
    studentUserId: args.studentUserId,
    studentName: args.studentName,
    currentStatus: args.session?.connectionStatus ?? "NONE",
    startedAt: args.session?.startedAt.toISOString() ?? null,
    todayStudySeconds: args.todayStudySeconds,
    cameraStatus: args.session?.cameraStatus ?? null,
    questionStatus: args.question?.status ?? "NONE",
    questionId: args.question?.id ?? null,
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

export function toPendingQuestionDto(args: {
  id: string;
  studentUserId: string;
  studentName: string;
  requestedAt: Date;
  queuePosition: number;
}): PendingQuestionDto {
  return {
    id: args.id,
    studentUserId: args.studentUserId,
    studentName: args.studentName,
    requestedAt: args.requestedAt.toISOString(),
    queuePosition: args.queuePosition,
  };
}
