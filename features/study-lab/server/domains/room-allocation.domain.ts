import { MAIN_STUDY_ROOM_LABEL, QUESTION_ROOM_LABEL } from "../../constants/room-labels";
import type { StudyLabTransaction, StudyRoom } from "../../types/domain";
import type { StudyRoomRepository } from "../repositories/study-room.repository";
import { createNotImplementedStudyLabError } from "../services/study-lab-error.service";

export interface RoomAllocationDomainDependencies {
  studyRoomRepository: StudyRoomRepository;
}

export class RoomAllocationDomain {
  constructor(private readonly deps: RoomAllocationDomainDependencies) {}

  async getMainStudyRoom(options?: { tx?: StudyLabTransaction }): Promise<StudyRoom | null> {
    return this.deps.studyRoomRepository.findActiveMainRoom({ tx: options?.tx });
  }

  async allocateQuestionRoom(tx: StudyLabTransaction): Promise<StudyRoom> {
    const room = await this.deps.studyRoomRepository.findAvailableQuestionRoomForUpdate(tx);

    if (!room) {
      throw createNotImplementedStudyLabError(
        "RoomAllocationDomain.allocateQuestionRoom needs QUESTION_ROOM_UNAVAILABLE handling",
      );
    }

    return room;
  }

  resolveLogicalRoomLabel(room: StudyRoom | null): string {
    if (!room) {
      return MAIN_STUDY_ROOM_LABEL;
    }

    return room.roomType === "QUESTION" ? QUESTION_ROOM_LABEL : MAIN_STUDY_ROOM_LABEL;
  }
}
