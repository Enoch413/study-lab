"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HEARTBEAT_INTERVAL_MS,
  STUDENT_DASHBOARD_POLLING_MS,
} from "../constants/polling";
import {
  getStudyLabAuthHeaders,
  type StudyLabDevAuthUser,
} from "../client/study-lab-auth-headers";
import type {
  StudentConnectionStatus,
  StudentQuestionStatus,
} from "../components/student-dashboard";
import type {
  CameraUpdateRequestBody,
  ApiResponse,
  SessionEnterApiResponse,
  SessionExitApiResponse,
  StudentDashboardApiResponse,
} from "../types/api";
import type { StudentDashboardDto } from "../types/dto";

export const STUDY_LAB_DEV_STUDENTS = [
  {
    firebaseUid: "study-lab-dev-kim-minseo",
    name: "김민서",
    email: "kim-minseo@study-lab.local",
  },
  {
    firebaseUid: "study-lab-dev-park-junho",
    name: "박준호",
    email: "park-junho@study-lab.local",
  },
  {
    firebaseUid: "study-lab-dev-lee-seoyun",
    name: "이서윤",
    email: "lee-seoyun@study-lab.local",
  },
  {
    firebaseUid: "study-lab-dev-choi-haram",
    name: "최하람",
    email: "choi-haram@study-lab.local",
  },
] as const;

const SELECTED_DEV_STUDENT_KEY = "study-lab.real-api.selected-student";
const CLIENT_INSTANCE_KEY = "study-lab.real-api.client-instance-id";
const CAMERA_OFF_AUTO_EXIT_MS = 10 * 60 * 1000;

