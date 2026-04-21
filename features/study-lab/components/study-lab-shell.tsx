"use client";

import { useEffect, useMemo, useState } from "react";
import { StudentDashboard } from "./student-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";
import { useStudyLabFirebaseViewer } from "../hooks/use-study-lab-firebase-viewer";
import { useStudyLabStudentApi } from "../hooks/use-study-lab-student-api";
import { useStudyLabTeacherApi } from "../hooks/use-study-lab-teacher-api";
import type { StudyLabMappedRole } from "../types/domain";

type StudyLabViewMode = "student" | "teacher";

const modeLabels: Record<StudyLabViewMode, string> = {
  student: "Student",
  teacher: "Teacher",
};

export function StudyLabShell() {
  const firebaseViewer = useStudyLabFirebaseViewer();
  const studentEnabled = firebaseViewer.mappedRole === "student";
  const teacherEnabled =
    firebaseViewer.mappedRole === "teacher" || firebaseViewer.mappedRole === "admin";
  const studentApi = useStudyLabStudentApi({ enabled: studentEnabled });
  const teacherApi = useStudyLabTeacherApi({ enabled: teacherEnabled });
  const [viewMode, setViewMode] = useState<StudyLabViewMode>("student");

  const availableModes = useMemo<StudyLabViewMode[]>(() => {
    if (firebaseViewer.mappedRole === "student") {
      return ["student"];
    }

    if (firebaseViewer.mappedRole === "teacher" || firebaseViewer.mappedRole === "admin") {
      return ["teacher"];
    }

    return [];
  }, [firebaseViewer.mappedRole]);

  useEffect(() => {
    if (!availableModes.length) {
      return;
    }

    if (!availableModes.includes(viewMode)) {
      setViewMode(availableModes[0]);
    }
  }, [availableModes, viewMode]);

  const viewerName = firebaseViewer.name ?? firebaseViewer.email ?? "Not signed in";
  const authSourceLabel =
    firebaseViewer.status === "loading"
      ? "Checking Firebase session"
      : firebaseViewer.mappedRole
        ? "Firebase session connected"
        : "Firebase sign-in required";
  const roleLabel = formatRoleLabel(firebaseViewer.mappedRole);
  const authDescription = firebaseViewer.mappedRole
    ? "Only the screen allowed by the current Firebase role is shown."
    : "Dev fallback is disabled. Sign in with Firebase and open STUDY CAFE again.";

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="hero-kicker">STUDY LAB</span>
        <div className="hero-grid">
          <div>
            <h1 className="hero-title">Firebase-authenticated study operations</h1>
            <p className="hero-copy">
              Students can enter with camera access, request questions, and return to the main
              room after help is complete. Teachers can manage the current roster and question
              queue from one place.
            </p>
          </div>
          <div className="status-list">
            <div className="status-chip">
              <strong>Auth</strong>
              {authSourceLabel}
            </div>
            <div className="status-chip">
              <strong>Role</strong>
              {roleLabel}
            </div>
            <div className="status-chip">
              <strong>Camera rule</strong>
              Camera access is required before entry and auto-exit applies after 10 minutes off.
            </div>
            <div className="status-chip">
              <strong>Question flow</strong>
              Accepted questions move the student into a 1:1 room, then back to the main room.
            </div>
          </div>
        </div>

        <div className="banner" data-tone={firebaseViewer.message ? "danger" : "good"}>
          {firebaseViewer.message
            ? `${authDescription} Current status: ${firebaseViewer.message}`
            : authDescription}
        </div>

        <div className="toolbar">
          {availableModes.length === 1 ? (
            <div className="mode-switch">
              <button type="button" data-active="true">
                {modeLabels[availableModes[0]]}
              </button>
            </div>
          ) : (
            <div className="mode-switch">
              <button type="button" data-active="true">
                Access pending
              </button>
            </div>
          )}

          <div className="control-strip">
            <div className="status-chip">
              <strong>User</strong>
              {viewerName}
              {firebaseViewer.email ? ` (${firebaseViewer.email})` : ""}
            </div>
            <p className="subtle small">
              Students are auto-mapped from Firebase sign-in. Teachers and admins depend on
              `role=admin` with the appropriate `adminScope`.
            </p>
          </div>
        </div>
      </section>

      {!availableModes.length ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Access is not ready yet.</h2>
          <p className="subtle">
            Sign in with Firebase first. Teacher access requires `role=admin` and either
            `adminScope=assigned` or `adminScope=all`.
          </p>
        </section>
      ) : (
        <section className="board-grid" data-layout="single">
          {viewMode === "student" ? (
            <StudentDashboard
              studentName={viewerName}
              isEntered={studentApi.isEntered}
              connectionStatus={studentApi.connectionStatus}
              cameraStatus={studentApi.cameraStatus}
              micPolicy={studentApi.micPolicy}
              studySeconds={studentApi.studySeconds}
              cameraOffSeconds={studentApi.cameraOffSeconds}
              stream={studentApi.stream}
              isGuideOpen={studentApi.isGuideOpen}
              permissionMessage={studentApi.permissionMessage}
              questionStatus={studentApi.questionStatus}
              questionEndedToast={studentApi.questionEndedToast}
              autoExitReason={studentApi.autoExitReason}
              isQuestionActionEnabled
              onOpenGuide={studentApi.openGuide}
              onCloseGuide={studentApi.closeGuide}
              onRequestCameraAndEnter={studentApi.requestCameraAndEnter}
              onExit={studentApi.exitStudyLab}
              onTurnCameraOff={studentApi.turnCameraOff}
              onTurnCameraOnAgain={studentApi.turnCameraOnAgain}
              onRequestQuestion={studentApi.requestQuestion}
              onCancelQuestion={studentApi.cancelQuestion}
              onDismissQuestionToast={studentApi.dismissQuestionToast}
              onClearAutoExitReason={studentApi.clearAutoExitReason}
            />
          ) : null}

          {viewMode === "teacher" ? (
            <TeacherDashboard
              students={teacherApi.students}
              selectedStudentId={teacherApi.selectedStudentId}
              getStudentStream={teacherApi.getStudentStream}
              getStudentPreview={teacherApi.getStudentPreview}
              onFocusStudent={teacherApi.setSelectedStudentId}
              onAcceptQuestion={teacherApi.acceptQuestion}
              onCompleteQuestion={teacherApi.completeQuestion}
            />
          ) : null}
        </section>
      )}
    </main>
  );
}

function formatRoleLabel(role: StudyLabMappedRole | null): string {
  switch (role) {
    case "student":
      return "Student";
    case "teacher":
      return "Teacher";
    case "admin":
      return "Admin";
    default:
      return "Pending";
  }
}
