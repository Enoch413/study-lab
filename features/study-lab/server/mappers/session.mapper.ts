import { MAIN_STUDY_ROOM_LABEL } from "../../constants/room-labels";
import type { StudySession } from "../../types/domain";
import type {
  QuestionAcceptResultDto,
  QuestionCompleteResultDto,
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

export function toQuestionAcceptResultDto(args: {
  questionId: string;
  status: QuestionAcceptResultDto["question"]["status"];
  teacherUserId: string | null;
  acceptedAt: Date | null;
  questionRoomId: string;
  roomLabel: string;
  studentSession: StudySession;
}): QuestionAcceptResultDto {
  return {
    question: {
      id: args.questionId,
      status: args.status,
      teacherUserId: args.teacherUserId,
      acceptedAt: args.acceptedAt ? args.acceptedAt.toISOString() : null,
      questionRoom: {
        id: args.questionRoomId,
        roomLabel: args.roomLabel,
      },
    },
    studentSession: {
      id: args.studentSession.id,
      connectionStatus: args.studentSession.connectionStatus,
      micPolicy: args.studentSession.micPolicy,
      currentRoomId: args.studentSession.currentRoomId,
    },
  };
}

export function toQuestionCompleteResultDto(args: {
  questionId: string;
  status: QuestionCompleteResultDto["question"]["status"];
  completeReason: string | null;
  endedAt: Date | null;
  autoReturnedAt: Date | null;
  studentSession: StudySession;
}): QuestionCompleteResultDto {
  return {
    question: {
      id: args.questionId,
      status: args.status,
      completeReason: args.completeReason,
      endedAt: args.endedAt ? args.endedAt.toISOString() : null,
      autoReturnedAt: args.autoReturnedAt ? args.autoReturnedAt.toISOString() : null,
    },
    studentSession: {
      id: args.studentSession.id,
      connectionStatus: args.studentSession.connectionStatus,
      micPolicy: args.studentSession.micPolicy,
      currentRoomId: args.studentSession.currentRoomId,
    },
  };
}
