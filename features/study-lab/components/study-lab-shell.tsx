"use client";

import { StudentDashboard } from "./student-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";
import { useStudyLabFirebaseViewer } from "../hooks/use-study-lab-firebase-viewer";
import { useStudyLabStudentApi } from "../hooks/use-study-lab-student-api";
import { useStudyLabTeacherApi } from "../hooks/use-study-lab-teacher-api";
import type { StudyLabMappedRole } from "../types/domain";

type ActiveView = "student" | "teacher" | null;

export function StudyLabShell() {
  const firebaseViewer = useStudyLabFirebaseViewer();
  const activeView = resolveActiveView(firebaseViewer.mappedRole);
  const studentApi = useStudyLabStudentApi({ enabled: activeView === "student" });
  const teacherApi = useStudyLabTeacherApi({ enabled: activeView === "teacher" });

  const viewerName = firebaseViewer.name ?? firebaseViewer.email ?? "로그인 대기";
  const authTone = activeView ? "good" : firebaseViewer.status === "loading" ? "warn" : "danger";
  const authLabel =
    firebaseViewer.status === "loading"
      ? "확인 중"
      : activeView
        ? "연결됨"
        : "로그인 필요";

  return (
    <main className="page-shell" data-view={activeView ?? "auth"}>
      <section className="hero-card">
        <div className="hero-top">
          <h1 className="hero-title">STUDY CAFE</h1>
          <div className="hero-meta">
            <span className="hero-meta-item">{viewerName}</span>
            {firebaseViewer.email ? <span className="hero-meta-item">{firebaseViewer.email}</span> : null}
          </div>
        </div>

        <div className="hero-badges">
          <span className="pill" data-tone={authTone}>
            {authLabel}
          </span>
          <span className="pill" data-tone={activeView ? "good" : "warn"}>
            {formatRoleLabel(firebaseViewer.mappedRole)}
          </span>
        </div>

        {firebaseViewer.message ? (
          <div className="banner" data-tone="danger">
            {firebaseViewer.message}
          </div>
        ) : null}
      </section>

      {!activeView ? (
        <section className="panel">
          <div className="panel-head">
            <div className="panel-head-copy">
              <div className="eyebrow">Access</div>
              <h2 className="panel-title">CODE LAB에서 열어 주세요.</h2>
            </div>
          </div>
        </section>
      ) : activeView === "student" ? (
        <section className="board-grid">
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
        </section>
      ) : (
        <section className="board-grid">
          <TeacherDashboard
            students={teacherApi.students}
            selectedStudentId={teacherApi.selectedStudentId}
            getStudentStream={teacherApi.getStudentStream}
            getStudentPreview={teacherApi.getStudentPreview}
            onFocusStudent={teacherApi.setSelectedStudentId}
            onAcceptQuestion={teacherApi.acceptQuestion}
            onCompleteQuestion={teacherApi.completeQuestion}
          />
        </section>
      )}
    </main>
  );
}

function resolveActiveView(role: StudyLabMappedRole | null): ActiveView {
  if (role === "student") {
    return "student";
  }

  if (role === "teacher" || role === "admin") {
    return "teacher";
  }

  return null;
}

function formatRoleLabel(role: StudyLabMappedRole | null): string {
  switch (role) {
    case "student":
      return "학생";
    case "teacher":
      return "강사";
    case "admin":
      return "관리자";
    default:
      return "대기";
  }
}
