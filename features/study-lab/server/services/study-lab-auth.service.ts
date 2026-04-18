import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { CodeLabAuthUser, StudyLabMappedRole, StudyLabViewer } from "../../types/domain";
import { toStudyLabViewer } from "../mappers/role.mapper";
import { createStudyLabError } from "./study-lab-error.service";

export interface CodeLabAuthAdapter {
  getCurrentUser(request: Request): Promise<CodeLabAuthUser | null>;
}

export class StudyLabAuthService {
  constructor(private readonly adapter: CodeLabAuthAdapter) {}

  async requireViewer(request: Request): Promise<StudyLabViewer> {
    const user = await this.adapter.getCurrentUser(request);

    if (!user) {
      throw createStudyLabError(STUDY_LAB_ERROR_CODES.UNAUTHORIZED, "Authentication is required.");
    }

    return toStudyLabViewer(user);
  }

  async requireViewerWithRole(
    request: Request,
    allowedRoles: readonly StudyLabMappedRole[],
  ): Promise<StudyLabViewer> {
    const viewer = await this.requireViewer(request);

    if (!allowedRoles.includes(viewer.mappedRole)) {
      throw createStudyLabError(
        STUDY_LAB_ERROR_CODES.FORBIDDEN,
        "You do not have access to this STUDY LAB action.",
        { mappedRole: viewer.mappedRole, allowedRoles: [...allowedRoles] },
      );
    }

    return viewer;
  }
}

export function createPlaceholderCodeLabAuthAdapter(): CodeLabAuthAdapter {
  return {
    async getCurrentUser() {
      // TODO: Replace with the real CODE LAB session resolver.
      return null;
    },
  };
}
