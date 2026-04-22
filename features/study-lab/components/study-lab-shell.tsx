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
  const viewerMetaLabel = firebaseViewer.name ?? firebaseViewer.email;
  const authTone = activeView ? "good" : firebaseViewer.status === "loading" ? "warn" : "danger";
  const authLabel =
    firebaseViewer.status === "loading"
      ? "확인 중"
      : activeView
        ? "연결됨"
        : "로그인 필요";
  const bannerMessage = getVisibleBannerMessage(firebaseViewer.message);
  const statusBadges = (
    <>
      <span className="pill" data-tone={authTone}>
        {authLabel}
      </span>
      <span className="pill" data-tone={activeView ? "good" : "warn"}>
        {formatRoleLabel(firebaseViewer.mappedRole)}
      </span>
    </>
  );

  return (
    <main className="page-shell" data-view={activeView ?? "auth"}>
      <section className="hero-card">
        {viewerMetaLabel ? (
          <div className="hero-top">
            <div className="hero-meta">
              <span className="hero-meta-item">{viewerMetaLabel}</span>
            </div>
            <div className="hero-badges hero-badges-inline">{statusBadges}</div>
          </div>
        ) : (
          <div className="hero-badges">{statusBadges}</div>
        )}

        {bannerMessage ? (
          <div className="banner" data-tone="danger">
            {bannerMessage}
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
            activeStudentCount={studentApi.activeStudentCount}
            activeStudents={studentApi.activeStudents}
            cameraOffSeconds={studentApi.cameraOffSeconds}
            stream={studentApi.stream}
            hasPreviewStream={studentApi.hasPreviewStream}
            permissionMessage={studentApi.permissionMessage}
            autoExitReason={studentApi.autoExitReason}
            isCameraActionPending={studentApi.isCameraUpdating}
            isPreparingCamera={studentApi.isPreparingCamera}
            isEntering={studentApi.isEntering}
            onPrepareCameraPreview={studentApi.requestCameraPreview}
            onStopCameraPreview={studentApi.stopPreviewCamera}
            onRequestCameraAndEnter={studentApi.requestCameraAndEnter}
            onExit={studentApi.exitStudyLab}
            onTurnCameraOff={studentApi.turnCameraOff}
            onTurnCameraOnAgain={studentApi.turnCameraOnAgain}
            onClearAutoExitReason={studentApi.clearAutoExitReason}
          />
        </section>
      ) : (
        <section className="board-grid">
          <TeacherDashboard
            items={teacherApi.items}
            selectedStudentId={teacherApi.selectedStudentId}
            getStudentStream={teacherApi.getStudentStream}
            getStudentPreview={teacherApi.getStudentPreview}
            onFocusStudent={teacherApi.setSelectedStudentId}
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

function getVisibleBannerMessage(message: string | null): string | null {
  const normalizedMessage = String(message ?? "").trim();

  if (!normalizedMessage) {
    return null;
  }

  if (
    normalizedMessage === "로그인이 필요합니다." ||
    normalizedMessage === "CODE LAB 로그인 확인 중입니다."
  ) {
    return null;
  }

  return normalizedMessage;
}
