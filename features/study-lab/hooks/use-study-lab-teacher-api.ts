"use client";

import { useCallback, useEffect, useState } from "react";
import { TEACHER_DASHBOARD_POLLING_MS } from "../constants/polling";
import {
  getStudyLabAuthHeaders,
  type StudyLabDevAuthUser,
} from "../client/study-lab-auth-headers";
import type { TeacherDashboardApiResponse } from "../types/api";
import type { TeacherDashboardItemDto } from "../types/dto";

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
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isEnabled) {
      return;
    }

    const response = await fetch("/api/study-lab/dashboard/teacher", {
      cache: "no-store",
      headers: await getStudyLabAuthHeaders(TEACHER_DEV_AUTH),
    });
    const json = (await response.json()) as TeacherDashboardApiResponse;

    if (json.ok) {
      setItems(json.data.items);
      setSelectedStudentId((current) => current ?? json.data.items[0]?.studentUserId ?? null);
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      setItems([]);
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

  return {
    items,
    selectedStudentId,
    setSelectedStudentId,
    getStudentStream: () => null,
    getStudentPreview: () => null,
  };
}
