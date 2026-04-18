import type { StudyLabViewer, TeacherDashboardFilters } from "../../types/domain";
import type { StudyLabMeDto, StudentDashboardDto, TeacherDashboardDto } from "../../types/dto";
import type { DailyStudySummaryRepository } from "../repositories/daily-study-summary.repository";
import type { QuestionRequestRepository } from "../repositories/question-request.repository";
import type { StudySessionRepository } from "../repositories/study-session.repository";
import type { UserRepository } from "../repositories/user.repository";
import { createNotImplementedStudyLabError } from "../services/study-lab-error.service";

export interface DashboardDomainDependencies {
  userRepository: UserRepository;
  studySessionRepository: StudySessionRepository;
  questionRequestRepository: QuestionRequestRepository;
  dailyStudySummaryRepository: DailyStudySummaryRepository;
}

export class DashboardDomain {
  constructor(private readonly deps: DashboardDomainDependencies) {}

  async getStudyLabMe(_viewer: StudyLabViewer): Promise<StudyLabMeDto> {
    // TODO:
    // 1. load active session for viewer
    // 2. load open question if any
    // 3. calculate todayStudySeconds
    // 4. map to StudyLabMeDto
    throw createNotImplementedStudyLabError("DashboardDomain.getStudyLabMe");
  }

  async getStudentDashboard(_viewer: StudyLabViewer): Promise<StudentDashboardDto> {
    // TODO:
    // 1. load active session
    // 2. load recent sessions
    // 3. load open question
    // 4. calculate todayStudySeconds
    // 5. map to StudentDashboardDto
    throw createNotImplementedStudyLabError("DashboardDomain.getStudentDashboard");
  }

  async getTeacherDashboard(
    _viewer: StudyLabViewer,
    _filters: TeacherDashboardFilters,
  ): Promise<TeacherDashboardDto> {
    // TODO:
    // 1. query sessions for dashboard
    // 2. join users
    // 3. load today's summaries
    // 4. load open questions
    // 5. map to TeacherDashboardDto
    throw createNotImplementedStudyLabError("DashboardDomain.getTeacherDashboard");
  }
}
