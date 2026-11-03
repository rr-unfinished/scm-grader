import { after, NextResponse } from "next/server";
import { attioConfigured, syncLeadToAttio } from "@/lib/attio";
import { emailConfigured, sendLeadNotification, sendReportEmail } from "@/lib/email";
import { PlacesError, placesConfigured } from "@/lib/google-places";
import { lastLeadError, leadsConfigured, saveLead, validateLead, type LeadInput } from "@/lib/leads";
import { buildLiveReport } from "@/lib/live-report";
import { isPracticeType, isSouthBayCity } from "@/lib/practice-types";
import { buildSampleReport } from "@/lib/sample-report";
import type { GradeRequest, Report } from "@/lib/types";

export const runtime = "nodejs";
// PageSpeed and ChatGPT can take 15-40 seconds; leave headroom.
export const maxDuration = 60;

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const TOKEN = /^[A-Za-z0-9_-]{8,100}$/;

export async function POST(request: Request) {
  let body: Partial<GradeRequest> & { lead?: unknown };
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

  const checked = validateLead(body.lead);
  if ("error" in checked) return NextResponse.json({ error: checked.error, field: "lead" }, { status: 400 });
  const lead = checked.lead;

  const req: GradeRequest = { practiceName, city, practiceType: body.practiceType, placeId, sessionToken };
  const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");

  let report: Report;
  if (!placesConfigured()) {
    report = buildSampleReport(req);
  } else if (!placeId) {
    return NextResponse.json(
      { error: "Pick your practice from the list so we scan the right Google listing." },
      { status: 400 },
    );
  } else {
    try {
      report = await buildLiveReport({ ...req, placeId });
    } catch (e) {
      if (e instanceof PlacesError && (e.status === 400 || e.status === 404)) {
        return NextResponse.json(
          { error: "We couldn't find that listing on Google. Search for your practice again and pick it from the list." },
          { status: 400 },
        );
      }
      const scanError = e instanceof Error ? e.message : String(e);
      console.error("[grade] live scan failed:", scanError);
      // Keep the lead even though the scan failed, so South Coast can follow up.
      await recordLead({ lead, req, report: null, scanError, origin });
      return NextResponse.json({ error: "We couldn't reach Google just now. Try again in a minute." }, { status: 502 });
    }
  }

  const reportId = await recordLead({ lead, req, report, origin });
  const diagnostics = [...(report.diagnostics ?? [])];
  if (!reportId) diagnostics.push(leadsConfigured() ? `leads: ${lastLeadError ?? "save failed"}` : "leads: not configured");
  return NextResponse.json({
    ...report,
    reportId,
    emailed: Boolean(reportId && emailConfigured()),
    ...(diagnostics.length ? { diagnostics } : {}),
  });
}

/** Saves the lead, then sends emails and updates Attio after the response. */
async function recordLead(opts: {
  lead: LeadInput;
  req: GradeRequest;
  report: Report | null;
  scanError?: string;
  origin: string;
}): Promise<string | null> {
  const { lead, req, report, scanError, origin } = opts;
  const reportId = leadsConfigured()
    ? await saveLead({
        lead,
        practiceName: report?.practiceName ?? req.practiceName,
        city: req.city,
        practiceType: req.practiceType,
        placeId: req.placeId,
        report,
        scanError,
      })
    : null;
  const link = reportId ? `${origin}/r/${reportId}` : null;

  const practiceName = report?.practiceName ?? req.practiceName;
  if (emailConfigured() || attioConfigured()) {
    // Emails and the CRM run after the response, in parallel, so the scan isn't slower.
    after(async () => {
      await Promise.all([
        emailConfigured() && report && link ? sendReportEmail(lead, report, link) : Promise.resolve(false),
        emailConfigured()
          ? sendLeadNotification({ lead, practiceName, city: req.city, report, link, scanError })
          : Promise.resolve(false),
        attioConfigured()
          ? syncLeadToAttio({ lead, practiceName, city: req.city, report, link, scanError })
          : Promise.resolve(null),
      ]);
    });
  }
  return reportId;
}
