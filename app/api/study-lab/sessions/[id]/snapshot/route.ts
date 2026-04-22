import { NextResponse } from "next/server";
import { STUDY_LAB_ERROR_CODES } from "@/features/study-lab/constants/error-codes";
import { createStudyLabRuntime } from "@/features/study-lab/server/services/study-lab-runtime.service";
import {
  createStudyLabError,
  toStudyLabErrorResponse,
} from "@/features/study-lab/server/services/study-lab-error.service";
import { parseSessionIdParam } from "@/features/study-lab/validators/session.validator";

const SNAPSHOT_DATA_URL_PREFIX = "data:image/jpeg;base64,";
const SNAPSHOT_MAX_LENGTH = 300_000;
const SNAPSHOT_MAX_CLOCK_SKEW_MS = 60_000;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { authService, sessionDomain, studySessionSnapshotRepository } =
      createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const { id } = await context.params;
    const sessionId = parseSessionIdParam(id);
    const session = await sessionDomain.getOwnedActiveSessionOrThrow(viewer.userId, sessionId);
    const body = parseSnapshotBody(await request.json());

    const snapshot = await studySessionSnapshotRepository.upsert({
      studySessionId: session.id,
      studentUserId: viewer.userId,
      imageDataUrl: body.imageDataUrl,
      capturedAt: body.capturedAt,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          capturedAt: snapshot.capturedAt.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { authService, sessionDomain, studySessionSnapshotRepository } =
      createStudyLabRuntime();
    const viewer = await authService.requireViewerWithRole(request, ["student"]);
    const { id } = await context.params;
    const sessionId = parseSessionIdParam(id);
    await sessionDomain.getOwnedActiveSessionOrThrow(viewer.userId, sessionId);
    await studySessionSnapshotRepository.deleteBySessionId(sessionId);

    return NextResponse.json(
      {
        ok: true,
        data: {
          deleted: true,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const { status, body } = toStudyLabErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

function parseSnapshotBody(payload: unknown): {
  imageDataUrl: string;
  capturedAt: Date;
} {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Snapshot body must be an object.",
    );
  }

  const body = payload as Record<string, unknown>;

  if (
    typeof body.imageDataUrl !== "string" ||
    !body.imageDataUrl.startsWith(SNAPSHOT_DATA_URL_PREFIX)
  ) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Snapshot must be a JPEG data URL.",
    );
  }

  if (body.imageDataUrl.length > SNAPSHOT_MAX_LENGTH) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "Snapshot image is too large.",
    );
  }

  const capturedAt = parseCapturedAt(body.capturedAt);

  return {
    imageDataUrl: body.imageDataUrl,
    capturedAt,
  };
}

function parseCapturedAt(value: unknown): Date {
  if (value == null) {
    return new Date();
  }

  if (typeof value !== "string") {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "capturedAt must be an ISO date string.",
    );
  }

  const capturedAt = new Date(value);

  if (Number.isNaN(capturedAt.getTime())) {
    throw createStudyLabError(
      STUDY_LAB_ERROR_CODES.VALIDATION_ERROR,
      "capturedAt must be a valid date.",
    );
  }

  const now = Date.now();
  const boundedTime = Math.min(
    Math.max(capturedAt.getTime(), now - SNAPSHOT_MAX_CLOCK_SKEW_MS),
    now + SNAPSHOT_MAX_CLOCK_SKEW_MS,
  );

  return new Date(boundedTime);
}

