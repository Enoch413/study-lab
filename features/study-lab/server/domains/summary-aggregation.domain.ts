import type {
  DailyStudySummary,
  SessionIntervalSlice,
  StudyLabTransaction,
  StudySession,
} from "../../types/domain";
import type {
  DailyStudySummaryRepository,
  UpsertDailyStudySummaryInput,
} from "../repositories/daily-study-summary.repository";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface SummaryAggregationDomainDependencies {
  dailyStudySummaryRepository: DailyStudySummaryRepository;
}

export class SummaryAggregationDomain {
  constructor(private readonly deps: SummaryAggregationDomainDependencies) {}

  splitSessionByKstDate(startedAt: Date, endedAt: Date): SessionIntervalSlice[] {
    if (endedAt <= startedAt) {
      return [];
    }

    const slices: SessionIntervalSlice[] = [];
    let cursor = new Date(startedAt);

    while (cursor < endedAt) {
      const currentKstDate = toKstDateString(cursor);
      const nextBoundary = getNextKstDayBoundaryUtc(cursor);
      const sliceEndedAt = nextBoundary < endedAt ? nextBoundary : endedAt;
      const durationSeconds = Math.max(
        0,
        Math.floor((sliceEndedAt.getTime() - cursor.getTime()) / 1000),
      );

      slices.push({
        summaryDateKst: currentKstDate,
        startedAt: new Date(cursor),
        endedAt: new Date(sliceEndedAt),
        durationSeconds,
      });

      cursor = sliceEndedAt;
    }

    return slices;
  }

  calculateTodayStudySeconds(args: {
    summary: DailyStudySummary | null;
    activeSession: StudySession | null;
    serverNow: Date;
  }): number {
    const storedSeconds = args.summary?.accumulatedSeconds ?? 0;

    if (!args.activeSession || args.activeSession.status !== "ACTIVE") {
      return storedSeconds;
    }

    const todayKstStartUtc = getKstDayStartUtc(args.serverNow);
    const liveStart = args.activeSession.startedAt > todayKstStartUtc
      ? args.activeSession.startedAt
      : todayKstStartUtc;
    const liveSeconds = Math.max(0, Math.floor((args.serverNow.getTime() - liveStart.getTime()) / 1000));

    return storedSeconds + liveSeconds;
  }

  async reconcileClosedSession(
    session: StudySession,
    tx: StudyLabTransaction,
  ): Promise<UpsertDailyStudySummaryInput[]> {
    if (!session.endedAt) {
      return [];
    }

    const slices = this.splitSessionByKstDate(session.startedAt, session.endedAt);
    const reconciledAt = new Date();
    const applied: UpsertDailyStudySummaryInput[] = [];

    for (const slice of slices) {
      const existing = await this.deps.dailyStudySummaryRepository.findByUserIdAndDate(
        session.userId,
        slice.summaryDateKst,
        { tx },
      );

      const input: UpsertDailyStudySummaryInput = {
        userId: session.userId,
        summaryDateKst: slice.summaryDateKst,
        accumulatedSeconds: (existing?.accumulatedSeconds ?? 0) + slice.durationSeconds,
        lastReconciledAt: reconciledAt,
      };

      await this.deps.dailyStudySummaryRepository.upsert(input, tx);
      applied.push(input);
    }

    return applied;
  }
}

function toKstDateString(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getKstDayStartUtc(date: Date): Date {
  const kstShifted = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstShifted.getUTCFullYear();
  const month = kstShifted.getUTCMonth();
  const day = kstShifted.getUTCDate();

  return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS);
}

function getNextKstDayBoundaryUtc(date: Date): Date {
  const dayStartUtc = getKstDayStartUtc(date);
  return new Date(dayStartUtc.getTime() + ONE_DAY_MS);
}
