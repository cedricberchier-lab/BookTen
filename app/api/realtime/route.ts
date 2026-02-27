import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { error: "Realtime provider not configured" },
    { status: 501 }
  );
}
