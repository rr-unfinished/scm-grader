import { NextResponse } from "next/server";
import { isPracticeType, SOUTH_BAY_CITIES } from "@/lib/practice-types";
import { buildSampleReport } from "@/lib/sample-report";
import type { GradeRequest } from "@/lib/types";

export async function POST(request: Request) {
  let body: Partial<GradeRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the practice details as JSON." }, { status: 400 });
  }

  const practiceName = typeof body.practiceName === "string" ? body.practiceName.trim().slice(0, 120) : "";
  const city = typeof body.city === "string" ? body.city : "";

  if (!practiceName) {
    return NextResponse.json({ error: "Enter your practice name." }, { status: 400 });
  }
  if (!(SOUTH_BAY_CITIES as readonly string[]).includes(city)) {
    return NextResponse.json({ error: "Choose a South Bay city from the list." }, { status: 400 });
  }
  if (!isPracticeType(body.practiceType)) {
    return NextResponse.json({ error: "Choose your practice type." }, { status: 400 });
  }

  // Stage 1: sample data. Stage 2 swaps this call for the live scan.
  const report = buildSampleReport({ practiceName, city, practiceType: body.practiceType });
  return NextResponse.json(report);
}
