import type { CreateAuditLogInput } from "../repositories/audit-log.repository";
import type { AuditLogRepository } from "../repositories/audit-log.repository";

export interface AuditLogDomainDependencies {
  auditLogRepository: AuditLogRepository;
}

export class AuditLogDomain {
  constructor(private readonly deps: AuditLogDomainDependencies) {}

  async appendAuditLog(input: CreateAuditLogInput) {
    return this.deps.auditLogRepository.create(input);
  }
}
