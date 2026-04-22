import type {
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

export interface StudyLabMeDto {
  user: {
    id: string;
    name: string;
    mappedRole: StudyLabMappedRole;
  };
  activeSession: (SessionSummaryDto & { todayStudySeconds: number }) | null;
}

export interface ActiveStudentTileDto {
  userId: string;
  studentName: string;
  connectionStatus: StudyConnectionStatus;
  cameraStatus: StudyCameraStatus;
  snapshotImageSrc: string | null;
  snapshotCapturedAt: string | null;
}

export interface StudentDashboardDto {
  session: SessionSummaryDto | null;
  todayStudySeconds: number;
  totalStudyDays: number;
  totalStudySeconds: number;
  activeStudentCount: number;
  activeStudents: ActiveStudentTileDto[];
  recentSessions: SessionSummaryDto[];
}

export interface TeacherDashboardItemDto {
  studentUserId: string;
  studentName: string;
  currentStatus: StudyConnectionStatus | "NONE";
  startedAt: string | null;
  todayStudySeconds: number;
  cameraStatus: StudyCameraStatus | null;
  roomLabel: string | null;
  snapshotImageSrc: string | null;
  snapshotCapturedAt: string | null;
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

export interface SessionEnterResultDto {
  reused: boolean;
  session: SessionSummaryDto;
}

export interface SessionExitResultDto {
  alreadyEnded: boolean;
  session: SessionSummaryDto;
  todayStudySeconds: number;
}
