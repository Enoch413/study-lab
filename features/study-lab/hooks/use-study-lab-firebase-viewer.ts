"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getAuth, onIdTokenChanged, type User } from "firebase/auth";
import {
  getConfiguredFirebaseApp,
  isStudyLabEmbeddedMode,
  requestEmbeddedCodeLabAuth,
} from "../client/study-lab-auth-headers";
import type { StudyLabMeApiResponse } from "../types/api";
import type { StudyLabMappedRole } from "../types/domain";

export interface StudyLabFirebaseViewerState {
  source: "firebase";
  status: "loading" | "ready";
  name: string | null;
  email: string | null;
  mappedRole: StudyLabMappedRole | null;
  message: string | null;
}

const DEFAULT_STATE: StudyLabFirebaseViewerState = {
  source: "firebase",
  status: "ready",
  name: null,
  email: null,
  mappedRole: null,
  message: "로그인이 필요합니다.",
};

const INITIAL_STATE: StudyLabFirebaseViewerState = {
  source: "firebase",
  status: "loading",
  name: null,
  email: null,
  mappedRole: null,
  message: null,
};

export function useStudyLabFirebaseViewer(): StudyLabFirebaseViewerState {
  const [state, setState] = useState<StudyLabFirebaseViewerState>(INITIAL_STATE);

  useEffect(() => {
    if (isStudyLabEmbeddedMode()) {
      let cancelled = false;

      const refreshEmbeddedViewer = async (force?: boolean) => {
        setState((current) => {
          if (current.mappedRole) {
            return {
              ...current,
              status: "loading",
              message: null,
            };
          }

          return {
            source: "firebase",
            status: "loading",
            name: null,
            email: null,
            mappedRole: null,
            message: "CODE LAB 로그인 확인 중입니다.",
          };
        });

        await hydrateEmbeddedViewer(force === true, (nextState) => {
          if (!cancelled) {
            setState(nextState);
          }
        });
      };

      void refreshEmbeddedViewer(true);

      const handleFocus = () => {
        void refreshEmbeddedViewer(true);
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          void refreshEmbeddedViewer(true);
        }
      };

      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        cancelled = true;
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    const app = getConfiguredFirebaseApp();

    if (!app) {
      setState({
        ...DEFAULT_STATE,
        message: "Firebase 설정이 없습니다.",
      });
      return;
    }

    const auth = getAuth(app);

    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (!user) {
        setState(DEFAULT_STATE);
        return;
      }

      setState({
        source: "firebase",
        status: "loading",
        name: getFallbackUserName(user),
        email: user.email,
        mappedRole: null,
        message: null,
      });

      void hydrateFirebaseViewer(user, setState);
    });

    return unsubscribe;
  }, []);

  return state;
}

async function hydrateFirebaseViewer(
  user: User,
  setState: Dispatch<SetStateAction<StudyLabFirebaseViewerState>>,
) {
  try {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/study-lab/me", {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    const json = (await response.json()) as StudyLabMeApiResponse;

    if (!json.ok) {
      setState({
        source: "firebase",
        status: "ready",
        name: getFallbackUserName(user),
        email: user.email,
        mappedRole: null,
        message: json.error.message,
      });
      return;
    }

    setState({
      source: "firebase",
      status: "ready",
      name: json.data.user.name,
      email: user.email,
      mappedRole: json.data.user.mappedRole,
      message: null,
    });
  } catch (error) {
    setState({
      source: "firebase",
      status: "ready",
      name: getFallbackUserName(user),
      email: user.email,
      mappedRole: null,
      message: error instanceof Error ? error.message : "사용자 정보를 불러오지 못했습니다.",
    });
  }
}

async function hydrateEmbeddedViewer(
  force: boolean,
  setState: Dispatch<SetStateAction<StudyLabFirebaseViewerState>>,
) {
  try {
    const embeddedAuth = await requestEmbeddedCodeLabAuth({ force });

    if (!embeddedAuth?.token) {
      setState({
        source: "firebase",
        status: "ready",
        name: embeddedAuth?.name ?? null,
        email: embeddedAuth?.email ?? null,
        mappedRole: null,
        message: embeddedAuth?.error ?? "CODE LAB 로그인 정보를 읽지 못했습니다.",
      });
      return;
    }

    const response = await fetch("/api/study-lab/me", {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${embeddedAuth.token}`,
      },
    });
    const json = (await response.json()) as StudyLabMeApiResponse;

    if (!json.ok) {
      setState({
        source: "firebase",
        status: "ready",
        name: embeddedAuth.name,
        email: embeddedAuth.email,
        mappedRole: null,
        message: json.error.message,
      });
      return;
    }

    setState({
      source: "firebase",
      status: "ready",
      name: json.data.user.name,
      email: embeddedAuth.email,
      mappedRole: json.data.user.mappedRole,
      message: null,
    });
  } catch (error) {
    setState({
      source: "firebase",
      status: "ready",
      name: null,
      email: null,
      mappedRole: null,
      message: error instanceof Error ? error.message : "로그인 정보를 불러오지 못했습니다.",
    });
  }
}

function getFallbackUserName(user: User): string {
  const displayName = user.displayName?.trim();
  const email = user.email?.trim();

  if (displayName) {
    return displayName;
  }

  if (email) {
    return email;
  }

  return "Firebase 사용자";
}
