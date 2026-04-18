"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HEARTBEAT_INTERVAL_MS,
  STUDENT_DASHBOARD_POLLING_MS,
  TEACHER_DASHBOARD_POLLING_MS,
} from "../constants/polling";
import type {
  PrototypeAction,
  PrototypeStudentState,
  PrototypeViewMode,
  StudyLabPrototypeState,
} from "../types/prototype";

const defaultState: StudyLabPrototypeState = {
  students: [],
  teacher: {
    activeQuestionStudentId: null,
    pendingQuestionStudentIds: [],
    lastUpdatedAt: "",
  },
};

const STUDENT_ID_STORAGE_KEY = "study-lab.prototype.selected-student";

export function useStudyLabPrototype() {
  const [viewMode, setViewMode] = useState<PrototypeViewMode>("split");
  const [state, setState] = useState<StudyLabPrototypeState>(defaultState);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isHydrated, setIsHydrated] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const previewStudentIdRef = useRef<string | null>(null);

  useEffect(() => {
    void refreshState();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const poll = window.setInterval(() => {
      void refreshState();
    }, viewMode === "teacher" ? TEACHER_DASHBOARD_POLLING_MS : STUDENT_DASHBOARD_POLLING_MS);

    return () => window.clearInterval(poll);
  }, [isHydrated, viewMode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const savedStudentId = window.localStorage.getItem(STUDENT_ID_STORAGE_KEY);
    if (!savedStudentId) {
      return;
    }

    setSelectedStudentId(savedStudentId);
  }, [isHydrated]);

  useEffect(() => {
    if (!selectedStudentId) {
      return;
    }

    window.localStorage.setItem(STUDENT_ID_STORAGE_KEY, selectedStudentId);
  }, [selectedStudentId]);

  const selectedStudent = useMemo<PrototypeStudentState | null>(() => {
    if (state.students.length === 0) {
      return null;
    }

    if (!selectedStudentId) {
      return state.students[0];
    }

    return state.students.find((student) => student.id === selectedStudentId) ?? state.students[0];
  }, [selectedStudentId, state.students]);

  useEffect(() => {
    if (!selectedStudent?.isEntered) {
      return;
    }

    const heartbeat = window.setInterval(() => {
      void dispatchAction("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(heartbeat);
  }, [selectedStudent?.id, selectedStudent?.isEntered]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  useEffect(() => {
    const previewStudent = state.students.find((student) => student.id === previewStudentIdRef.current);
    if (previewStudent?.isEntered !== false) {
      return;
    }

    stopStream();
  }, [state.students]);

  const cameraOffSeconds = useMemo(() => {
    if (!selectedStudent?.cameraWarningStartedAt || selectedStudent.cameraStatus !== "OFF") {
      return 0;
    }

    return Math.max(
      0,
      Math.floor((now - new Date(selectedStudent.cameraWarningStartedAt).getTime()) / 1000),
    );
  }, [now, selectedStudent?.cameraStatus, selectedStudent?.cameraWarningStartedAt]);

  async function requestCameraAndEnter() {
    if (!selectedStudent) {
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
      previewStudentIdRef.current = selectedStudent.id;

      await dispatchAction("enter");
      setIsGuideOpen(false);
    } catch {
      setPermissionMessage("카메라를 허용해야 입실할 수 있습니다.");
    }
  }

  function openGuide() {
    setPermissionMessage(null);
    setIsGuideOpen(true);
  }

  function closeGuide() {
    setIsGuideOpen(false);
  }

  async function turnCameraOnAgain() {
    if (!selectedStudent) {
      return;
    }

    if (streamRef.current && previewStudentIdRef.current === selectedStudent.id) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      await dispatchAction("camera_on");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stopStream();
      streamRef.current = stream;
      previewStudentIdRef.current = selectedStudent.id;
      await dispatchAction("camera_on");
    } catch {
      setPermissionMessage("카메라를 다시 켜려면 브라우저 권한을 허용해 주세요.");
    }
  }

  async function turnCameraOff() {
    if (streamRef.current && previewStudentIdRef.current === selectedStudent?.id) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    await dispatchAction("camera_off");
  }

  async function exitStudyLab() {
    if (previewStudentIdRef.current === selectedStudent?.id) {
      stopStream();
    }

    await dispatchAction("exit");
  }

  async function requestQuestion() {
    await dispatchAction("request_question");
  }

  async function cancelQuestion() {
    await dispatchAction("cancel_question");
  }

  async function acceptQuestion(studentId: string) {
    await dispatchAction("accept_question", { studentId });
  }

  async function completeQuestion(studentId: string) {
    await dispatchAction("complete_question", { studentId });
  }

  async function dismissQuestionToast() {
    await dispatchAction("dismiss_question_toast");
  }

  async function clearAutoExitReason() {
    await dispatchAction("clear_auto_exit_reason");
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    previewStudentIdRef.current = null;
  }

  async function refreshState() {
    const response = await fetch("/api/study-lab/prototype/state", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const json = (await response.json()) as {
      ok: boolean;
      data: StudyLabPrototypeState;
    };

    if (!json.ok) {
      return;
    }

    setState(json.data);
    setSelectedStudentId((currentStudentId) => {
      if (currentStudentId && json.data.students.some((student) => student.id === currentStudentId)) {
        return currentStudentId;
      }

      return json.data.students[0]?.id ?? null;
    });
  }

  async function dispatchAction(action: PrototypeAction, payload?: { studentId?: string | null }) {
    if (!selectedStudent && !payload?.studentId) {
      return;
    }

    const response = await fetch("/api/study-lab/prototype/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        studentId: payload?.studentId ?? selectedStudent?.id ?? null,
      }),
    });

    if (!response.ok) {
      return;
    }

    const json = (await response.json()) as {
      ok: boolean;
      data: StudyLabPrototypeState;
    };

    if (json.ok) {
      setState(json.data);
    }
  }

  return {
    viewMode,
    setViewMode,
    state,
    students: state.students,
    selectedStudent,
    selectedStudentId,
    setSelectedStudentId,
    isGuideOpen,
    permissionMessage,
    selectedStudentStream:
      previewStudentIdRef.current === selectedStudent?.id ? streamRef.current : null,
    getStudentStream: (studentId: string) =>
      previewStudentIdRef.current === studentId ? streamRef.current : null,
    studySeconds: selectedStudent?.todayStudySeconds ?? 0,
    cameraOffSeconds,
    openGuide,
    closeGuide,
    requestCameraAndEnter,
    turnCameraOff,
    turnCameraOnAgain,
    exitStudyLab,
    requestQuestion,
    cancelQuestion,
    acceptQuestion,
    completeQuestion,
    dismissQuestionToast,
    clearAutoExitReason,
  };
}
