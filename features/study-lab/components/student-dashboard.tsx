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
  const cameraTone = props.cameraStatus === "ON" ? "good" : "warn";

  return (
    <section className="panel student-panel">
      <div className="panel-head">
        <div className="panel-head-copy">
          <h2 className="panel-title">{roomLabel}</h2>
        </div>
        <span className="pill" data-tone={cameraTone}>
          {props.cameraStatus === "ON" ? "카메라 켜짐" : "카메라 꺼짐"}
        </span>
      </div>

      <div className="metric-row metric-row-student">
        <MetricCard label="상태" value={formatConnectionStatus(props.connectionStatus)} />
        <MetricCard label="오늘" value={formatDuration(props.studySeconds)} />
        <MetricCard label="질문" value={formatQuestionStatus(props.questionStatus)} />
      </div>

      <LiveVideoTile
        title="카메라"
        subtitle="카메라 미리보기"
        stream={props.stream}
        mirrored
        tone={cameraTone}
        statusText={props.cameraStatus === "ON" ? "실시간" : "꺼짐"}
      />

      {!props.isEntered ? (
        <div className="button-row">
          <button className="button-primary" onClick={props.onOpenGuide} type="button">
            입장
          </button>
        </div>
      ) : (
        <div className="button-row">
          <button className="button-primary" onClick={props.onExit} type="button">
            나가기
          </button>
          {props.cameraStatus === "ON" ? (
            <button className="button-secondary" onClick={props.onTurnCameraOff} type="button">
              카메라 끄기
            </button>
          ) : (
            <button className="button-primary" onClick={props.onTurnCameraOnAgain} type="button">
              카메라 켜기
            </button>
          )}
          {props.isQuestionActionEnabled !== false &&
          props.questionStatus === "NONE" &&
          props.connectionStatus === "MAIN_ROOM" ? (
            <button className="button-secondary" onClick={props.onRequestQuestion} type="button">
              질문
            </button>
          ) : null}
          {props.isQuestionActionEnabled !== false && props.questionStatus === "PENDING" ? (
            <button className="button-danger" onClick={props.onCancelQuestion} type="button">
              취소
            </button>
          ) : null}
        </div>
      )}

      {props.connectionStatus === "QUESTION_PENDING" ? (
        <div className="banner" data-tone="warn">
          강사 응답 대기 중입니다.
        </div>
      ) : null}

      {props.connectionStatus === "QUESTION_ROOM" ? (
        <div className="banner" data-tone="good">
          1:1 질문 중입니다.
        </div>
      ) : null}

      {props.cameraStatus === "OFF" && props.isEntered ? (
        <div className="banner" data-tone="danger">
          카메라가 {formatDuration(props.cameraOffSeconds)} 동안 꺼져 있습니다.
        </div>
      ) : null}

      {props.questionEndedToast ? (
        <div className="banner" data-tone="good">
          <div className="banner-row">
            <span>{props.questionEndedToast}</span>
            <button className="button-secondary" onClick={props.onDismissQuestionToast} type="button">
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {props.autoExitReason ? (
        <div className="banner" data-tone="danger">
          <div className="banner-row">
            <span>{props.autoExitReason}</span>
            <button className="button-secondary" onClick={props.onClearAutoExitReason} type="button">
              확인
            </button>
          </div>
        </div>
      ) : null}

      {props.isGuideOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="eyebrow">카메라</div>
            <h3>카메라 권한이 필요합니다.</h3>
            {props.permissionMessage ? (
              <div className="banner" data-tone="danger">
                {props.permissionMessage}
              </div>
            ) : null}
            <div className="button-row">
              <button className="button-primary" onClick={props.onRequestCameraAndEnter} type="button">
                허용 후 입장
              </button>
              <button className="button-secondary" onClick={props.onCloseGuide} type="button">
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function formatConnectionStatus(status: StudentDashboardProps["connectionStatus"]) {
  switch (status) {
    case "MAIN_ROOM":
      return "메인룸";
    case "QUESTION_PENDING":
      return "대기";
    case "QUESTION_ROOM":
      return "1:1";
    case "EXITED":
      return "종료";
    case "DISCONNECTED":
      return "오프라인";
    default:
      return "준비";
  }
}

function formatQuestionStatus(status: StudentDashboardProps["questionStatus"]) {
  switch (status) {
    case "PENDING":
      return "대기";
    case "ACCEPTED":
      return "진행";
    case "COMPLETED":
      return "완료";
    case "CANCELED":
      return "취소";
    case "FAILED":
      return "다시";
    default:
      return "없음";
  }
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (minutes > 0) {
    return `${minutes}분`;
  }

  return `${seconds}초`;
}
