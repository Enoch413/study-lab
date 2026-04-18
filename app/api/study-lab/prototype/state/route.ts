import { NextResponse } from "next/server";
import { getStudyLabPrototypeState } from "@/features/study-lab/server/prototype-store";

export async function GET() {
  const state = getStudyLabPrototypeState();

  return NextResponse.json(
    {
      ok: true,
      data: state,
    },
    { status: 200 },
  );
}
