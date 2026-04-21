"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TEACHER_DASHBOARD_POLLING_MS } from "../constants/polling";
import {
  getStudyLabAuthHeaders,
  type StudyLabDevAuthUser,
} from "../client/study-lab-auth-headers";
import type {
  ApiResponse,
  PendingQuestionsApiResponse,
  TeacherDashboardApiResponse,
} from "../types/api";
import type { PendingQuestionDto, TeacherDashboardItemDto } from "../types/dto";
import type { PrototypeConnectionStatus, PrototypeStudentState } from "../types/prototype";

const TEACHER_DEV_AUTH: StudyLabDevAuthUser = {
  firebaseUid: "study-lab-dev-teacher",
  name: "담당 선생님",
  email: "teacher@study-lab.local",
  role: "admin",
  adminScope: "assigned",
};

export function useStudyLabTeacherApi(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  const [items, setItems] = useState<TeacherDashboardItemDto[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingQuestionDto[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isEnabled) {
      return;
    }

    const headers = await getStudyLabAuthHeaders(TEACHER_DEV_AUTH);
    const [dashboardResponse, pendingResponse] = await Promise.all([
      fetch("/api/study-lab/dashboard/teacher", {
        cache: "no-store",
        headers,
      }),
      fetch("/api/study-lab/questions/pending", {
        cache: "no-store",
        headers,
      }),
    ]);

    const dashboardJson = (await dashboardResponse.json()) as TeacherDashboardApiResponse;
    const pendingJson = (await pendingResponse.json()) as PendingQuestionsApiResponse;

    if (dashboardJson.ok) {
      setItems(dashboardJson.data.items);
      setSelectedStudentId((current) => current ?? dashboardJson.data.items[0]?.studentUserId ?? null);
    }

    if (pendingJson.ok) {
      setPendingQueue(pendingJson.data.items);
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      setItems([]);
      setPendingQueue([]);
      setSelectedStudentId(null);
      return;
    }

    void refresh();
  }, [isEnabled, refresh]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, TEACHER_DASHBOARD_POLLING_MS);

    return () => window.clearInterval(timer);
  }, [isEnabled, refresh]);

  const pendingByStudentId = useMemo(() => {
    return new Map(pendingQueue.map((item) => [item.studentUserId, item]));
  }, [pendingQueue]);

  const itemByStudentId = useMemo(() => {
    return new Map(items.map((item) => [item.studentUserId, item]));
  }, [items]);

  const students = useMemo<PrototypeStudentState[]>(() => {
    return items.map((item) => {
      const pending = pendingByStudentId.get(item.studentUserId);
      const questionStatus =
        item.questionStatus === "PENDING" || item.questionStatus === "ACCEPTED"
          ? item.questionStatus
          : "NONE";

      return {
        id: item.studentUserId,
        studentName: item.studentName,
        sessionId: null,
        isEntered: item.currentStatus !== "NONE",
        connectionStatus: toPrototypeConnectionStatus(item.currentStatus),
        cameraStatus: item.cameraStatus ?? "OFF",
        micPolicy: item.currentStatus === "QUESTION_ROOM" ? "OPEN" : "MUTED_LOCKED",
        enteredAt: item.startedAt,
        cameraWarningStartedAt: null,
        questionStatus,
        questionRequestedAt: null,
        questionAcceptedAt: null,
        questionEndedToast: null,
        lastHeartbeatAt: null,
        autoExitReason: null,
        todayStudySeconds: item.todayStudySeconds,
        questionQueueOrder: pending?.queuePosition ?? null,
      };
    });
  }, [items, pendingByStudentId]);

  const acceptQuestion = useCallback(
    async (studentId: string) => {
      if (!isEnabled) {
        return;
      }

      const questionId = itemByStudentId.get(studentId)?.questionId ?? pendingByStudentId.get(studentId)?.id;

      if (!questionId) {
        return;
      }

      const response = await fetch(`/api/study-lab/questions/${questionId}/accept`, {
        method: "POST",
        headers: await getStudyLabAuthHeaders(TEACHER_DEV_AUTH),
      });
      const json = (await response.json()) as ApiResponse<unknown>;

      if (json.ok) {
        await refresh();
      }
    },
    [isEnabled, itemByStudentId, pendingByStudentId, refresh],
  );

  const completeQuestion = useCallback(
    async (studentId: string) => {
      if (!isEnabled) {
        return;
      }

      const questionId = itemByStudentId.get(studentId)?.questionId;

      if (!questionId) {
        return;
      }

      const response = await fetch(`/api/study-lab/questions/${questionId}/complete`, {
        method: "POST",
        headers: {
          ...(await getStudyLabAuthHeaders(TEACHER_DEV_AUTH)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "TEACHER_COMPLETE" }),
      });
      const json = (await response.json()) as ApiResponse<unknown>;

      if (json.ok) {
        await refresh();
      }
    },
    [isEnabled, itemByStudentId, refresh],
  );

  return {
    students,
    selectedStudentId,
    setSelectedStudentId,
    getStudentStream: () => null,
    getStudentPreview: () => null,
    acceptQuestion,
    completeQuestion,
  };
}

function toPrototypeConnectionStatus(status: TeacherDashboardItemDto["currentStatus"]): PrototypeConnectionStatus {
  switch (status) {
    case "MAIN_ROOM":
    case "QUESTION_PENDING":
    case "QUESTION_ROOM":
      return status;
    default:
      return "IDLE";
  }
}
