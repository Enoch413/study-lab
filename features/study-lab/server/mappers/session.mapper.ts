import { MAIN_STUDY_ROOM_LABEL } from "../../constants/room-labels";
import type { StudySession } from "../../types/domain";
import type {
  SessionEnterResultDto,
  SessionExitResultDto,
  SessionSummaryDto,
} from "../../types/dto";

export function toSessionSummaryDto(
  session: StudySession,
  roomLabel: string = MAIN_STUDY_ROOM_LABEL,
): SessionSummaryDto {
  return {
    id: session.id,
    status: session.status,
    connectionStatus: session.connectionStatus,
    roomId: session.currentRoomId,
    roomLabel,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    endReason: session.endReason,
    cameraStatus: session.cameraStatus,
    micPolicy: session.micPolicy,
  };
}

export function toSessionEnterResultDto(
  reused: boolean,
  session: StudySession,
  roomLabel?: string,
): SessionEnterResultDto {
  return {
    reused,
    session: toSessionSummaryDto(session, roomLabel),
  };
}

export function toSessionExitResultDto(
  alreadyEnded: boolean,
  session: StudySession,
  todayStudySeconds: number,
  roomLabel?: string,
): SessionExitResultDto {
  return {
    alreadyEnded,
    session: toSessionSummaryDto(session, roomLabel),
    todayStudySeconds,
  };
}
