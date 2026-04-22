"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAIN_STUDY_ROOM_LABEL, QUESTION_ROOM_LABEL } from "../constants/room-labels";
import type { ActiveStudentTileDto } from "../types/dto";
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
  activeStudents: ActiveStudentTileDto[];
  cameraOffSeconds: number;
  stream: MediaStream | null;
  hasPreviewStream: boolean;
  permissionMessage: string | null;
  questionStatus: StudentQuestionStatus;
  questionEndedToast: string | null;
  autoExitReason: string | null;
  isQuestionActionEnabled?: boolean;
  isCameraActionPending?: boolean;
  isPreparingCamera?: boolean;
  isEntering?: boolean;
  isQuestionSubmitting?: boolean;
  isQuestionCanceling?: boolean;
  onPrepareCameraPreview: () => Promise<void>;
  onStopCameraPreview: () => void;
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
const MAX_VISIBLE_COMPANIONS = 6;

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
  const headerTone = props.isEntered
    ? cameraTone
    : props.hasPreviewStream
      ? "good"
      : props.isPreparingCamera
        ? "warn"
        : "warn";
  const headerLabel = props.isEntered
    ? props.cameraStatus === "ON"
      ? "카메라 켜짐"
      : "카메라 꺼짐"
    : props.hasPreviewStream
      ? "카메라 준비 완료"
      : props.isPreparingCamera
        ? "카메라 확인 중"
        : "입장 전";
  const trimmedPledgeText = pledgeText.trim();
  const formattedStudyClock = formatStudyClock(props.studySeconds);
  const previewFooterText = props.hasPreviewStream
    ? "카메라 위치와 각도를 확인한 뒤 메인룸에 입장하세요."
    : "카메라를 먼저 켜서 화면을 확인하세요.";
  const roomFooterText = `현재 메인룸 인원 ${Math.max(props.activeStudentCount, 1)}명`;
  const visibleCompanions = props.activeStudents.slice(0, MAX_VISIBLE_COMPANIONS);
  const hiddenCompanionCount = Math.max(props.activeStudents.length - visibleCompanions.length, 0);

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

  function renderPledgeCard() {
    if (isEditingPledge) {
      return (
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
      );
    }

    return (
      <button className="student-video-pledge-display" onClick={() => setIsEditingPledge(true)} type="button">
        <span className="student-video-pledge-label">오늘의 각오</span>
        <strong data-empty={!trimmedPledgeText}>
          {trimmedPledgeText || "여기를 눌러서 오늘의 각오를 입력하세요"}
        </strong>
      </button>
    );
  }

  function renderCameraOverlay(config: {
    title: string;
    tone: "good" | "warn" | "danger";
    statusText: string;
    footerText: string;
  }) {
    if (displayMode === "landscape") {
      return (
        <div className="student-video-landscape-ui">
          <div className="student-video-landscape-top">
            <span className="pill">{config.title}</span>
            <span className="pill" data-tone={config.tone}>
              {config.statusText}
            </span>
          </div>
          <div className="student-video-landscape-center">{renderPledgeCard()}</div>
          <div className="student-video-landscape-bottom">
            <div className="student-video-landscape-footer">{config.footerText}</div>
            <div className="student-video-landscape-clock">{formattedStudyClock}</div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="student-video-clock">{formattedStudyClock}</div>
        <div className="student-video-pledge-shell">{renderPledgeCard()}</div>
      </>
    );
  }

  function renderStudentVideoTile(config: {
    title: string;
    subtitle: string;
    tone: "good" | "warn" | "danger";
    statusText: string;
    footerText: string;
  }) {
    return (
      <LiveVideoTile
        title={config.title}
        subtitle={config.subtitle}
        stream={props.stream}
        mirrored
        tone={config.tone}
        statusText={config.statusText}
        className={`student-video-shell student-video-shell--${displayMode}`}
        footerText={config.footerText}
        overlayContent={renderCameraOverlay(config)}
        hideDefaultChrome={displayMode === "landscape"}
      />
    );
  }

  return (
    <section className="panel student-panel">
      <div className="panel-head">
        <div className="panel-head-copy">
          <h2 className="panel-title">{props.isEntered ? roomLabel : "메인룸 입장 준비"}</h2>
          <p className="subtle">
            {props.isEntered
              ? "내 화면을 크게 확인하고 아래에서 함께 공부 중인 학생들을 확인할 수 있습니다."
              : "카메라를 먼저 켜고 화면 구도와 오늘의 각오를 확인한 뒤 입장하세요."}
          </p>
        </div>
        <span className="pill" data-tone={headerTone}>
          {headerLabel}
        </span>
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

      {!props.isEntered ? (
        <div className="student-prep-shell">
          <div className={`student-video-frame student-video-frame--${displayMode}`}>
            {renderStudentVideoTile({
              title: "내 화면",
              subtitle: "카메라를 켜서 각도와 위치를 먼저 확인하세요.",
              tone: props.hasPreviewStream ? "good" : "warn",
              statusText: props.hasPreviewStream ? "미리보기" : "대기",
              footerText: previewFooterText,
            })}
          </div>

          <div className="student-control-row">
            {props.hasPreviewStream ? (
              <>
                <button className="button-secondary" onClick={props.onStopCameraPreview} type="button">
                  카메라 끄기
                </button>
                <button
                  className="button-primary"
                  disabled={props.isEntering}
                  onClick={props.onRequestCameraAndEnter}
                  type="button"
                >
                  {props.isEntering ? "메인룸 입장 중" : "메인룸 입장"}
                </button>
              </>
            ) : (
              <button
                className="button-primary"
                disabled={props.isPreparingCamera}
                onClick={props.onPrepareCameraPreview}
                type="button"
              >
                {props.isPreparingCamera ? "카메라 준비 중" : "카메라 켜기"}
              </button>
            )}
          </div>

          <NoticeStack
            permissionMessage={props.permissionMessage}
            questionEndedToast={props.questionEndedToast}
            autoExitReason={props.autoExitReason}
            onDismissQuestionToast={props.onDismissQuestionToast}
            onClearAutoExitReason={props.onClearAutoExitReason}
          />
        </div>
      ) : (
        <div className="student-room-shell">
          <div className="student-control-row student-control-row--room">
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
                {props.isQuestionCanceling ? "질문 취소 중" : "질문 취소"}
              </button>
            ) : null}

            <button className="button-primary" onClick={props.onExit} type="button">
              나가기
            </button>
          </div>

          <p className="subtle action-support-copy">
            질문은 담당 선생님이 스터디 카페에 들어와 있을 때만 받을 수 있습니다. 응답이 없으면
            담당 선생님께 먼저 연락해 주세요.
          </p>

          <NoticeStack
            permissionMessage={props.permissionMessage}
            questionStatus={props.questionStatus}
            connectionStatus={props.connectionStatus}
            cameraStatus={props.cameraStatus}
            cameraOffSeconds={props.cameraOffSeconds}
            questionEndedToast={props.questionEndedToast}
            autoExitReason={props.autoExitReason}
            onDismissQuestionToast={props.onDismissQuestionToast}
            onClearAutoExitReason={props.onClearAutoExitReason}
          />

          <div className="student-room-main">
            <div className={`student-video-frame student-video-frame--${displayMode}`}>
              <div className="student-video-main-wrap">
                {renderStudentVideoTile({
                  title: "내 화면",
                  subtitle: "카메라 미리보기",
                  tone: cameraTone,
                  statusText: props.cameraStatus === "ON" ? "실시간" : "꺼짐",
                  footerText: roomFooterText,
                })}
              </div>
            </div>
          </div>

          <div className="student-cctv-section">
            <div className="student-cctv-head">
              <h3 className="student-section-title">함께 공부 중인 학생</h3>
              <span className="pill" data-tone={visibleCompanions.length > 0 ? "good" : "warn"}>
                {props.activeStudents.length}명
              </span>
            </div>

            {visibleCompanions.length > 0 ? (
              <div className="student-cctv-grid">
                {visibleCompanions.map((student) => (
                  <CompanionTile key={student.userId} student={student} />
                ))}
                {hiddenCompanionCount > 0 ? (
                  <article className="student-cctv-tile student-cctv-tile--summary">
                    <div className="student-cctv-screen student-cctv-screen--summary">
                      <strong>+{hiddenCompanionCount}</strong>
                      <span>더 공부 중</span>
                    </div>
                  </article>
                ) : null}
              </div>
            ) : (
              <div className="student-cctv-empty">현재 메인룸에 함께 공부 중인 다른 학생이 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function NoticeStack(props: {
  permissionMessage: string | null;
  questionStatus?: StudentQuestionStatus;
  connectionStatus?: StudentConnectionStatus;
  cameraStatus?: "ON" | "OFF";
  cameraOffSeconds?: number;
  questionEndedToast: string | null;
  autoExitReason: string | null;
  onDismissQuestionToast: () => void;
  onClearAutoExitReason: () => void;
}) {
  return (
    <div className="student-notices">
      {props.permissionMessage ? (
        <div className="banner" data-tone="danger">
          {props.permissionMessage}
        </div>
      ) : null}

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

      {props.cameraStatus === "OFF" && props.cameraOffSeconds ? (
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
  );
}

function CompanionTile(props: { student: ActiveStudentTileDto }) {
  return (
    <article className="student-cctv-tile">
      <div className="student-cctv-screen">
        <span
          className="student-cctv-badge"
          data-tone={props.student.cameraStatus === "ON" ? "good" : "warn"}
        >
          {props.student.cameraStatus === "ON" ? "카메라 켜짐" : "카메라 꺼짐"}
        </span>
        <div className="student-cctv-center-copy">
          {formatCompanionConnection(props.student.connectionStatus)}
        </div>
      </div>
      <div className="student-cctv-footer">
        <strong>{props.student.studentName}</strong>
      </div>
    </article>
  );
}

function formatCompanionConnection(connectionStatus: ActiveStudentTileDto["connectionStatus"]) {
  switch (connectionStatus) {
    case "QUESTION_ROOM":
      return "1:1 질문 중";
    case "QUESTION_PENDING":
      return "질문 대기";
    default:
      return "메인룸";
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
