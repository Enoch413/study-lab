import { STUDY_LAB_ERROR_CODES } from "../../constants/error-codes";
import type { CodeLabAuthUser, StudyLabMappedRole, StudyLabViewer } from "../../types/domain";
import { toStudyLabViewer } from "../mappers/role.mapper";
import type { UserRepository } from "../repositories/user.repository";
import { loadCodeLabProfileByUid, verifyFirebaseBearerToken } from "./firebase-admin-auth.service";
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

export function createHeaderBackedCodeLabAuthAdapter(
  userRepository: UserRepository,
): CodeLabAuthAdapter {
  return {
    async getCurrentUser(request) {
      const verifiedFirebaseUser = await verifyFirebaseBearerToken(
        request.headers.get("authorization"),
      );

      if (verifiedFirebaseUser) {
        const codeLabProfile = await loadCodeLabProfileByUid(verifiedFirebaseUser.firebaseUid);
        const resolvedRole = codeLabProfile?.role ?? verifiedFirebaseUser.role;
        const resolvedAdminScope =
          resolvedRole === "admin"
            ? codeLabProfile?.adminScope ??
              verifiedFirebaseUser.adminScope ??
              "assigned"
            : null;

        return userRepository.upsertFirebaseUser({
          firebaseUid: verifiedFirebaseUser.firebaseUid,
          email: codeLabProfile?.email ?? verifiedFirebaseUser.email,
          name: codeLabProfile?.name ?? verifiedFirebaseUser.name,
          role: resolvedRole,
          adminScope: resolvedAdminScope,
        });
      }

      if (!isStudyLabDevFallbackEnabled()) {
        return null;
      }

      const explicitUserId = request.headers.get("x-study-lab-user-id")?.trim();

      if (explicitUserId) {
        return userRepository.findById(explicitUserId);
      }

      const firebaseUid = request.headers.get("x-study-lab-firebase-uid")?.trim();

      if (firebaseUid) {
        const name =
          decodeHeaderValue(request.headers.get("x-study-lab-user-name")) || "STUDY LAB User";
        const email = request.headers.get("x-study-lab-user-email")?.trim() || null;
        const role = normalizeCodeLabRole(request.headers.get("x-study-lab-role"));
        const adminScope = normalizeAdminScope(request.headers.get("x-study-lab-admin-scope"));

        return userRepository.upsertFirebaseUser({
          firebaseUid,
          email,
          name,
          role,
          adminScope: role === "admin" ? adminScope ?? "assigned" : null,
        });
      }

      return null;
    },
  };
}

function isStudyLabDevFallbackEnabled(): boolean {
  return process.env.STUDY_LAB_ENABLE_DEV_FALLBACK === "true";
}

function decodeHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}

function normalizeCodeLabRole(value: string | null): "student" | "admin" {
  const normalized = value?.trim();

  return normalized === "admin" ? "admin" : "student";
}

function normalizeAdminScope(value: string | null): "assigned" | "all" | null {
  const normalized = value?.trim();

  if (normalized === "assigned" || normalized === "all") {
    return normalized;
  }

  return null;
}
