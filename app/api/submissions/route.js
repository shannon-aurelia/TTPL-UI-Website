import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Website report uploads have been retired. Submit reports through EMAS3.",
    },
    { status: 410 },
  );
}
