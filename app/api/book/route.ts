import { after, NextResponse } from "next/server";
import { emailConfigured, sendLeadNotification } from "@/lib/email";
import { getLead, isReportId, markWantsCall } from "@/lib/leads";

export const runtime = "nodejs";

/** "Book my free audit call": records the request and tells South Coast. */
export async function POST(request: Request) {
  let body: { reportId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the report ID as JSON." }, { status: 400 });
  }
  if (!isReportId(body.reportId)) {
    return NextResponse.json({ error: "We couldn't find that report." }, { status: 400 });
  }
  const id = body.reportId;
  const isNew = await markWantsCall(id);

  // Only notify once, even if the button is clicked again or the report is shared.
  if (isNew && emailConfigured()) {
    const origin = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
    after(async () => {
      const lead = await getLead(id);
      if (!lead) return;
      await sendLeadNotification({
        lead,
        practiceName: lead.practiceName,
        city: lead.city,
        report: lead.report,
        link: `${origin}/r/${id}`,
        wantsCall: true,
      });
    });
  }
  return NextResponse.json({ ok: true });
}
