import type {
  QuestionRequestStatus,
  StudyCameraStatus,
  StudyConnectionStatus,
  StudyLabMappedRole,
  StudyMicPolicy,
  StudySessionEndReason,
  StudySessionStatus,
} from "../constants/enums";

export interface SessionSummaryDto {
  id: string;
  status: StudySessionStatus;
  connectionStatus: StudyConnectionStatus;
  roomId: string;
  roomLabel: string;
  startedAt: string;
  endedAt: string | null;
  endReason: StudySessionEndReason | null;
  cameraStatus: StudyCameraStatus;
  micPolicy: StudyMicPolicy;
}

export interface QuestionSummaryDto {
  id: string;
  status: QuestionRequestStatus;
  requestedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
  completeReason: string | null;
  queuePosition?: number;
}

export interface StudyLabMeDto {
  user: {
    id: string;
    name: string;
    mappedRole: StudyLabMappedRole;
  };
  activeSession: (SessionSummaryDto & { todayStudySeconds: number }) | null;
  activeQuestion: QuestionSummaryDto | null;
}

export interface StudentDashboardDto {
  session: SessionSummaryDto | null;
  todayStudySeconds: number;
  activeStudentCount: number;
  question: QuestionSummaryDto | null;
  recentSessions: SessionSummaryDto[];
}

export interface TeacherDashboardItemDto {
  studentUserId: string;
  studentName: string;
  currentStatus: StudyConnectionStatus | "NONE";
  startedAt: string | null;
  todayStudySeconds: number;
  cameraStatus: StudyCameraStatus | null;
  questionStatus: QuestionRequestStatus | "NONE";
  questionId: string | null;
  roomLabel: string | null;
}

export interface TeacherDashboardDto {
  items: TeacherDashboardItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  serverNow: string;
}

export interface PendingQuestionDto {
  id: string;
  studentUserId: string;
  studentName: string;
  requestedAt: string;
  queuePosition: number;
}

export interface PendingQuestionsDto {
  items: PendingQuestionDto[];
}

export interface SessionEnterResultDto {
  reused: boolean;
  session: SessionSummaryDto;
}

export interface SessionExitResultDto {
  alreadyEnded: boolean;
  session: SessionSummaryDto;
  todayStudySeconds: number;
}

export interface QuestionAcceptResultDto {
  question: {
    id: string;
    status: QuestionRequestStatus;
    teacherUserId: string | null;
    acceptedAt: string | null;
    questionRoom: {
      id: string;
      roomLabel: string;
    };
  };
  studentSession: Pick<SessionSummaryDto, "id" | "connectionStatus" | "micPolicy"> & {
    currentRoomId: string;
  };
}

export interface QuestionCompleteResultDto {
  question: {
    id: string;
    status: QuestionRequestStatus;
    completeReason: string | null;
    endedAt: string | null;
    autoReturnedAt: string | null;
  };
  studentSession: Pick<SessionSummaryDto, "id" | "connectionStatus" | "micPolicy"> & {
    currentRoomId: string;
  };
}
