import type { CodeLabAuthUser, StudyLabTransaction } from "../../types/domain";

export interface UserLookupOptions {
  tx?: StudyLabTransaction;
}

export interface UpsertFirebaseUserInput {
  firebaseUid: string;
  email?: string | null;
  name: string;
  role: string;
  adminScope?: string | null;
}

export interface UserRepository {
  findById(userId: string, options?: UserLookupOptions): Promise<CodeLabAuthUser | null>;
  findByFirebaseUid(firebaseUid: string, options?: UserLookupOptions): Promise<CodeLabAuthUser | null>;
  upsertFirebaseUser(input: UpsertFirebaseUserInput, options?: UserLookupOptions): Promise<CodeLabAuthUser>;
  findByIds(userIds: string[], options?: UserLookupOptions): Promise<CodeLabAuthUser[]>;
}
