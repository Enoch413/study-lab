"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HEARTBEAT_INTERVAL_MS,
  STUDENT_DASHBOARD_POLLING_MS,
} from "../constants/polling";
import {
  closeDetachedStudyLabWindowFromEmbed,
  getStudyLabAuthHeaders,
  isDetachedStudyLabExitMessage,
  isStudyLabDetachedWindow,
  isStudyLabEmbeddedMode,
  navigateDetachedStudyLabWindow,
  notifyEmbeddedStudyLabDetachedExit,
  openDetachedStudyLabWindowShell,
  type StudyLabDevAuthUser,
} from "../client/study-lab-auth-headers";
import type { StudentConnectionStatus } from "../components/student-dashboard";
import type {
  ApiResponse,
  CameraUpdateRequestBody,
  SessionEnterApiResponse,
  SessionExitApiResponse,
  StudentDashboardApiResponse,
} from "../types/api";
import type {
  ActiveStudentTileDto,
  SessionSummaryDto,
  StudentDashboardDto,
} from "../types/dto";

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
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [autoExitReason, setAutoExitReason] = useState<string | null>(null);
  const [cameraOffStartedAt, setCameraOffStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [clientInstanceId, setClientInstanceId] = useState<string | null>(null);
  const [isCameraUpdating, setIsCameraUpdating] = useState(false);
  const [isPreparingCamera, setIsPreparingCamera] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
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
  const connectionStatus: StudentConnectionStatus = isEntered
    ? session.connectionStatus
    : "IDLE";
  const micPolicy = session?.micPolicy ?? "MUTED_LOCKED";

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

  const syncDashboard = useCallback((nextDashboard: StudentDashboardDto | null) => {
    setDashboard(nextDashboard);
  }, []);

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
      syncDashboard(json.data);
    }
  }, [isEnabled, requestHeaders, syncDashboard]);

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
    if (!isEnabled || !isStudyLabEmbeddedMode() || isStudyLabDetachedWindow()) {
      return;
    }

    const handleDetachedExit = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (!isDetachedStudyLabExitMessage(event.data)) {
        return;
      }

      stopStream();
      closeDetachedStudyLabWindowFromEmbed();
      setCameraOffStartedAt(null);
      setPermissionMessage(null);
      setAutoExitReason(null);
      setDashboard((current) => (current ? { ...current, session: null } : current));
      void refreshDashboard();
    };

    window.addEventListener("message", handleDetachedExit);
    return () => window.removeEventListener("message", handleDetachedExit);
  }, [isEnabled, refreshDashboard]);

  useEffect(() => {
    if (
      !isEnabled ||
      !isStudyLabDetachedWindow() ||
      !isEntered ||
      cameraStatus !== "ON" ||
      streamRef.current
    ) {
      return;
    }

    void ensurePreviewStream();
  }, [cameraStatus, isEnabled, isEntered, session?.id]);

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
    setAutoExitReason(null);
    setCameraOffStartedAt(null);
    setIsCameraUpdating(false);
    setIsPreparingCamera(false);
    setIsEntering(false);
  }, [isEnabled]);

  useEffect(() => {
    stopStream();
    setDashboard(null);
    setPermissionMessage(null);
    setAutoExitReason(null);
    setCameraOffStartedAt(null);
    setIsCameraUpdating(false);
    setIsPreparingCamera(false);
    setIsEntering(false);

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

  const studySeconds = useMemo(() => {
    if (!isEntered || !session?.startedAt) {
      return 0;
    }

    const sessionStartedAt = Date.parse(session.startedAt);

    if (Number.isNaN(sessionStartedAt)) {
      return 0;
    }

    return Math.max(0, Math.floor((now - sessionStartedAt) / 1000));
  }, [isEntered, now, session?.startedAt]);

  const patchDashboard = useCallback(
    (updater: (current: StudentDashboardDto) => StudentDashboardDto) => {
      setDashboard((current) => (current ? updater(current) : current));
    },
    [],
  );

  async function requestCameraPreview() {
    if (!isEnabled) {
      return;
    }

    setPermissionMessage(null);
    setIsPreparingCamera(true);

    try {
      await ensurePreviewStream();
    } finally {
      setIsPreparingCamera(false);
    }
  }

  async function requestCameraAndEnter() {
    if (!isEnabled) {
      return;
    }

    setPermissionMessage(null);
    setIsEntering(true);
    const shouldDetachAfterEnter = isStudyLabEmbeddedMode() && !isStudyLabDetachedWindow();
    const detachedWindow = shouldDetachAfterEnter ? openDetachedStudyLabWindowShell() : null;

    try {
      const hasPreviewStream = await ensurePreviewStream();

      if (!hasPreviewStream) {
        if (detachedWindow && !detachedWindow.closed) {
          detachedWindow.close();
        }
        return;
      }

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

      syncDashboard({
        session: json.data.session,
        todayStudySeconds: dashboard?.todayStudySeconds ?? 0,
        totalStudyDays: dashboard?.totalStudyDays ?? 0,
        totalStudySeconds: dashboard?.totalStudySeconds ?? 0,
        activeStudentCount: Math.max(dashboard?.activeStudentCount ?? 0, 1),
        activeStudents: dashboard?.activeStudents ?? [],
        recentSessions: dashboard?.recentSessions ?? [],
      });
      setCameraOffStartedAt(null);
      await refreshDashboard();
      if (shouldDetachAfterEnter) {
        const didOpenDetachedWindow = navigateDetachedStudyLabWindow(detachedWindow);
        if (didOpenDetachedWindow) {
          stopStream();
        } else {
          setPermissionMessage("새 창이 차단되었습니다. 팝업 차단을 해제한 뒤 다시 입장해 주세요.");
        }
      }
    } catch (error) {
      if (detachedWindow && !detachedWindow.closed) {
        detachedWindow.close();
      }
      stopStream();
      setPermissionMessage(
        error instanceof Error && error.message
          ? error.message
          : "카메라를 사용할 수 있어야 입장할 수 있습니다.",
      );
    } finally {
      setIsEntering(false);
    }
  }

  async function turnCameraOff() {
    if (!isEnabled || isCameraUpdating || !session?.id) {
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
    if (!isEnabled || isCameraUpdating || !session?.id) {
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
      setLocalStream(stream);
      await updateCamera(session.id, "ON");
    } catch {
      setPermissionMessage("카메라를 다시 켜려면 브라우저 권한을 허용해 주세요.");
    }
  }

  async function updateCamera(sessionId: string, nextCameraStatus: "ON" | "OFF") {
    if (!isEnabled) {
      return;
    }

    setIsCameraUpdating(true);

    try {
      const body: CameraUpdateRequestBody = { cameraStatus: nextCameraStatus };
      const response = await fetch(`/api/study-lab/sessions/${sessionId}/camera`, {
        method: "POST",
        headers: await jsonHeaders(),
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as ApiResponse<{ session: SessionSummaryDto }>;

      if (json.ok) {
        patchDashboard((current) => ({
          ...current,
          session: current.session
            ? withSessionPatch(current.session, json.data.session)
            : json.data.session,
        }));
        void refreshDashboard();
        return;
      }

      void refreshDashboard();
    } finally {
      setIsCameraUpdating(false);
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

    if (json.ok && isStudyLabDetachedWindow()) {
      notifyEmbeddedStudyLabDetachedExit();
      window.close();
      window.setTimeout(() => window.close(), 80);
      window.setTimeout(() => window.close(), 300);
      return;
    }

    if (json.ok) {
      syncDashboard({
        session: null,
        todayStudySeconds: json.data.todayStudySeconds,
        totalStudyDays: dashboard?.totalStudyDays ?? 0,
        totalStudySeconds: dashboard?.totalStudySeconds ?? 0,
        activeStudentCount: Math.max((dashboard?.activeStudentCount ?? 1) - 1, 0),
        activeStudents: [],
        recentSessions: dashboard?.recentSessions ?? [],
      });
    }

    if (reason) {
      setAutoExitReason(reason);
    }

    await refreshDashboard();
  }

  function stopStream() {
    if (!streamRef.current) {
      setLocalStream(null);
      return;
    }

    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLocalStream(null);
  }

  function stopPreviewCamera() {
    if (isEntered) {
      return;
    }

    stopStream();
    setPermissionMessage(null);
  }

  async function ensurePreviewStream() {
    if (streamRef.current) {
      setLocalStream(streamRef.current);
      return true;
    }

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
      setLocalStream(stream);
      return true;
    } catch (error) {
      setPermissionMessage(
        error instanceof Error && error.message
          ? error.message
          : "카메라를 사용할 수 있어야 입장할 수 있습니다.",
      );
      return false;
    }
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
    studySeconds,
    totalStudyDays: dashboard?.totalStudyDays ?? 0,
    totalStudySeconds: dashboard?.totalStudySeconds ?? 0,
    activeStudentCount: dashboard?.activeStudentCount ?? 0,
    activeStudents: (dashboard?.activeStudents ?? []) as ActiveStudentTileDto[],
    cameraOffSeconds,
    stream: localStream,
    hasPreviewStream: !!localStream,
    permissionMessage,
    autoExitReason,
    isCameraUpdating,
    isPreparingCamera,
    isEntering,
    requestCameraPreview,
    stopPreviewCamera,
    requestCameraAndEnter,
    exitStudyLab: () => void exitStudyLab(),
    turnCameraOff: () => void turnCameraOff(),
    turnCameraOnAgain,
    clearAutoExitReason: () => setAutoExitReason(null),
  };
}

function withSessionPatch(previousSession: SessionSummaryDto, nextSession: SessionSummaryDto) {
  return {
    ...previousSession,
    ...nextSession,
  };
}
