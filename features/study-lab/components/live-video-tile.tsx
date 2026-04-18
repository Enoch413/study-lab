"use client";

import { useEffect, useRef } from "react";

interface LiveVideoTileProps {
  title: string;
  subtitle: string;
  stream: MediaStream | null;
  imageSrc?: string | null;
  mirrored?: boolean;
  tone?: "good" | "warn" | "danger";
  statusText: string;
  footerText?: string | null;
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
}: LiveVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

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
    <div className="video-shell">
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
        <div
          style={{
            minHeight: 240,
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,0.75)",
            padding: 24,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      )}
      <div className="video-overlay">
        <span className="pill">{title}</span>
        <span className="pill" data-tone={tone}>
          {statusText}
        </span>
      </div>
      {footerText ? <div className="video-footer">{footerText}</div> : null}
    </div>
  );
}
