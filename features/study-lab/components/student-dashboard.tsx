"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAIN_STUDY_ROOM_LABEL } from "../constants/room-labels";
import type { ActiveStudentTileDto } from "../types/dto";
import { LiveVideoTile } from "./live-video-tile";

export type StudentConnectionStatus =
  | "IDLE"
  | "MAIN_ROOM"
  | "QUESTION_PENDING"
  | "QUESTION_ROOM"
  | "EXITED"
  | "DISCONNECTED";

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
  autoExitReason: string | null;
  isCameraActionPending?: boolean;
  isPreparingCamera?: boolean;
  isEntering?: boolean;
  onPrepareCameraPreview: () => Promise<void>;
  onStopCameraPreview: () => void;
  onRequestCameraAndEnter: () => Promise<void>;
  onExit: () => void;
  onTurnCameraOff: () => void;
  onTurnCameraOnAgain: () => Promise<void>;
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

  const roomLabel = MAIN_STUDY_ROOM_LABEL;
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
  const visibleCompanions = props.activeStudents.slice(0, MAX_VISIBLE_COMPANIONS);
  const hiddenCompanionCount = Math.max(
    props.activeStudents.length - visibleCompanions.length,
    0,
  );

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
            <span>
              {trimmedPledgeText.length}/{DAILY_PLEDGE_MAX_LENGTH}
            </span>
            <button className="student-video-action-button" type="submit">
              완료
            </button>
          </div>
        </form>
      );
    }

    return (
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
    <section className="panel student-panel" data-display-mode={displayMode}>
      <div className="panel-head">
        <div className="panel-head-copy">
          <h2 className="panel-title">
            {props.isEntered ? roomLabel : "메인룸 입장 준비"}
          </h2>
          {props.isEntered ? (
            <p className="subtle">
              내 화면을 확인하면서 함께 공부 중인 학생 화면도 볼 수 있습니다.
            </p>
          ) : null}
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
        <div className={`student-prep-shell student-prep-shell--${displayMode}`}>
          <div className={`student-video-frame student-video-frame--${displayMode}`}>
            {renderStudentVideoTile({
              title: "카메라 화면",
              subtitle: "",
              tone: props.hasPreviewStream ? "good" : "warn",
              statusText: props.hasPreviewStream ? "미리보기" : "대기",
              footerText: "",
            })}
          </div>

          <div className="student-control-row">
            {props.hasPreviewStream ? (
              <>
                <button
                  className="button-secondary"
                  onClick={props.onStopCameraPreview}
                  type="button"
                >
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
            autoExitReason={props.autoExitReason}
            onClearAutoExitReason={props.onClearAutoExitReason}
          />
        </div>
      ) : (
        <div className={`student-room-shell student-room-shell--${displayMode}`}>
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

            <button className="button-primary" onClick={props.onExit} type="button">
              퇴실
            </button>
          </div>

          <NoticeStack
            permissionMessage={props.permissionMessage}
            cameraStatus={props.cameraStatus}
            cameraOffSeconds={props.cameraOffSeconds}
            autoExitReason={props.autoExitReason}
            onClearAutoExitReason={props.onClearAutoExitReason}
          />

          <div className="student-room-main">
            <div className={`student-video-frame student-video-frame--${displayMode}`}>
              <div className={`student-video-main-wrap student-video-main-wrap--${displayMode}`}>
                {renderStudentVideoTile({
                  title: "카메라 화면",
                  subtitle: "",
                  tone: cameraTone,
                  statusText: props.cameraStatus === "ON" ? "실시간" : "꺼짐",
                  footerText: `함께 공부 중 ${Math.max(props.activeStudentCount, 1)}명`,
                })}
              </div>
            </div>
          </div>

          <div className={`student-cctv-section student-cctv-section--${displayMode}`}>
            <div className="student-cctv-head">
              <h3 className="student-section-title">함께 공부 중인 학생</h3>
              <span className="pill" data-tone={visibleCompanions.length > 0 ? "good" : "warn"}>
                {props.activeStudents.length}명
              </span>
            </div>

            {visibleCompanions.length > 0 ? (
              <div className={`student-cctv-grid student-cctv-grid--${displayMode}`}>
                {visibleCompanions.map((student) => (
                  <CompanionTile
                    key={student.userId}
                    student={student}
                    displayMode={displayMode}
                  />
                ))}
                {hiddenCompanionCount > 0 ? (
                  <article
                    className={`student-cctv-tile student-cctv-tile--summary student-cctv-tile--${displayMode}`}
                  >
                    <div className="student-cctv-screen student-cctv-screen--summary">
                      <strong>+{hiddenCompanionCount}</strong>
                      <span>더 공부 중</span>
                    </div>
                  </article>
                ) : null}
              </div>
            ) : (
              <div className="student-cctv-empty">
                현재 메인룸에 함께 공부 중인 다른 학생이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function NoticeStack(props: {
  permissionMessage: string | null;
  cameraStatus?: "ON" | "OFF";
  cameraOffSeconds?: number;
  autoExitReason: string | null;
  onClearAutoExitReason: () => void;
}) {
  return (
    <div className="student-notices">
      {props.permissionMessage ? (
        <div className="banner" data-tone="danger">
          {props.permissionMessage}
        </div>
      ) : null}

      {props.cameraStatus === "OFF" && props.cameraOffSeconds ? (
        <div className="banner" data-tone="danger">
          카메라가 {formatDuration(props.cameraOffSeconds)} 동안 꺼져 있습니다.
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

function CompanionTile(props: {
  student: ActiveStudentTileDto;
  displayMode: CameraDisplayMode;
}) {
  return (
    <article className={`student-cctv-tile student-cctv-tile--${props.displayMode}`}>
      <div className={`student-cctv-screen student-cctv-screen--${props.displayMode}`}>
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
    case "EXITED":
      return "퇴실";
    case "DISCONNECTED":
      return "연결 끊김";
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
