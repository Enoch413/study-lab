"use client";

import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

const STUDY_LAB_EMBED_PARAM = "embed";
const STUDY_LAB_EMBED_VALUE = "code-lab";
const STUDY_LAB_PARENT_ORIGIN_PARAM = "parentOrigin";
const STUDY_LAB_DETACHED_PARAM = "detached";
const STUDY_LAB_AUTH_REQUEST = "code-lab-study-auth-request";
const STUDY_LAB_AUTH_RESPONSE = "code-lab-study-auth-response";
const STUDY_LAB_DETACHED_EXIT = "code-lab-study-detached-exit";
const STUDY_LAB_EMBED_TIMEOUT_MS = 4000;
const STUDY_LAB_EMBED_CACHE_MS = 30_000;

export interface StudyLabDevAuthUser {
  firebaseUid: string;
  name: string;
  email: string;
  role: "student" | "admin";
  adminScope?: "assigned" | "all" | null;
}

export interface EmbeddedStudyLabAuthSnapshot {
  token: string | null;
  name: string | null;
  email: string | null;
  role: "student" | "admin" | null;
  adminScope: "assigned" | "all" | null;
  error: string | null;
  receivedAt: number;
}

interface EmbeddedStudyLabAuthRequestMessage {
  type: typeof STUDY_LAB_AUTH_REQUEST;
  requestId: string;
}

interface EmbeddedStudyLabAuthResponseMessage {
  type: typeof STUDY_LAB_AUTH_RESPONSE;
  requestId: string;
  ok?: boolean;
  token?: string | null;
  name?: string | null;
  email?: string | null;
  role?: "student" | "admin" | null;
  adminScope?: "assigned" | "all" | null;
  error?: string | null;
}

interface DetachedStudyLabExitMessage {
  type: typeof STUDY_LAB_DETACHED_EXIT;
}

let embeddedStudyLabAuthSnapshot: EmbeddedStudyLabAuthSnapshot | null = null;
let embeddedStudyLabAuthRelayInstalled = false;

export async function getStudyLabAuthHeaders(
  _fallbackUser: StudyLabDevAuthUser,
): Promise<Record<string, string>> {
  if (isStudyLabEmbeddedMode()) {
    const embeddedAuth = await requestEmbeddedCodeLabAuth();

    if (embeddedAuth?.token) {
      return {
        Authorization: `Bearer ${embeddedAuth.token}`,
      };
    }

    return {};
  }

  const idToken = await getFirebaseIdToken();

  if (idToken) {
    return {
      Authorization: `Bearer ${idToken}`,
    };
  }

  return {};
}

export function isStudyLabEmbeddedMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return getStudyLabWindowSearchParams().get(STUDY_LAB_EMBED_PARAM) === STUDY_LAB_EMBED_VALUE;
}

export function isStudyLabDetachedWindow(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return getStudyLabWindowSearchParams().get(STUDY_LAB_DETACHED_PARAM) === "1";
}

export function openDetachedStudyLabWindowShell(): Window | null {
  if (typeof window === "undefined" || !isStudyLabEmbeddedMode()) {
    return null;
  }

  const popup = window.open("", "codeLabStudyCafeMainRoom");

  if (!popup) {
    return null;
  }

  try {
    popup.document.title = "STUDY CAFE";
    popup.document.body.innerHTML =
      '<div style="font-family:sans-serif;padding:32px">STUDY CAFE 입장 준비 중입니다...</div>';
  } catch {
    // Some browsers restrict about:blank writes; navigation below still works.
  }

  return popup;
}

export function navigateDetachedStudyLabWindow(popup: Window | null): boolean {
  if (typeof window === "undefined" || !popup || popup.closed) {
    return false;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set(STUDY_LAB_EMBED_PARAM, STUDY_LAB_EMBED_VALUE);
    url.searchParams.set(STUDY_LAB_DETACHED_PARAM, "1");
    popup.location.href = url.toString();
    popup.focus();
    return true;
  } catch {
    return false;
  }
}

export function notifyEmbeddedStudyLabDetachedExit(): void {
  if (typeof window === "undefined" || !isStudyLabDetachedWindow()) {
    return;
  }

  if (!window.opener || window.opener.closed) {
    return;
  }

  const payload: DetachedStudyLabExitMessage = {
    type: STUDY_LAB_DETACHED_EXIT,
  };

  window.opener.postMessage(payload, window.location.origin);
}

export function isDetachedStudyLabExitMessage(
  value: unknown,
): value is DetachedStudyLabExitMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === STUDY_LAB_DETACHED_EXIT
  );
}

export function installEmbeddedCodeLabAuthRelay(): void {
  if (
    typeof window === "undefined" ||
    embeddedStudyLabAuthRelayInstalled ||
    !isStudyLabEmbeddedMode() ||
    window.parent === window
  ) {
    return;
  }

  embeddedStudyLabAuthRelayInstalled = true;

  window.addEventListener("message", async (event) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (!isEmbeddedStudyLabAuthRequestMessage(event.data)) {
      return;
    }

    const source = event.source as Window | null;

    if (!source || typeof source.postMessage !== "function") {
      return;
    }

    const auth = await requestEmbeddedCodeLabAuth({ force: true });
    const payload: EmbeddedStudyLabAuthResponseMessage = {
      type: STUDY_LAB_AUTH_RESPONSE,
      requestId: event.data.requestId,
      ok: !!auth?.token,
      token: auth?.token ?? null,
      name: auth?.name ?? null,
      email: auth?.email ?? null,
      role: auth?.role ?? null,
      adminScope: auth?.adminScope ?? null,
      error: auth?.token ? null : auth?.error ?? "인증 정보를 받지 못했습니다.",
    };

    source.postMessage(payload, event.origin);
  });
}

