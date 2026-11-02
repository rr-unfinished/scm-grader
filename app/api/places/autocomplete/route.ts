import { NextResponse } from "next/server";
import { autocomplete, placesConfigured } from "@/lib/google-places";

export const runtime = "nodejs";

const TOKEN = /^[A-Za-z0-9_-]{8,100}$/;

export async function POST(request: Request) {
  if (!placesConfigured()) {
    return NextResponse.json({ configured: false, suggestions: [] });
  }

  let body: { input?: unknown; sessionToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ configured: true, suggestions: [] }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim().slice(0, 80) : "";
  const sessionToken = typeof body.sessionToken === "string" && TOKEN.test(body.sessionToken) ? body.sessionToken : undefined;
  if (input.length < 2) return NextResponse.json({ configured: true, suggestions: [] });

  try {
    const suggestions = await autocomplete(input, sessionToken);
    return NextResponse.json({ configured: true, suggestions });
  } catch (e) {
    console.error("[autocomplete] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ configured: true, suggestions: [], error: "Search is unavailable right now." }, { status: 502 });
  }
}
