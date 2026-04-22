"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAIN_STUDY_ROOM_LABEL, QUESTION_ROOM_LABEL } from "../constants/room-labels";
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
  activeStudentCount: number;
  cameraOffSeconds: number;
  stream: MediaStream | null;
  isGuideOpen: boolean;
  permissionMessage: string | null;
  questionStatus: StudentQuestionStatus;
  questionEndedToast: string | null;
  autoExitReason: string | null;
  isQuestionActionEnabled?: boolean;
  isCameraActionPending?: boolean;
  isQuestionSubmitting?: boolean;
  isQuestionCanceling?: boolean;
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

type CameraDisplayMode = "portrait" | "landscape";

const CAMERA_DISPLAY_MODE_STORAGE_PREFIX = "study-lab.student-camera-display";
const DAILY_PLEDGE_STORAGE_PREFIX = "study-lab.student-daily-pledge";
const DAILY_PLEDGE_MAX_LENGTH = 40;

export function StudentDashboard(props: StudentDashboardProps) {
  const preferenceKey = useMemo(() => {
    const normalizedName = props.studentName.trim().toLowerCase();
    return encodeURIComponent(normalizedName || "student");
  }, [props.studentName]);
  const displayModeStorageKey = `${CAMERA_DISPLAY_MODE_STORAGE_PREFIX}:${preferenceKey}`;
  const pledgeStorageKey = `${DAILY_PLEDGE_STORAGE_PREFIX}:${preferenceKey}`;
  const [displayMode, setDisplayMode] = useState<CameraDisplayMode>("portrait");
  const [pledgeText, setPledgeText] = useState("");
  const [isEditingPledge, setIsEditingPledge] = useState(false);
  const pledgeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const roomLabel =
    props.connectionStatus === "QUESTION_ROOM" ? QUESTION_ROOM_LABEL : MAIN_STUDY_ROOM_LABEL;
  const cameraTone = props.cameraStatus === "ON" ? "good" : "warn";
  const companionCount = Math.max(props.activeStudentCount - 1, 0);
  const footerText = props.isEntered
    ? `함께 공부중인 학생: ${companionCount}명`
    : "카메라 미리보기";
  const trimmedPledgeText = pledgeText.trim();
  const formattedStudyClock = formatStudyClock(props.studySeconds);

  useEffect(() => {
    const savedDisplayMode = window.localStorage.getItem(displayModeStorageKey);
    const savedPledgeText = window.localStorage.getItem(pledgeStorageKey);

    setDisplayMode(savedDisplayMode === "landscape" ? "landscape" : "portrait");
    setPledgeText(savedPledgeText ?? "");
    setIsEditingPledge(false);
  }, [displayModeStorageKey, pledgeStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(displayModeStorageKey, displayMode);
  }, [displayMode, displayModeStorageKey]);

  useEffect(() => {
    if (!trimmedPledgeText) {
      window.localStorage.removeItem(pledgeStorageKey);
      return;
    }

    window.localStorage.setItem(pledgeStorageKey, pledgeText);
  }, [pledgeStorageKey, pledgeText, trimmedPledgeText]);

  useEffect(() => {
    if (!isEditingPledge) {
      return;
    }

    pledgeInputRef.current?.focus();
  }, [isEditingPledge]);

  function handlePledgeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsEditingPledge(false);
  }

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

      <div className="student-layout">
        <div className="student-primary">
          <div className="metric-row metric-row-student">
            <MetricCard label="상태" value={formatConnectionStatus(props.connectionStatus)} />
            <MetricCard label="오늘" value={formatDuration(props.studySeconds)} />
            <MetricCard label="질문" value={formatQuestionStatus(props.questionStatus)} />
          </div>

          <div className="student-video-bar">
            <div className="student-video-segmented" role="group" aria-label="카메라 화면 전환">
              <button
                className="student-video-segment"
                data-active={displayMode === "portrait"}
                onClick={() => setDisplayMode("portrait")}
                type="button"
              >
                세로
              </button>
              <button
                className="student-video-segment"
                data-active={displayMode === "landscape"}
                onClick={() => setDisplayMode("landscape")}
                type="button"
              >
                가로
              </button>
            </div>
          </div>

          <div className={`student-video-frame student-video-frame--${displayMode}`}>
            <LiveVideoTile
              title="카메라"
              subtitle="카메라 미리보기"
              stream={props.stream}
              mirrored
              tone={cameraTone}
              statusText={props.cameraStatus === "ON" ? "실시간" : "꺼짐"}
              className={`student-video-shell student-video-shell--${displayMode}`}
              footerText={footerText}
              overlayContent={
                <>
                  <div className="student-video-clock">{formattedStudyClock}</div>

                  <div className="student-video-pledge-shell">
                    {isEditingPledge ? (
                      <form className="student-video-pledge-form" onSubmit={handlePledgeSubmit}>
                        <label className="student-video-pledge-label" htmlFor="student-daily-pledge">
                          오늘의 각오
                        </label>
                        <textarea
                          ref={pledgeInputRef}
                          id="student-daily-pledge"
                          className="student-video-pledge-input"
                          rows={3}
                          maxLength={DAILY_PLEDGE_MAX_LENGTH}
                          placeholder="여기를 눌러서 오늘의 각오를 입력하세요"
                          value={pledgeText}
                          onChange={(event) => setPledgeText(event.target.value)}
                        />
                        <div className="student-video-pledge-actions">
                          <span>{trimmedPledgeText.length}/{DAILY_PLEDGE_MAX_LENGTH}</span>
                          <button className="student-video-action-button" type="submit">
                            완료
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        className="student-video-pledge-display"
                        onClick={() => setIsEditingPledge(true)}
                        type="button"
                      >
                        <span className="student-video-pledge-label">오늘의 각오</span>
                        <strong data-empty={!trimmedPledgeText}>
                          {trimmedPledgeText || "여기를 눌러서 오늘의 각오를 입력하세요"}
                        </strong>
                      </button>
                    )}
                  </div>
                </>
              }
            />
          </div>
        </div>

        <div className="student-secondary">
          {!props.isEntered ? (
            <div className="button-row">
              <button className="button-primary" onClick={props.onOpenGuide} type="button">
                입장
              </button>
            </div>
          ) : (
            <>
              <div className="button-row">
                <button className="button-primary" onClick={props.onExit} type="button">
                  나가기
                </button>
                {props.cameraStatus === "ON" ? (
                  <button
                    className="button-secondary"
                    disabled={props.isCameraActionPending}
                    onClick={props.onTurnCameraOff}
                    type="button"
                  >
                    {props.isCameraActionPending ? "카메라 끄는 중" : "카메라 끄기"}
                  </button>
                ) : (
                  <button
                    className="button-primary"
                    disabled={props.isCameraActionPending}
                    onClick={props.onTurnCameraOnAgain}
                    type="button"
                  >
                    {props.isCameraActionPending ? "카메라 켜는 중" : "카메라 켜기"}
                  </button>
                )}
                {props.isQuestionActionEnabled !== false &&
                props.questionStatus === "NONE" &&
                props.connectionStatus === "MAIN_ROOM" ? (
                  <button
                    className="button-secondary"
                    disabled={props.isQuestionSubmitting}
                    onClick={props.onRequestQuestion}
                    type="button"
                  >
                    {props.isQuestionSubmitting ? "질문 보내는 중" : "질문"}
                  </button>
                ) : null}
                {props.isQuestionActionEnabled !== false && props.questionStatus === "PENDING" ? (
                  <button
                    className="button-danger"
                    disabled={props.isQuestionCanceling}
                    onClick={props.onCancelQuestion}
                    type="button"
                  >
                    {props.isQuestionCanceling ? "질문 취소 중" : "취소"}
                  </button>
                ) : null}
              </div>
              <p className="subtle action-support-copy">
                질문은 담당 선생님이 스터디 카페에 들어와 있을 때만 받을 수 있습니다. 응답이
                없으면 담당 선생님께 먼저 연락해 주세요.
              </p>
            </>
          )}

          <div className="student-notices">
            {props.connectionStatus === "QUESTION_PENDING" ? (
              <div className="banner" data-tone="warn">
                선생님 응답 대기 중입니다.
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
                  <button
                    className="button-secondary"
                    onClick={props.onDismissQuestionToast}
                    type="button"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : null}

            {props.autoExitReason ? (
              <div className="banner" data-tone="danger">
                <div className="banner-row">
                  <span>{props.autoExitReason}</span>
                  <button
                    className="button-secondary"
                    onClick={props.onClearAutoExitReason}
                    type="button"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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

function formatStudyClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":");
}
