import { NextResponse } from "next/server";
import { mutateStudyLabPrototypeState } from "@/features/study-lab/server/prototype-store";
import type { PrototypeAction } from "@/features/study-lab/types/prototype";

const ALLOWED_ACTIONS = new Set<PrototypeAction>([
  "enter",
  "exit",
  "camera_on",
  "camera_off",
  "heartbeat",
  "request_question",
  "cancel_question",
  "accept_question",
  "complete_question",
  "dismiss_question_toast",
  "clear_auto_exit_reason",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      studentId?: string | null;
    };

    if (!body.action || !ALLOWED_ACTIONS.has(body.action as PrototypeAction)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_ACTION",
            message: "Unsupported prototype action.",
          },
        },
        { status: 422 },
      );
    }

    const state = mutateStudyLabPrototypeState(body.action as PrototypeAction, {
      studentId: body.studentId,
    });

    return NextResponse.json(
      {
        ok: true,
        data: state,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_BODY",
          message: "Could not read prototype action body.",
        },
      },
      { status: 400 },
    );
  }
}
