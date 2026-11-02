import { NextResponse } from "next/server";
import { PlacesError, placesConfigured } from "@/lib/google-places";
import { buildLiveReport } from "@/lib/live-report";
import { isPracticeType, isSouthBayCity } from "@/lib/practice-types";
import { buildSampleReport } from "@/lib/sample-report";
import type { GradeRequest } from "@/lib/types";

export const runtime = "nodejs";
// PageSpeed can take 15-30 seconds; leave headroom.
export const maxDuration = 60;

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const TOKEN = /^[A-Za-z0-9_-]{8,100}$/;

export async function POST(request: Request) {
  let body: Partial<GradeRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the practice details as JSON." }, { status: 400 });
  }

  const practiceName = typeof body.practiceName === "string" ? body.practiceName.trim().slice(0, 120) : "";
  const city = body.city;
  const placeId = typeof body.placeId === "string" && PLACE_ID.test(body.placeId) ? body.placeId : undefined;
  const sessionToken = typeof body.sessionToken === "string" && TOKEN.test(body.sessionToken) ? body.sessionToken : undefined;

  if (!practiceName) return NextResponse.json({ error: "Enter your practice name." }, { status: 400 });
  if (!isSouthBayCity(city)) return NextResponse.json({ error: "Choose a South Bay city from the list." }, { status: 400 });
  if (!isPracticeType(body.practiceType)) return NextResponse.json({ error: "Choose your practice type." }, { status: 400 });

  const req: GradeRequest = { practiceName, city, practiceType: body.practiceType, placeId, sessionToken };

  if (!placesConfigured()) {
    return NextResponse.json(buildSampleReport(req));
  }
  if (!placeId) {
    return NextResponse.json(
      { error: "Pick your practice from the list so we scan the right Google listing." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await buildLiveReport({ ...req, placeId }));
  } catch (e) {
    if (e instanceof PlacesError && (e.status === 400 || e.status === 404)) {
      return NextResponse.json(
        { error: "We couldn't find that listing on Google. Search for your practice again and pick it from the list." },
        { status: 400 },
      );
    }
    console.error("[grade] live scan failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't reach Google just now. Try again in a minute." }, { status: 502 });
  }
}
