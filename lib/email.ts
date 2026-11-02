/**
 * Emails through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Until a domain is verified in Resend, the default sender can only deliver
 * to the Resend account's own address, so prospect emails need RESEND_FROM
 * set to an address on a verified domain.
 */
import "server-only";
import type { LeadInput } from "./leads";
import type { Report } from "./types";

const BASE = process.env.RESEND_BASE_URL || "https://api.resend.com";
const FROM = process.env.RESEND_FROM || "South Coast Marketing <onboarding@resend.dev>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function send(msg: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  try {
    const res = await fetch(`${BASE}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[email] ${res.status} to ${msg.to.replace(/(.).*@/, "$1***@")}: ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (e) {
    console.error("[email] failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const NAVY = "#0B2E63";
const TEAL = "#0E6B75";

function layout(body: string) {
  return `<!doctype html><html><body style="margin:0;background:#EEF5F7;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1F2D3D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px">${body}</td></tr></table>
<p style="font-size:12px;color:#5A6878;margin:16px 0 0">South Coast Marketing · Serving the South Bay</p>
</td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">${esc(label)}</a>`;

/** The report link email to the person who ran the scan. */
export function sendReportEmail(lead: LeadInput, report: Report, link: string) {
  // Biggest fixes first.
  const fixes = report.categories
    .filter((c) => !c.skipped)
    .flatMap((c) => c.checks.filter((x) => !x.passed && !x.sample))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((x) => x.title);
  const subject = `Your Practice Grader report for ${report.practiceName}`;
  const html = layout(`
<p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${TEAL}">Practice Grader</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${NAVY}">Hi ${esc(lead.firstName)}, ${esc(report.practiceName)} scored ${report.total} out of 100</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6">We found ${report.problems} things holding back how patients find you online.${
    fixes.length ? " The first ones to look at:" : ""
  }</p>
${fixes.length ? `<ul style="margin:0 0 20px;padding-left:20px;font-size:16px;line-height:1.7">${fixes.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
<p style="margin:0 0 24px">${button(link, "See your full report")}</p>
<p style="margin:0;font-size:15px;line-height:1.6;color:#3A4A5C">Want help fixing these? Reply to this email or book a free 20-minute call from your report.</p>`);
  const text = `Hi ${lead.firstName},

${report.practiceName} scored ${report.total} out of 100 on the Practice Grader. We found ${report.problems} things holding back how patients find you online.
${fixes.length ? `\nThe first ones to look at:\n${fixes.map((f) => `- ${f}`).join("\n")}\n` : ""}
See your full report: ${link}

Want help fixing these? Reply to this email or book a free 20-minute call from your report.

South Coast Marketing`;
  const replyTo = process.env.LEAD_NOTIFY_EMAIL || undefined;
  return send({ to: lead.email, subject, html, text, replyTo });
}

/** Tells South Coast Marketing about a new lead (or a call request). */
export function sendLeadNotification(opts: {
  lead: LeadInput;
  practiceName: string;
  city: string;
  report: Report | null;
  link: string | null;
  scanError?: string;
  wantsCall?: boolean;
}) {
  const to = process.env.LEAD_NOTIFY_EMAIL;
  if (!to) return Promise.resolve(false);
  const { lead } = opts;
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const score = opts.report ? `${opts.report.total}/100` : "scan failed";
  const subject = opts.wantsCall
    ? `Call request: ${name}, ${opts.practiceName}`
    : `New lead: ${name}, ${opts.practiceName} (${score})`;
  const rows: [string, string][] = [
    ["Name", name],
    ["Role", lead.role],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Practice", `${opts.practiceName}, ${opts.city}`],
    ["Score", score],
  ];
  if (opts.scanError) rows.push(["Scan error", opts.scanError]);
  const html = layout(`
<h1 style="margin:0 0 16px;font-size:22px;color:${NAVY}">${opts.wantsCall ? "Wants a free audit call" : "New Practice Grader lead"}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5;margin:0 0 24px">
${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#5A6878">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`).join("")}
</table>
${opts.link ? `<p style="margin:0">${button(opts.link, "Open their report")}</p>` : ""}`);
  const text = `${opts.wantsCall ? "Wants a free audit call" : "New Practice Grader lead"}\n\n${rows
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}${opts.link ? `\n\nReport: ${opts.link}` : ""}`;
  return send({ to, subject, html, text, replyTo: lead.email });
}
