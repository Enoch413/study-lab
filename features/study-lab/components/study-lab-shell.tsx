"use client";

import { StudentDashboard } from "./student-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";
import { useStudyLabCctv } from "../hooks/use-study-lab-cctv";
import { useStudyLabPrototype } from "../hooks/use-study-lab-prototype";

const modeLabels = {
  student: "학생 화면",
  teacher: "강사 화면",
  split: "분할 미리보기",
} as const;

export function StudyLabShell() {
  const prototype = useStudyLabPrototype();
  const cctv = useStudyLabCctv({
    broadcasterStudentId: prototype.selectedStudent?.id ?? null,
    broadcasterStream: prototype.selectedStudentStream,
    isBroadcastEnabled:
      Boolean(prototype.selectedStudent?.isEntered) && prototype.selectedStudent?.cameraStatus === "ON",
  });

  return (
    <main className="page-shell">
      <section className="hero-card">
        <span className="hero-kicker">STUDY LAB 프로토타입</span>
        <div className="hero-grid">
          <div>
            <h1 className="hero-title">카메라 필수 온라인 자습실</h1>
            <p className="hero-copy">
              학생은 카메라를 허용해야만 입실할 수 있습니다. 강사는 전체 학생 영상과 공부 시간, 질문 진행 상태를 한
              화면에서 확인합니다. 질문이 수락되면 학생은 1:1 질문방으로 이동하고, 질문이 끝나면 자동으로 전체 공부방에
              복귀합니다.
            </p>
          </div>
          <div className="status-list">
            <div className="status-chip">
              <strong>카메라 필수</strong>
              카메라 권한을 거부하면 입실할 수 없습니다.
            </div>
            <div className="status-chip">
              <strong>CCTV 현황판</strong>
              강사 화면에서 학생 영상 상태와 공부 시간을 확인합니다.
            </div>
            <div className="status-chip">
              <strong>자동 방 이동</strong>
              질문이 수락되면 학생은 자동으로 1:1 질문방으로 이동합니다.
            </div>
            <div className="status-chip">
              <strong>자동 퇴실 규칙</strong>
              카메라가 10분 이상 꺼져 있으면 자동 퇴실됩니다.
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="mode-switch">
            {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map((mode) => (
              <button
                key={mode}
                type="button"
                data-active={prototype.viewMode === mode}
                onClick={() => prototype.setViewMode(mode)}
              >
                {modeLabels[mode]}
              </button>
            ))}
          </div>
          <div className="control-strip">
            <label className="student-switch">
              <span className="subtle small">테스트 학생</span>
              <select
                value={prototype.selectedStudentId ?? ""}
                onChange={(event) => prototype.setSelectedStudentId(event.target.value)}
              >
                {prototype.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.studentName}
                  </option>
                ))}
              </select>
            </label>
            <p className="subtle small">
              아직 CODE LAB 로그인 연동 전이라, 이 선택창으로 다른 학생 계정을 대신 시뮬레이션합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="board-grid" data-layout={prototype.viewMode === "split" ? "split" : "single"}>
        {(prototype.viewMode === "student" || prototype.viewMode === "split") && prototype.selectedStudent ? (
          <StudentDashboard
            studentName={prototype.selectedStudent.studentName}
            isEntered={prototype.selectedStudent.isEntered}
            connectionStatus={prototype.selectedStudent.connectionStatus}
            cameraStatus={prototype.selectedStudent.cameraStatus}
            micPolicy={prototype.selectedStudent.micPolicy}
            studySeconds={prototype.studySeconds}
            cameraOffSeconds={prototype.cameraOffSeconds}
            stream={prototype.selectedStudentStream}
            isGuideOpen={prototype.isGuideOpen}
            permissionMessage={prototype.permissionMessage}
            questionStatus={prototype.selectedStudent.questionStatus}
            questionEndedToast={prototype.selectedStudent.questionEndedToast}
            autoExitReason={prototype.selectedStudent.autoExitReason}
            onOpenGuide={prototype.openGuide}
            onCloseGuide={prototype.closeGuide}
            onRequestCameraAndEnter={prototype.requestCameraAndEnter}
            onExit={prototype.exitStudyLab}
            onTurnCameraOff={prototype.turnCameraOff}
            onTurnCameraOnAgain={prototype.turnCameraOnAgain}
            onRequestQuestion={prototype.requestQuestion}
            onCancelQuestion={prototype.cancelQuestion}
            onDismissQuestionToast={prototype.dismissQuestionToast}
            onClearAutoExitReason={prototype.clearAutoExitReason}
          />
        ) : null}

        {prototype.viewMode === "teacher" || prototype.viewMode === "split" ? (
          <TeacherDashboard
            students={prototype.students}
            selectedStudentId={prototype.selectedStudentId}
            getStudentStream={prototype.getStudentStream}
            getStudentPreview={cctv.getPreview}
            onFocusStudent={prototype.setSelectedStudentId}
            onAcceptQuestion={prototype.acceptQuestion}
            onCompleteQuestion={prototype.completeQuestion}
          />
        ) : null}
      </section>
    </main>
  );
}
