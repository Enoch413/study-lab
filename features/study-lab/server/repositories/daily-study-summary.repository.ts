import type { DailyStudySummary, StudyLabTransaction } from "../../types/domain";

export interface DailyStudySummaryLookupOptions {
  tx?: StudyLabTransaction;
}

export interface UpsertDailyStudySummaryInput {
  userId: string;
  summaryDateKst: string;
  accumulatedSeconds: number;
  lastReconciledAt: Date;
}

export interface DailyStudySummaryTotals {
  totalStudyDays: number;
  totalStudySeconds: number;
}

export interface DailyStudySummaryRepository {
  findByUserIdAndDate(
    userId: string,
    summaryDateKst: string,
    options?: DailyStudySummaryLookupOptions,
  ): Promise<DailyStudySummary | null>;
  findManyByUserIdsAndDate(
    userIds: string[],
    summaryDateKst: string,
    options?: DailyStudySummaryLookupOptions,
  ): Promise<DailyStudySummary[]>;
  findTotalsByUserId(
    userId: string,
    options?: DailyStudySummaryLookupOptions,
  ): Promise<DailyStudySummaryTotals>;

  // Use inside transaction when session completion and summary reconciliation must commit together.
  upsert(input: UpsertDailyStudySummaryInput, tx: StudyLabTransaction): Promise<DailyStudySummary>;
}
