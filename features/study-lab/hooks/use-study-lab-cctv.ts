"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface PreviewFrameMessage {
  type: "preview_frame";
  studentId: string;
  imageSrc: string;
  capturedAt: number;
}

interface PreviewClearMessage {
  type: "preview_clear";
  studentId: string;
}

type StudyLabPreviewMessage = PreviewFrameMessage | PreviewClearMessage;

export interface StudyLabCctvPreview {
  imageSrc: string;
  updatedAt: number;
}

interface UseStudyLabCctvOptions {
  broadcasterStudentId: string | null;
  broadcasterStream: MediaStream | null;
  isBroadcastEnabled: boolean;
}

const CHANNEL_NAME = "study-lab-cctv-preview";
const CAPTURE_INTERVAL_MS = 1_500;
const PREVIEW_STALE_AFTER_MS = 15_000;

export function useStudyLabCctv(options: UseStudyLabCctvOptions) {
  const [previewMap, setPreviewMap] = useState<Record<string, StudyLabCctvPreview>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<StudyLabPreviewMessage>) => {
      const message = event.data;

      if (!message?.type || !message.studentId) {
        return;
      }

      if (message.type === "preview_frame") {
        setPreviewMap((current) => ({
          ...current,
          [message.studentId]: {
            imageSrc: message.imageSrc,
            updatedAt: message.capturedAt,
          },
        }));
        return;
      }

      setPreviewMap((current) => {
        const next = { ...current };
        delete next[message.studentId];
        return next;
      });
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const staleSweep = window.setInterval(() => {
      setPreviewMap((current) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, StudyLabCctvPreview> = {};

        for (const [studentId, preview] of Object.entries(current)) {
          if (now - preview.updatedAt <= PREVIEW_STALE_AFTER_MS) {
            next[studentId] = preview;
            continue;
          }

          changed = true;
        }

        return changed ? next : current;
      });
    }, 5_000);

    return () => window.clearInterval(staleSweep);
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    const studentId = options.broadcasterStudentId;

    if (!channel || !studentId) {
      return;
    }

    if (!options.isBroadcastEnabled || !options.broadcasterStream) {
      channel.postMessage({
        type: "preview_clear",
        studentId,
      } satisfies PreviewClearMessage);
      return;
    }

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let isDisposed = false;

    if (!context) {
      return;
    }

    video.srcObject = options.broadcasterStream;
    video.muted = true;
    video.playsInline = true;

    const startPlayback = async () => {
      try {
        await video.play();
      } catch {
        return;
      }

      if (isDisposed) {
        return;
      }

      pushFrame();
      const timer = window.setInterval(pushFrame, CAPTURE_INTERVAL_MS);

      cleanup = () => {
        window.clearInterval(timer);
        channel.postMessage({
          type: "preview_clear",
          studentId,
        } satisfies PreviewClearMessage);
        video.pause();
        video.srcObject = null;
      };
    };

    let cleanup = () => {
      channel.postMessage({
        type: "preview_clear",
        studentId,
      } satisfies PreviewClearMessage);
      video.pause();
      video.srcObject = null;
    };

    const pushFrame = () => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      channel.postMessage({
        type: "preview_frame",
        studentId,
        imageSrc: canvas.toDataURL("image/jpeg", 0.7),
        capturedAt: Date.now(),
      } satisfies PreviewFrameMessage);
    };

    void startPlayback();

    return () => {
      isDisposed = true;
      cleanup();
    };
  }, [options.broadcasterStudentId, options.broadcasterStream, options.isBroadcastEnabled]);

  const getPreview = useMemo(() => {
    return (studentId: string) => previewMap[studentId] ?? null;
  }, [previewMap]);

  return {
    previewMap,
    getPreview,
  };
}
