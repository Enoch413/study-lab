import type { StudyLabTransaction, StudyRoom, StudyRoomType } from "../../types/domain";

export interface StudyRoomLookupOptions {
  tx?: StudyLabTransaction;
  forUpdate?: boolean;
}

export interface InternalRoomUsageRow {
  room: StudyRoom;
  activeSessionCount: number;
  activeQuestionRequestId: string | null;
}

export interface StudyRoomRepository {
  findById(roomId: string, options?: StudyRoomLookupOptions): Promise<StudyRoom | null>;
  findByCode(roomCode: string, options?: StudyRoomLookupOptions): Promise<StudyRoom | null>;
  findActiveMainRoom(options?: StudyRoomLookupOptions): Promise<StudyRoom | null>;
  findActiveRoomsByType(roomType: StudyRoomType, options?: StudyRoomLookupOptions): Promise<StudyRoom[]>;

  // Transaction + lock required when allocating a question room.
  findAvailableQuestionRoomForUpdate(tx: StudyLabTransaction): Promise<StudyRoom | null>;

  listInternalRoomUsage(options?: StudyRoomLookupOptions): Promise<InternalRoomUsageRow[]>;
}