function getCodeLabAuthHostWindow(): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.opener && !window.opener.closed) {
    return window.opener;
  }

  if (window.parent && window.parent !== window) {
    return window.parent;
  }

  return null;
}

export async function requestEmbeddedCodeLabAuth(options?: {
  force?: boolean;
}): Promise<EmbeddedStudyLabAuthSnapshot | null> {
  if (!isStudyLabEmbeddedMode() || typeof window === "undefined") {
    return null;
  }

  if (
    !options?.force &&
    embeddedStudyLabAuthSnapshot &&
    Date.now() - embeddedStudyLabAuthSnapshot.receivedAt < STUDY_LAB_EMBED_CACHE_MS
  ) {
    return embeddedStudyLabAuthSnapshot;
  }

  const authHostWindow = getCodeLabAuthHostWindow();

  if (!authHostWindow) {
    embeddedStudyLabAuthSnapshot = buildEmbeddedStudyLabAuthSnapshot({
      error: "CODE LAB 창을 찾지 못했습니다.",
    });
    return embeddedStudyLabAuthSnapshot;
  }

  const expectedParentOrigin = getExpectedParentOrigin();

  return new Promise((resolve) => {
    const requestId = [
      "study-lab",
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 10),
    ].join("-");

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeout);
    };

    const resolveSnapshot = (partial: Partial<EmbeddedStudyLabAuthSnapshot>) => {
      cleanup();
      embeddedStudyLabAuthSnapshot = buildEmbeddedStudyLabAuthSnapshot(partial);
      resolve(embeddedStudyLabAuthSnapshot);
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        expectedParentOrigin &&
        event.origin &&
        event.origin !== expectedParentOrigin &&
        event.origin !== window.location.origin
      ) {
        return;
      }

      const data = event.data;

      if (!isEmbeddedStudyLabAuthResponseMessage(data, requestId)) {
        return;
      }

      resolveSnapshot({
        token: typeof data.token === "string" && data.token.trim() ? data.token.trim() : null,
        name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : null,
        email: typeof data.email === "string" && data.email.trim() ? data.email.trim() : null,
        role: data.role === "admin" || data.role === "student" ? data.role : null,
        adminScope:
          data.adminScope === "all" || data.adminScope === "assigned"
            ? data.adminScope
            : null,
        error: data.ok === false ? data.error ?? "인증 정보를 받지 못했습니다." : null,
      });
    };

    const timeout = window.setTimeout(() => {
      resolveSnapshot({
        error: "인증 응답이 지연되고 있습니다.",
      });
    }, STUDY_LAB_EMBED_TIMEOUT_MS);

    window.addEventListener("message", handleMessage);

    const payload: EmbeddedStudyLabAuthRequestMessage = {
      type: STUDY_LAB_AUTH_REQUEST,
      requestId,
    };

    authHostWindow.postMessage(
      payload,
      authHostWindow === window.parent ? expectedParentOrigin ?? "*" : "*",
    );
  });
}

export function getStudyLabDevAuthHeaders(
  fallbackUser: StudyLabDevAuthUser,
): Record<string, string> {
  return {
    "x-study-lab-firebase-uid": fallbackUser.firebaseUid,
    "x-study-lab-user-name": encodeURIComponent(fallbackUser.name),
    "x-study-lab-user-email": fallbackUser.email,
    "x-study-lab-role": fallbackUser.role,
    ...(fallbackUser.adminScope
      ? { "x-study-lab-admin-scope": fallbackUser.adminScope }
      : {}),
  };
}

export function getConfiguredFirebaseApp(): FirebaseApp | null {
  if (isStudyLabEmbeddedMode()) {
    return null;
  }

  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const config = getFirebaseOptions();

  if (!config) {
    return null;
  }

  return initializeApp(config);
}

async function getFirebaseIdToken(): Promise<string | null> {
  const app = getConfiguredFirebaseApp();

  if (!app) {
    return null;
  }

  const auth = getAuth(app);
  const user = auth.currentUser ?? (await waitForCurrentUser());

  return user ? user.getIdToken() : null;
}

function getFirebaseOptions(): FirebaseOptions | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

function waitForCurrentUser(): Promise<User | null> {
  const app = getConfiguredFirebaseApp();

  if (!app) {
    return Promise.resolve(null);
  }

  const auth = getAuth(app);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 750);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}

function getStudyLabWindowSearchParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function getExpectedParentOrigin(): string | null {
  const rawOrigin = getStudyLabWindowSearchParams().get(STUDY_LAB_PARENT_ORIGIN_PARAM)?.trim();

  if (!rawOrigin) {
    return null;
  }

  try {
    return new URL(rawOrigin).origin;
  } catch {
    return null;
  }
}

function isEmbeddedStudyLabAuthResponseMessage(
  value: unknown,
  requestId: string,
): value is EmbeddedStudyLabAuthResponseMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === STUDY_LAB_AUTH_RESPONSE &&
    "requestId" in value &&
    value.requestId === requestId
  );
}

function isEmbeddedStudyLabAuthRequestMessage(
  value: unknown,
): value is EmbeddedStudyLabAuthRequestMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === STUDY_LAB_AUTH_REQUEST &&
    "requestId" in value &&
    typeof value.requestId === "string" &&
    value.requestId.trim().length > 0
  );
}

function buildEmbeddedStudyLabAuthSnapshot(
  partial?: Partial<EmbeddedStudyLabAuthSnapshot>,
): EmbeddedStudyLabAuthSnapshot {
  return {
    token: partial?.token ?? null,
    name: partial?.name ?? null,
    email: partial?.email ?? null,
    role: partial?.role ?? null,
    adminScope: partial?.adminScope ?? null,
    error: partial?.error ?? null,
    receivedAt: Date.now(),
  };
}
