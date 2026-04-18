import type {
  QuestionCompleteReason,
  QuestionRequest,
  QuestionRequestStatus,
  StudyLabTransaction,
} from "../../types/domain";

export interface QuestionRequestLookupOptions {
  tx?: StudyLabTransaction;
  forUpdate?: boolean;
}

export interface CreateQuestionRequestInput {
  studySessionId: string;
  studentUserId: string;
  requestNote?: string | null;
  status: QuestionRequestStatus;
  requestedAt: Date;
}

export interface UpdateQuestionRequestPatch {
  teacherUserId?: string | null;
  questionRoomId?: string | null;
  status?: QuestionRequestStatus;
  acceptedAt?: Date | null;
  endedAt?: Date | null;
  completeReason?: QuestionCompleteReason | null;
  autoReturnedAt?: Date | null;
}

export interface PendingQuestionQueueRow {
  question: QuestionRequest;
  studentName: string;
  queuePosition: number;
}

export interface QuestionRequestRepository {
  findById(questionId: string, options?: QuestionRequestLookupOptions): Promise<QuestionRequest | null>;
  findOpenByStudentUserId(
    studentUserId: string,
    options?: QuestionRequestLookupOptions,
  ): Promise<QuestionRequest | null>;

  // Transaction + lock required for create/cancel/accept race handling.
  findByIdForUpdate(questionId: string, tx: StudyLabTransaction): Promise<QuestionRequest | null>;
  findOpenByStudentUserIdForUpdate(
    studentUserId: string,
    tx: StudyLabTransaction,
  ): Promise<QuestionRequest | null>;

  create(input: CreateQuestionRequestInput, tx: StudyLabTransaction): Promise<QuestionRequest>;
  updateById(questionId: string, patch: UpdateQuestionRequestPatch, tx: StudyLabTransaction): Promise<QuestionRequest>;
  listPending(limit: number, options?: QuestionRequestLookupOptions): Promise<PendingQuestionQueueRow[]>;
  findAcceptedByQuestionRoomId(
    questionRoomId: string,
    options?: QuestionRequestLookupOptions,
  ): Promise<QuestionRequest | null>;
}
