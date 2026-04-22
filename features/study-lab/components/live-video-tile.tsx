"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface LiveVideoTileProps {
  title: string;
  subtitle: string;
  stream: MediaStream | null;
  imageSrc?: string | null;
  mirrored?: boolean;
  tone?: "good" | "warn" | "danger";
  statusText: string;
  footerText?: string | null;
  className?: string;
  overlayContent?: ReactNode;
  hideDefaultChrome?: boolean;
}

export function LiveVideoTile({
  title,
  subtitle,
  stream,
  imageSrc = null,
  mirrored = false,
  tone = "good",
  statusText,
  footerText = null,
  className = "",
  overlayContent = null,
  hideDefaultChrome = false,
}: LiveVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellClassName = ["video-shell", className].filter(Boolean).join(" ");

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    if (stream) {
      videoRef.current.srcObject = stream;
    } else {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  return (
    <div className={shellClassName}>
      {stream ? (
        <video ref={videoRef} autoPlay muted playsInline style={{ transform: mirrored ? "scaleX(-1)" : "none" }} />
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt={title}
          className="video-image"
          style={{ transform: mirrored ? "scaleX(-1)" : "none" }}
        />
      ) : (
        <div className="video-placeholder">
          {subtitle}
        </div>
      )}
      {!hideDefaultChrome ? (
        <div className="video-overlay">
          <span className="pill">{title}</span>
          <span className="pill" data-tone={tone}>
            {statusText}
          </span>
        </div>
      ) : null}
      {overlayContent ? <div className="video-custom-overlay">{overlayContent}</div> : null}
      {!hideDefaultChrome && footerText ? <div className="video-footer">{footerText}</div> : null}
    </div>
  );
}
