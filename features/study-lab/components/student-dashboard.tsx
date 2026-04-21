"use client";

import { QUESTION_ROOM_LABEL, MAIN_STUDY_ROOM_LABEL } from "../constants/room-labels";
import { LiveVideoTile } from "./live-video-tile";

export type StudentConnectionStatus =
  | "IDLE"
  | "MAIN_ROOM"
  | "QUESTION_PENDING"
  | "QUESTION_ROOM"
  | "EXITED"
  | "DISCONNECTED";

export type StudentQuestionStatus =
  | "NONE"
  | "PENDING"
  | "ACCEPTED"
  | "COMPLETED"
  | "CANCELED"
  | "FAILED";

interface StudentDashboardProps {
  studentName: string;
  isEntered: boolean;
  connectionStatus: StudentConnectionStatus;
  cameraStatus: "ON" | "OFF";
  micPolicy: "MUTED_LOCKED" | "OPEN";
  studySeconds: number;
  cameraOffSeconds: number;
  stream: MediaStream | null;
  isGuideOpen: boolean;
  permissionMessage: string | null;
  questionStatus: StudentQuestionStatus;
  questionEndedToast: string | null;
  autoExitReason: string | null;
  isQuestionActionEnabled?: boolean;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onRequestCameraAndEnter: () => Promise<void>;
  onExit: () => void;
  onTurnCameraOff: () => void;
  onTurnCameraOnAgain: () => Promise<void>;
  onRequestQuestion: () => void;
  onCancelQuestion: () => void;
  onDismissQuestionToast: () => void;
  onClearAutoExitReason: () => void;
}

export function StudentDashboard(props: StudentDashboardProps) {
  const roomLabel =
    props.connectionStatus === "QUESTION_ROOM" ? QUESTION_ROOM_LABEL : MAIN_STUDY_ROOM_LABEL;

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2>학생 화면</h2>
          <p className="subtle">
            {props.studentName} | {roomLabel}
          </p>
        </div>
        <span className="pill" data-tone={props.cameraStatus === "ON" ? "good" : "warn"}>
          카메라 {props.cameraStatus === "ON" ? "켜짐" : "꺼짐"}
        </span>
      </div>

      <div className="metric-row">
        <div className="metric-card">
          현재 상태
          <strong>{formatConnectionStatus(props.connectionStatus)}</strong>
        </div>
        <div className="metric-card">
          오늘 공부 시간
          <strong>{formatDuration(props.studySeconds)}</strong>
        </div>
        <div className="metric-card">
          마이크 정책
          <strong>{props.micPolicy === "OPEN" ? "질문방에서 켜짐" : "전체방에서 항상 꺼짐"}</strong>
        </div>
      </div>

      <LiveVideoTile
        title="내 영상"
        subtitle="아직 입실 전입니다. 입실하면 이 영역에 카메라 화면이 표시됩니다."
        stream={props.stream}
        mirrored
        tone={props.cameraStatus === "ON" ? "good" : "warn"}
        statusText={props.cameraStatus === "ON" ? "카메라 송출 중" : "카메라 꺼짐"}
        footerText={
          props.connectionStatus === "QUESTION_ROOM"
            ? "질문방에서는 영상이 유지되고 마이크가 자동으로 켜집니다."
            : "전체 공부방에서는 카메라를 유지하고 마이크는 항상 꺼진 상태로 고정됩니다."
        }
      />

      <div className="button-row" style={{ marginTop: 16 }}>
        {!props.isEntered ? (
          <button className="button-primary" onClick={props.onOpenGuide}>
            입실하기
          </button>
        ) : (
          <>
            <button className="button-primary" onClick={props.onExit}>
              퇴실하기
            </button>
            {props.cameraStatus === "ON" ? (
              <button className="button-secondary" onClick={props.onTurnCameraOff}>
                카메라 끄기
              </button>
            ) : (
              <button className="button-primary" onClick={props.onTurnCameraOnAgain}>
                카메라 다시 켜기
              </button>
            )}
            {props.isQuestionActionEnabled !== false &&
            props.questionStatus === "NONE" &&
            props.connectionStatus === "MAIN_ROOM" ? (
              <button className="button-secondary" onClick={props.onRequestQuestion}>
                질문 요청하기
              </button>
            ) : null}
            {props.isQuestionActionEnabled !== false && props.questionStatus === "PENDING" ? (
              <button className="button-danger" onClick={props.onCancelQuestion}>
                질문 요청 취소
              </button>
            ) : null}
          </>
        )}
      </div>

      {props.connectionStatus === "MAIN_ROOM" ? (
        <div className="banner" data-tone="good">
          전체 공부방에서는 마이크가 항상 꺼져 있으며, 카메라는 반드시 켜져 있어야 합니다.
        </div>
      ) : null}

      {props.connectionStatus === "QUESTION_PENDING" ? (
        <div className="banner" data-tone="warn">
          질문 요청이 접수되었습니다. 강사가 수락하면 1:1 질문방으로 자동 이동합니다.
        </div>
      ) : null}

      {props.connectionStatus === "QUESTION_ROOM" ? (
        <div className="banner" data-tone="good">
          현재 1:1 질문방에 있습니다. 영상은 유지되고 마이크가 켜집니다.
        </div>
      ) : null}

      {props.cameraStatus === "OFF" && props.isEntered ? (
        <div className="banner" data-tone="danger">
          카메라가 {formatDuration(props.cameraOffSeconds)} 동안 꺼져 있습니다. 10분이 지나면 자동 퇴실됩니다.
        </div>
      ) : null}

      {props.questionEndedToast ? (
        <div className="banner" data-tone="good">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span>{props.questionEndedToast}</span>
            <button className="button-secondary" onClick={props.onDismissQuestionToast}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {props.autoExitReason ? (
        <div className="banner" data-tone="danger">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <span>{props.autoExitReason}</span>
            <button className="button-secondary" onClick={props.onClearAutoExitReason}>
              확인
            </button>
          </div>
        </div>
      ) : null}

      {props.isGuideOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>입실 전 카메라 안내</h3>
            <p className="subtle">
              STUDY LAB은 입실 전에 카메라 허용이 반드시 필요합니다. 카메라를 거부하면 입실할 수 없습니다.
            </p>
            <ul>
              <li>카메라를 허용해야만 입실할 수 있습니다.</li>
              <li>강사와 관리자는 학생 영상을 CCTV처럼 확인합니다.</li>
              <li>질문방으로 이동해도 영상은 유지되고 마이크는 켜집니다.</li>
              <li>입실 후 카메라가 10분 이상 꺼져 있으면 자동 퇴실됩니다.</li>
            </ul>
            {props.permissionMessage ? (
              <div className="banner" data-tone="danger">
                {props.permissionMessage}
              </div>
            ) : null}
            <div className="button-row" style={{ marginTop: 16 }}>
              <button className="button-primary" onClick={props.onRequestCameraAndEnter}>
                카메라 허용 후 입실
              </button>
              <button className="button-secondary" onClick={props.onCloseGuide}>
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatConnectionStatus(status: StudentDashboardProps["connectionStatus"]) {
  switch (status) {
    case "MAIN_ROOM":
      return "전체 공부방";
    case "QUESTION_PENDING":
      return "질문 대기";
    case "QUESTION_ROOM":
      return "1:1 질문방";
    case "EXITED":
      return "퇴실 완료";
    case "DISCONNECTED":
      return "연결 끊김";
    default:
      return "미입실";
  }
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}시간 ${minutes}분 ${seconds}초`;
}
