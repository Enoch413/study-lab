import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const FIREBASE_APP_NAME = "study-lab-auth";

export interface VerifiedFirebaseUser {
  firebaseUid: string;
  email: string | null;
  name: string;
  role: "student" | "admin";
  adminScope: "assigned" | "all" | null;
}

export interface VerifiedCodeLabProfile {
  firebaseUid: string;
  email: string | null;
  name: string | null;
  role: "student" | "admin" | null;
  adminScope: "assigned" | "all" | null;
}

export async function verifyFirebaseBearerToken(
  authorizationHeader: string | null,
): Promise<VerifiedFirebaseUser | null> {
  const idToken = parseBearerToken(authorizationHeader);

  if (!idToken) {
    return null;
  }

  const app = getFirebaseAdminApp();

  try {
    const decodedToken = await getAuth(app).verifyIdToken(idToken);

    return mapDecodedToken(decodedToken);
  } catch (error) {
    if (isFirebaseTokenVerificationError(error)) {
      return null;
    }

    throw error;
  }
}

export async function loadCodeLabProfileByUid(
  firebaseUid: string,
): Promise<VerifiedCodeLabProfile | null> {
  const normalizedUid = firebaseUid.trim();

  if (!normalizedUid) {
    return null;
  }

  try {
    const snapshot = await getFirestore(getFirebaseAdminApp())
      .collection("users")
      .doc(normalizedUid)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() ?? {};
    const role = data.role === "admin" ? "admin" : data.role === "student" ? "student" : null;
    const adminScope =
      data.adminScope === "all" || data.adminScope === "assigned" ? data.adminScope : null;
    const email = typeof data.email === "string" && data.email.trim() ? data.email.trim() : null;
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;

    return {
      firebaseUid: normalizedUid,
      email,
      name,
      role,
      adminScope: role === "admin" ? adminScope ?? "assigned" : null,
    };
  } catch {
    return null;
  }
}

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function getFirebaseAdminApp(): App {
  const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);

  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    return initializeApp(
      {
        credential: cert(JSON.parse(serviceAccountJson)),
      },
      FIREBASE_APP_NAME,
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp(
    {
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    },
    FIREBASE_APP_NAME,
  );
}

function mapDecodedToken(decodedToken: DecodedIdToken): VerifiedFirebaseUser {
  const role = decodedToken.role === "admin" ? "admin" : "student";
  const adminScope =
    decodedToken.adminScope === "all" || decodedToken.adminScope === "assigned"
      ? decodedToken.adminScope
      : null;

  return {
    firebaseUid: decodedToken.uid,
    email: typeof decodedToken.email === "string" ? decodedToken.email : null,
    name:
      typeof decodedToken.name === "string" && decodedToken.name.trim()
        ? decodedToken.name.trim()
        : typeof decodedToken.email === "string" && decodedToken.email.trim()
          ? decodedToken.email.trim()
          : "STUDY LAB User",
    role,
    adminScope: role === "admin" ? adminScope ?? "assigned" : null,
  };
}

function isFirebaseTokenVerificationError(error: unknown): boolean {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;

  return (
    code === "auth/argument-error" ||
    code === "auth/id-token-expired" ||
    code === "auth/id-token-revoked" ||
    code === "auth/invalid-id-token" ||
    code === "auth/user-disabled"
  );
}
