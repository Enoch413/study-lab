"use client";

import { useMemo, useState } from "react";
import type { StudyLabCctvPreview } from "../hooks/use-study-lab-cctv";
import type { TeacherDashboardItemDto } from "../types/dto";
import { LiveVideoTile } from "./live-video-tile";

interface TeacherDashboardProps {
  items: TeacherDashboardItemDto[];
  selectedStudentId: string | null;
  getStudentStream: (studentId: string) => MediaStream | null;
  getStudentPreview: (studentId: string) => StudyLabCctvPreview | null;
  onFocusStudent: (studentId: string) => void;
}

export function TeacherDashboard(props: TeacherDashboardProps) {
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const filteredItems = useMemo(() => {
    return props.items.filter((item) => {
      if (onlyActive && item.currentStatus === "NONE") {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      return item.studentName.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [onlyActive, props.items, search]);

  const liveCount = props.items.filter((item) => item.currentStatus !== "NONE").length;
  const cameraOnCount = props.items.filter((item) => item.cameraStatus === "ON").length;
  const cameraOffCount = Math.max(liveCount - cameraOnCount, 0);

  return (
    <section className="panel teacher-panel">
      <div className="panel-head">
        <div className="panel-head-copy">
          <h2 className="panel-title">대시보드</h2>
        </div>
        <span className="pill" data-tone={liveCount > 0 ? "good" : "warn"}>
          입장 {liveCount}
        </span>
      </div>

      <div className="metric-row metric-row-teacher">
        <MetricCard label="전체" value={String(props.items.length)} />
        <MetricCard label="입장" value={String(liveCount)} />
        <MetricCard label="카메라 ON" value={String(cameraOnCount)} />
        <MetricCard label="카메라 OFF" value={String(cameraOffCount)} />
      </div>

      <div className="teacher-tools">
        <input
          className="search-input"
          placeholder="학생 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          className="button-secondary"
          type="button"
          onClick={() => setOnlyActive((current) => !current)}
        >
          {onlyActive ? "전체" : "입장만"}
        </button>
      </div>

      <div className="roster-grid">
        {filteredItems.map((item) => {
          const isFocused = props.selectedStudentId === item.studentUserId;
          const stream = props.getStudentStream(item.studentUserId);
          const preview = props.getStudentPreview(item.studentUserId);

          return (
            <article
              key={item.studentUserId}
              className="tile student-tile"
              data-focused={isFocused}
            >
              <LiveVideoTile
                title={item.studentName}
                subtitle="미리보기"
                stream={stream}
                imageSrc={preview?.imageSrc ?? null}
                tone={item.cameraStatus === "ON" ? "good" : "warn"}
                statusText={item.cameraStatus === "ON" ? "카메라 켜짐" : "카메라 꺼짐"}
                footerText={resolveFooterText(item, !!stream, !!preview)}
              />

              <div className="list" style={{ marginTop: 12 }}>
                <div className="list-item">
                  <span>상태</span>
                  <strong>{formatConnectionStatus(item.currentStatus)}</strong>
                </div>
                <div className="list-item">
                  <span>오늘</span>
                  <strong>{formatDuration(item.todayStudySeconds)}</strong>
                </div>
                <div className="list-item">
                  <span>카메라</span>
                  <strong>{item.cameraStatus === "ON" ? "켜짐" : "꺼짐"}</strong>
                </div>
              </div>

              <div className="button-row">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => props.onFocusStudent(item.studentUserId)}
                >
                  보기
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredItems.length === 0 ? <div className="empty-state">결과 없음</div> : null}
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
  item: TeacherDashboardItemDto,
  hasStream: boolean,
  hasPreview: boolean,
): string {
  if (hasStream) {
    return "실시간";
  }

  if (hasPreview) {
    return "미리보기";
  }

  if (item.currentStatus !== "NONE") {
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

function formatConnectionStatus(status: TeacherDashboardItemDto["currentStatus"]) {
  switch (status) {
    case "MAIN_ROOM":
    case "QUESTION_PENDING":
    case "QUESTION_ROOM":
      return "입장 중";
    case "EXITED":
      return "퇴실";
    case "DISCONNECTED":
      return "연결 끊김";
    default:
      return "준비";
  }
}