export function useStudyLabStudentApi(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  const [selectedFirebaseUid, setSelectedFirebaseUid] = useState<string>(
    STUDY_LAB_DEV_STUDENTS[0].firebaseUid,
  );
  const [dashboard, setDashboard] = useState<StudentDashboardDto | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [questionEndedToast, setQuestionEndedToast] = useState<string | null>(null);
  const [autoExitReason, setAutoExitReason] = useState<string | null>(null);
  const [cameraOffStartedAt, setCameraOffStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [clientInstanceId, setClientInstanceId] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedStudent = useMemo(() => {
    return (
      STUDY_LAB_DEV_STUDENTS.find((student) => student.firebaseUid === selectedFirebaseUid) ??
      STUDY_LAB_DEV_STUDENTS[0]
    );
  }, [selectedFirebaseUid]);

  const session = dashboard?.session ?? null;
  const isEntered = session?.status === "ACTIVE";
  const cameraStatus = session?.cameraStatus ?? "OFF";
  const connectionStatus: StudentConnectionStatus = isEntered ? session.connectionStatus : "IDLE";
  const micPolicy = session?.micPolicy ?? "MUTED_LOCKED";
  const questionStatus: StudentQuestionStatus = dashboard?.question?.status ?? "NONE";

  const devAuthUser = useMemo<StudyLabDevAuthUser>(() => {
    return {
      firebaseUid: selectedStudent.firebaseUid,
      name: selectedStudent.name,
      email: selectedStudent.email,
      role: "student",
    };
  }, [selectedStudent.email, selectedStudent.firebaseUid, selectedStudent.name]);

  const requestHeaders = useCallback(async () => {
    return getStudyLabAuthHeaders(devAuthUser);
  }, [devAuthUser]);

  const jsonHeaders = useCallback(async () => {
    return {
      ...(await requestHeaders()),
      "Content-Type": "application/json",
    };
  }, [requestHeaders]);

  const refreshDashboard = useCallback(async () => {
    if (!isEnabled) {
      return;
    }

    const response = await fetch("/api/study-lab/dashboard/student", {
      cache: "no-store",
      headers: await requestHeaders(),
    });
    const json = (await response.json()) as StudentDashboardApiResponse;

    if (json.ok) {
      setDashboard(json.data);
    }
  }, [requestHeaders]);

  const postHeartbeat = useCallback(
    async (sessionId: string) => {
      if (!isEnabled) {
        return;
      }

      await fetch(`/api/study-lab/sessions/${sessionId}/heartbeat`, {
        method: "POST",
        headers: await requestHeaders(),
      });
    },
    [isEnabled, requestHeaders],
  );

  useEffect(() => {
    const savedStudent = window.localStorage.getItem(SELECTED_DEV_STUDENT_KEY);
    const savedClientInstanceId = window.localStorage.getItem(CLIENT_INSTANCE_KEY);

    if (
      savedStudent &&
      STUDY_LAB_DEV_STUDENTS.some((student) => student.firebaseUid === savedStudent)
    ) {
      setSelectedFirebaseUid(savedStudent);
    }

    if (savedClientInstanceId) {
      setClientInstanceId(savedClientInstanceId);
      return;
    }

    const nextClientInstanceId = crypto.randomUUID();
    window.localStorage.setItem(CLIENT_INSTANCE_KEY, nextClientInstanceId);
    setClientInstanceId(nextClientInstanceId);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SELECTED_DEV_STUDENT_KEY, selectedFirebaseUid);
  }, [selectedFirebaseUid]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    void refreshDashboard();
  }, [isEnabled, refreshDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const poll = window.setInterval(() => {
      void refreshDashboard();
    }, STUDENT_DASHBOARD_POLLING_MS);

    return () => window.clearInterval(poll);
  }, [isEnabled, refreshDashboard]);

  useEffect(() => {
    if (!isEntered || !session?.id) {
      return;
    }

    const heartbeat = window.setInterval(() => {
      void postHeartbeat(session.id);
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(heartbeat);
  }, [isEntered, postHeartbeat, session?.id]);

  useEffect(() => {
    if (cameraStatus !== "OFF" || !isEntered) {
      setCameraOffStartedAt(null);
      return;
    }

    setCameraOffStartedAt((current) => current ?? Date.now());
  }, [cameraStatus, isEntered]);

  useEffect(() => {
    if (!cameraOffStartedAt || !isEntered || !session?.id) {
      return;
    }

    if (now - cameraOffStartedAt < CAMERA_OFF_AUTO_EXIT_MS) {
      return;
    }

    void exitStudyLab("카메라가 10분 이상 꺼져 있어 자동 퇴실 처리되었습니다.");
  }, [cameraOffStartedAt, isEntered, now, session?.id]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  useEffect(() => {
    if (isEnabled) {
      return;
    }

    stopStream();
    setDashboard(null);
    setPermissionMessage(null);
    setQuestionEndedToast(null);
    setAutoExitReason(null);
    setCameraOffStartedAt(null);
  }, [isEnabled]);

  useEffect(() => {
    stopStream();
    setDashboard(null);
    setPermissionMessage(null);
    setQuestionEndedToast(null);
    setAutoExitReason(null);
    setCameraOffStartedAt(null);
    if (isEnabled) {
      void refreshDashboard();
    }
  }, [isEnabled, refreshDashboard, selectedFirebaseUid]);

  const cameraOffSeconds = useMemo(() => {
    if (!cameraOffStartedAt || cameraStatus !== "OFF" || !isEntered) {
      return 0;
    }

    return Math.max(0, Math.floor((now - cameraOffStartedAt) / 1000));
  }, [cameraOffStartedAt, cameraStatus, isEntered, now]);

  async function requestCameraAndEnter() {
    if (!isEnabled) {
      return;
    }

    setPermissionMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      stopStream();
      streamRef.current = stream;

      const response = await fetch("/api/study-lab/sessions/enter", {
        method: "POST",
        headers: await jsonHeaders(),
        body: JSON.stringify({
          clientInstanceId,
          deviceLabel: navigator.userAgent.slice(0, 100),
        }),
      });
      const json = (await response.json()) as SessionEnterApiResponse;

      if (!json.ok) {
        throw new Error(json.error.message);
      }

      setDashboard((current) => ({
        session: json.data.session,
        todayStudySeconds: current?.todayStudySeconds ?? 0,
        question: current?.question ?? null,
        recentSessions: current?.recentSessions ?? [],
      }));
      setCameraOffStartedAt(null);
      setIsGuideOpen(false);
      await refreshDashboard();
    } catch (error) {
      stopStream();
      setPermissionMessage(
        error instanceof Error && error.message
          ? error.message
          : "카메라를 허용해야 입실할 수 있습니다.",
      );
    }
  }

  async function turnCameraOff() {
    if (!isEnabled) {
      return;
    }

    if (!session?.id) {
      return;
    }

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    await updateCamera(session.id, "OFF");
  }

  async function turnCameraOnAgain() {
    if (!isEnabled) {
      return;
    }

    if (!session?.id) {
      return;
    }

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      await updateCamera(session.id, "ON");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      await updateCamera(session.id, "ON");
    } catch {
      setPermissionMessage("카메라를 다시 켜려면 브라우저 권한을 허용해 주세요.");
    }
  }

  async function updateCamera(sessionId: string, nextCameraStatus: "ON" | "OFF") {
    if (!isEnabled) {
      return;
    }

    const body: CameraUpdateRequestBody = { cameraStatus: nextCameraStatus };
    const response = await fetch(`/api/study-lab/sessions/${sessionId}/camera`, {
      method: "POST",
      headers: await jsonHeaders(),
      body: JSON.stringify(body),
    });

    if (response.ok) {
      await refreshDashboard();
    }
  }

  async function exitStudyLab(reason?: string) {
    if (!isEnabled) {
      stopStream();
      return;
    }

    if (!session?.id) {
      stopStream();
      return;
    }

    const response = await fetch(`/api/study-lab/sessions/${session.id}/exit`, {
      method: "POST",
      headers: await requestHeaders(),
    });
    const json = (await response.json()) as SessionExitApiResponse;

    stopStream();
    setCameraOffStartedAt(null);

    if (json.ok) {
      setDashboard((current) => ({
        session: null,
        todayStudySeconds: json.data.todayStudySeconds,
        question: null,
        recentSessions: current?.recentSessions ?? [],
      }));
    }

    if (reason) {
      setAutoExitReason(reason);
    }

    await refreshDashboard();
  }

  function stopStream() {
    if (!streamRef.current) {
      return;
    }

    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return {
    devStudents: STUDY_LAB_DEV_STUDENTS,
    selectedFirebaseUid,
    setSelectedFirebaseUid,
    selectedStudentName: selectedStudent.name,
    isEntered,
    connectionStatus,
    cameraStatus,
    micPolicy,
    questionStatus,
    studySeconds: dashboard?.todayStudySeconds ?? 0,
    cameraOffSeconds,
    stream: streamRef.current,
    isGuideOpen,
    permissionMessage,
    questionEndedToast,
    autoExitReason,
    openGuide: () => {
      setPermissionMessage(null);
      setIsGuideOpen(true);
    },
    closeGuide: () => setIsGuideOpen(false),
    requestCameraAndEnter,
    exitStudyLab: () => void exitStudyLab(),
    turnCameraOff: () => void turnCameraOff(),
    turnCameraOnAgain,
    requestQuestion,
    cancelQuestion,
    dismissQuestionToast: () => setQuestionEndedToast(null),
    clearAutoExitReason: () => setAutoExitReason(null),
  };

  async function requestQuestion() {
    if (!isEnabled) {
      return;
    }

    if (!session?.id) {
      return;
    }

    const response = await fetch("/api/study-lab/questions", {
      method: "POST",
      headers: await jsonHeaders(),
      body: JSON.stringify({ studySessionId: session.id }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;

    if (json.ok) {
      await refreshDashboard();
    }
  }

  async function cancelQuestion() {
    if (!isEnabled) {
      return;
    }

    if (!dashboard?.question?.id) {
      return;
    }

    const response = await fetch(`/api/study-lab/questions/${dashboard.question.id}/cancel`, {
      method: "POST",
      headers: await requestHeaders(),
    });
    const json = (await response.json()) as ApiResponse<unknown>;

    if (json.ok) {
      await refreshDashboard();
    }
  }
}
