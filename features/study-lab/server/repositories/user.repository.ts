import type { CodeLabAuthUser, StudyLabTransaction } from "../../types/domain";

export interface UserLookupOptions {
  tx?: StudyLabTransaction;
}

export interface UserRepository {
  findById(userId: string, options?: UserLookupOptions): Promise<CodeLabAuthUser | null>;
  findByIds(userIds: string[], options?: UserLookupOptions): Promise<CodeLabAuthUser[]>;
}
