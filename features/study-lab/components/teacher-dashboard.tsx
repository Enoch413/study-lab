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

  const liveCount = props.students.filter((student) => student.isEntered).length;
  const queueCount = props.students.filter((student) => student.questionStatus === "PENDING").length;
  const activeCount = props.students.filter((student) => student.questionStatus === "ACCEPTED").length;
  const hasActiveQuestion = activeCount > 0;

  return (
    <section className="panel teacher-panel">
      <div className="panel-head">
        <div className="panel-head-copy">
          <div className="eyebrow">강사</div>
          <h2 className="panel-title">대시보드</h2>
        </div>
        <span className="pill" data-tone={liveCount > 0 ? "good" : "warn"}>
          입장 {liveCount}
        </span>
      </div>

      <div className="metric-row metric-row-teacher">
        <MetricCard label="전체" value={String(props.students.length)} />
        <MetricCard label="입장" value={String(liveCount)} />
        <MetricCard label="대기" value={String(queueCount)} />
        <MetricCard label="1:1" value={String(activeCount)} />
      </div>

      <div className="teacher-tools">
        <input
          className="search-input"
          placeholder="학생 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="button-secondary" type="button" onClick={() => setOnlyActive((current) => !current)}>
          {onlyActive ? "전체" : "입장만"}
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
                subtitle="미리보기"
                stream={stream}
                imageSrc={preview?.imageSrc ?? null}
                tone={student.cameraStatus === "ON" ? "good" : "warn"}
                statusText={student.cameraStatus === "ON" ? "카메라 켜짐" : "카메라 꺼짐"}
                footerText={resolveFooterText(student, !!stream, !!preview)}
              />

              <div className="list" style={{ marginTop: 12 }}>
                <div className="list-item">
                  <span>상태</span>
                  <strong>{formatConnectionStatus(student.connectionStatus)}</strong>
                </div>
                <div className="list-item">
                  <span>오늘</span>
                  <strong>{formatDuration(student.todayStudySeconds)}</strong>
                </div>
                <div className="list-item">
                  <span>질문</span>
                  <strong>{formatQuestionStatus(student.questionStatus, student.questionQueueOrder)}</strong>
                </div>
              </div>

              <div className="button-row">
                <button className="button-secondary" type="button" onClick={() => props.onFocusStudent(student.id)}>
                  보기
                </button>
                <button
                  className="button-primary"
                  disabled={!isFirstPending || hasActiveQuestion}
                  type="button"
                  onClick={() => props.onAcceptQuestion(student.id)}
                >
                  수락
                </button>
                <button
                  className="button-secondary"
                  disabled={student.questionStatus !== "ACCEPTED"}
                  type="button"
                  onClick={() => props.onCompleteQuestion(student.id)}
                >
                  종료
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredStudents.length === 0 ? <div className="empty-state">결과 없음</div> : null}
    </section>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{props.label}</div>
      <strong>{props.value}</strong>
    </div>
  );
}

function resolveFooterText(
  student: PrototypeStudentState,
  hasStream: boolean,
  hasPreview: boolean,
): string {
  if (hasStream) {
    return "실시간";
  }

  if (hasPreview) {
    return "미리보기";
  }

  if (student.questionStatus === "ACCEPTED") {
    return "1:1";
  }

  if (student.isEntered) {
    return "온라인";
  }

  return "대기";
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${minutes}분`;
}

function formatConnectionStatus(status: PrototypeStudentState["connectionStatus"]) {
  switch (status) {
    case "MAIN_ROOM":
      return "메인룸";
    case "QUESTION_PENDING":
      return "대기";
    case "QUESTION_ROOM":
      return "1:1";
    default:
      return "준비";
  }
}

function formatQuestionStatus(
  status: PrototypeStudentState["questionStatus"],
  questionQueueOrder: number | null,
) {
  switch (status) {
    case "PENDING":
      return questionQueueOrder ? `${questionQueueOrder}번` : "대기";
    case "ACCEPTED":
      return "진행";
    default:
      return "없음";
  }
}
