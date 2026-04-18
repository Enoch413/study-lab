import type {
  PendingQuestionsDto,
  QuestionAcceptResultDto,
  QuestionCompleteResultDto,
  SessionEnterResultDto,
  SessionExitResultDto,
  StudentDashboardDto,
  StudyLabMeDto,
  TeacherDashboardDto,
} from "./dto";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface EnterSessionRequestBody {
  clientInstanceId?: string | null;
  deviceLabel?: string | null;
}

export interface CameraUpdateRequestBody {
  cameraStatus: "ON" | "OFF";
}

export interface CreateQuestionRequestBody {
  studySessionId: string;
  note?: string | null;
}

export interface CompleteQuestionRequestBody {
  reason: string;
}

export interface TeacherDashboardQuery {
  search?: string;
  onlyActive?: string;
  page?: string;
  pageSize?: string;
}

export type StudyLabMeApiResponse = ApiResponse<StudyLabMeDto>;
export type SessionEnterApiResponse = ApiResponse<SessionEnterResultDto>;
export type SessionExitApiResponse = ApiResponse<SessionExitResultDto>;
export type StudentDashboardApiResponse = ApiResponse<StudentDashboardDto>;
export type TeacherDashboardApiResponse = ApiResponse<TeacherDashboardDto>;
export type PendingQuestionsApiResponse = ApiResponse<PendingQuestionsDto>;
export type QuestionAcceptApiResponse = ApiResponse<QuestionAcceptResultDto>;
export type QuestionCompleteApiResponse = ApiResponse<QuestionCompleteResultDto>;
