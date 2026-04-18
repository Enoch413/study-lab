import type {
  AuditActionType,
  AuditEntityType,
  AuditLog,
  StudyLabTransaction,
} from "../../types/domain";

export interface CreateAuditLogInput {
  entityType: AuditEntityType;
  entityId: string;
  actorUserId?: string | null;
  actionType: AuditActionType;
  payloadJson?: Record<string, unknown>;
  createdAt?: Date;
}

export interface AuditLogRepository {
  // Use inside transaction when the audit row must commit with the state transition.
  create(input: CreateAuditLogInput, tx?: StudyLabTransaction): Promise<AuditLog>;
}
