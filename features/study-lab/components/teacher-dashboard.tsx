"use client";

import { useMemo, useState } from "react";
import type { StudyLabCctvPreview } from "../hooks/use-study-lab-cctv";
import type { PrototypeStudentState } from "../types/prototype";
import { LiveVideoTile } from "./live-video-tile";

interface TeacherDashboardProps {
  students: PrototypeStudentState[];
  selectedStudentId: string | null;
  getStudentStream: (studentId: string) => MediaStream | null;
  getStudentPreview: (studentId: string) => StudyLabCctvPreview | null;
  onFocusStudent: (studentId: string) => void;
  onAcceptQuestion: (studentId: string) => void;
  onCompleteQuestion: (studentId: string) => void;
}

export function TeacherDashboard(props: TeacherDashboardProps) {
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const filteredStudents = useMemo(() => {
    return props.students.filter((student) => {
      if (onlyActive && !student.isEntered) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      return student.studentName.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [onlyActive, props.students, search]);

  const enteredCount = props.students.filter((student) => student.isEntered).length;
  const pendingCount = props.students.filter((student) => student.questionStatus === "PENDING").length;
  const questionRoomCount = props.students.filter((student) => student.questionStatus === "ACCEPTED").length;
  const hasActiveQuestion = questionRoomCount > 0;

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2>강사 현황판</h2>
          <p className="subtle">전체 학생 영상, 공부 시간, 카메라 상태, 질문 흐름을 한 화면에서 확인합니다.</p>
        </div>
        <span className="pill" data-tone={enteredCount > 0 ? "good" : "warn"}>
          {enteredCount > 0 ? `입실 중 ${enteredCount}명` : "현재 입실 학생 없음"}
        </span>
      </div>

      <div className="teacher-summary-grid">
        <div className="metric-card">
          전체 학생
          <strong>{props.students.length}</strong>
        </div>
        <div className="metric-card">
          현재 입실
          <strong>{enteredCount}</strong>
        </div>
        <div className="metric-card">
          질문 대기
          <strong>{pendingCount}</strong>
        </div>
        <div className="metric-card">
          질문 진행 중
          <strong>{questionRoomCount}</strong>
        </div>
      </div>

      <div className="teacher-tools">
        <input
          className="search-input"
          placeholder="학생 이름 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="button-secondary" type="button" onClick={() => setOnlyActive((current) => !current)}>
          {onlyActive ? "전체 보기" : "입실 중만 보기"}
        </button>
      </div>

      <div className="roster-grid">
        {filteredStudents.map((student) => {
          const isFocused = props.selectedStudentId === student.id;
          const stream = props.getStudentStream(student.id);
          const preview = props.getStudentPreview(student.id);
          const isFirstPending = student.questionQueueOrder === 1;

          return (
            <article key={student.id} className="tile student-tile" data-focused={isFocused}>
              <LiveVideoTile
                title={student.studentName}
                subtitle={
                  student.isEntered
                    ? "입실 중이지만 이 브라우저에서는 실시간 스트림이 연결되지 않았습니다."
                    : "아직 입실하지 않은 학생입니다."
                }
                stream={stream}
                imageSrc={preview?.imageSrc ?? null}
                tone={student.cameraStatus === "ON" ? "good" : "warn"}
                statusText={student.cameraStatus === "ON" ? "카메라 켜짐" : "카메라 꺼짐"}
                footerText={
                  stream
                    ? "현재 이 브라우저에서 해당 학생의 실시간 카메라를 보고 있습니다."
                    : preview
                      ? `${formatPreviewAge(preview.updatedAt)} 전에 갱신된 CCTV 미리보기입니다.`
                    : student.questionStatus === "ACCEPTED"
                      ? "질문방이 진행 중이며 영상은 계속 유지되어야 합니다."
                      : "CCTV 영역입니다. 원격 실시간 영상 연결은 다음 구현 단계입니다."
                }
              />

              <div className="list" style={{ marginTop: 12 }}>
                <div className="list-item">
                  <span>현재 상태</span>
                  <strong>{formatConnectionStatus(student.connectionStatus)}</strong>
                </div>
                <div className="list-item">
                  <span>오늘 공부 시간</span>
                  <strong>{formatDuration(student.todayStudySeconds)}</strong>
                </div>
                <div className="list-item">
                  <span>질문 상태</span>
                  <strong>{formatQuestionStatus(student.questionStatus, student.questionQueueOrder)}</strong>
                </div>
                <div className="list-item">
                  <span>마이크</span>
                  <strong>{student.micPolicy === "OPEN" ? "켜짐" : "강제 꺼짐"}</strong>
                </div>
              </div>

              <div className="button-row" style={{ marginTop: 16 }}>
                <button className="button-secondary" type="button" onClick={() => props.onFocusStudent(student.id)}>
                  학생 보기
                </button>
                <button
                  className="button-primary"
                  disabled={!isFirstPending || hasActiveQuestion}
                  type="button"
                  onClick={() => props.onAcceptQuestion(student.id)}
                >
                  질문 수락
                </button>
                <button
                  className="button-secondary"
                  disabled={student.questionStatus !== "ACCEPTED"}
                  type="button"
                  onClick={() => props.onCompleteQuestion(student.id)}
                >
                  질문 종료
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredStudents.length === 0 ? <div className="empty-state">현재 조건에 맞는 학생이 없습니다.</div> : null}

      <div className="banner" data-tone="good">
        강사는 질문 대기 순서대로 수락하며, 학생 영상과 공부 시간을 한눈에 확인할 수 있습니다.
      </div>
    </section>
  );
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}시간 ${minutes}분`;
}

function formatConnectionStatus(status: PrototypeStudentState["connectionStatus"]) {
  switch (status) {
    case "MAIN_ROOM":
      return "전체 공부방";
    case "QUESTION_PENDING":
      return "질문 대기";
    case "QUESTION_ROOM":
      return "1:1 질문방";
    default:
      return "미입실";
  }
}

function formatQuestionStatus(status: PrototypeStudentState["questionStatus"], questionQueueOrder: number | null) {
  switch (status) {
    case "PENDING":
      return questionQueueOrder ? `대기 ${questionQueueOrder}번` : "대기 중";
    case "ACCEPTED":
      return "진행 중";
    default:
      return "없음";
  }
}

function formatPreviewAge(updatedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));

  if (seconds < 60) {
    return `${seconds}초`;
  }

  return `${Math.floor(seconds / 60)}분`;
}
