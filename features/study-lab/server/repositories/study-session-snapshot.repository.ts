import type { StudyLabTransaction, StudySessionSnapshot } from "../../types/domain";

export interface StudySessionSnapshotLookupOptions {
  tx?: StudyLabTransaction;
}

export interface UpsertStudySessionSnapshotInput {
  studySessionId: string;
  studentUserId: string;
  imageDataUrl: string;
  capturedAt: Date;
}

export interface StudySessionSnapshotRepository {
  upsert(
    input: UpsertStudySessionSnapshotInput,
    options?: StudySessionSnapshotLookupOptions,
  ): Promise<StudySessionSnapshot>;
  findManyBySessionIds(
    sessionIds: string[],
    options?: StudySessionSnapshotLookupOptions,
  ): Promise<StudySessionSnapshot[]>;
  deleteBySessionId(
    studySessionId: string,
    options?: StudySessionSnapshotLookupOptions,
  ): Promise<void>;
  deleteByStudentUserId(
    studentUserId: string,
    options?: StudySessionSnapshotLookupOptions,
  ): Promise<void>;
}

