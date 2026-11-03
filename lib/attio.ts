/**
 * Sends grader leads to Attio (https://docs.attio.com/rest-api/overview).
 *
 * For each lead:
 * 1. The practice is created or updated as a Company, matched on its website domain.
 * 2. The person is created or updated as a Person, matched on email, and linked to the company.
 * 3. A note with the score, top fixes and report link is added to the person.
 * 4. If ATTIO_LIST is set, the person is added to that list at stage "New",
 *    with their score and report link. Repeat scans update the score and link
 *    but never move the stage back.
 * A later "Book my free audit call" click adds a second note and moves the
 * list entry to "Call requested".
 *
 * Matching on email and domain means repeat scans update the same records
 * instead of creating duplicates.
 */
import "server-only";
import type { LeadInput } from "./leads";
import type { Report } from "./types";

const BASE = process.env.ATTIO_BASE_URL || "https://api.attio.com/v2";

export function attioConfigured(): boolean {
  return Boolean(process.env.ATTIO_API_KEY);
}

class AttioError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`Attio ${status}`);
  }
}

async function call<T>(method: "GET" | "PUT" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.ATTIO_API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new AttioError(res.status, text.slice(0, 400));
  return JSON.parse(text) as T;
}

interface RecordResponse {
  data: { id: { record_id: string } };
}

/** "(310) 555-0142" -> "+13105550142"; leaves other formats alone. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.trim().startsWith("+") ? `+${digits}` : null;
}

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|gmx|comcast|att|sbcglobal|verizon|cox|charter)\./i;

/** The practice's domain: its website if we have one, else a non-free email domain. */
export function practiceDomain(website: string | undefined, email: string): string | null {
  if (website) {
    try {
      return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    } catch {}
  }
  const emailDomain = email.split("@")[1]?.toLowerCase();
  return emailDomain && !FREE_MAIL.test(emailDomain) ? emailDomain : null;
}

async function upsertCompany(name: string, domain: string | null): Promise<string | null> {
  try {
    const values = domain ? { name, domains: [domain] } : { name };
    const res = domain
      ? await call<RecordResponse>("PUT", "/objects/companies/records?matching_attribute=domains", { data: { values } })
      : await call<RecordResponse>("POST", "/objects/companies/records", { data: { values } });
    return res.data.id.record_id;
  } catch (e) {
    // A company problem shouldn't stop the person from being saved.
    console.error("[attio] company:", e instanceof AttioError ? `${e.status} ${e.body}` : e);
    return null;
  }
}

async function upsertPerson(lead: LeadInput, companyId: string | null): Promise<string> {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  const base: Record<string, unknown> = {
    email_addresses: [lead.email],
    name: [{ first_name: lead.firstName, ...(lead.lastName ? { last_name: lead.lastName } : {}), full_name: fullName }],
    job_title: lead.role,
    ...(companyId ? { company: [{ target_object: "companies", target_record_id: companyId }] } : {}),
  };
  const phone = toE164(lead.phone);
  const path = "/objects/people/records?matching_attribute=email_addresses";
  try {
    const values = phone ? { ...base, phone_numbers: [{ original_phone_number: phone, country_code: "US" }] } : base;
    return (await call<RecordResponse>("PUT", path, { data: { values } })).data.id.record_id;
  } catch (e) {
    // Attio rejects phone numbers it can't parse; retry without it (the phone is still in the note).
    if (phone && e instanceof AttioError && e.status === 400) {
      return (await call<RecordResponse>("PUT", path, { data: { values: base } })).data.id.record_id;
    }
    throw e;
  }
}

/* ---------- List (pipeline) ---------- */

const LIST = process.env.ATTIO_LIST || "";
// Attribute slugs on the list. Attio makes them from the names you give them.
const STAGE = process.env.ATTIO_LIST_STAGE_ATTRIBUTE || "stage";
const SCORE = process.env.ATTIO_LIST_SCORE_ATTRIBUTE || "score";
const REPORT = process.env.ATTIO_LIST_REPORT_ATTRIBUTE || "report_link";
export const STAGE_NEW = "New";
export const STAGE_CALL = "Call requested";

async function findEntry(personId: string): Promise<string | null> {
  const res = await call<{ data: { list_id: string; list_api_slug: string; entry_id: string }[] }>(
    "GET",
    `/objects/people/records/${personId}/entries?limit=1000`,
  );
  const hit = res.data.find((e) => e.list_api_slug === LIST || e.list_id === LIST);
  return hit?.entry_id ?? null;
}

/** Writes values; if Attio rejects them (say, an attribute doesn't exist), keeps the entry and logs it. */
async function writeEntry(entryId: string | null, personId: string, values: Record<string, unknown>) {
  const path = entryId ? `/lists/${encodeURIComponent(LIST)}/entries/${entryId}` : `/lists/${encodeURIComponent(LIST)}/entries`;
  const send = (v: Record<string, unknown>) =>
    entryId
      ? call("PATCH", path, { data: { entry_values: v } })
      : call("POST", path, { data: { parent_record_id: personId, parent_object: "people", entry_values: v } });
  try {
    await send(values);
  } catch (e) {
    if (!(e instanceof AttioError) || e.status !== 400) throw e;
    console.error(`[attio] list values rejected (${e.body.slice(0, 200)}); check the list's attributes`);
    if (!entryId) await send({}); // still put them on the list
  }
}

async function addToList(personId: string, report: Report | null, link: string | null) {
  if (!LIST) return;
  const values: Record<string, unknown> = {};
  if (report) values[SCORE] = report.total;
  if (link) values[REPORT] = link;
  const entryId = await findEntry(personId);
  // New entries start at "New"; existing ones keep whatever stage you've moved them to.
  await writeEntry(entryId, personId, entryId ? values : { ...values, [STAGE]: STAGE_NEW });
}

async function moveToCallRequested(personId: string, link: string) {
  if (!LIST) return;
  const entryId = await findEntry(personId);
  await writeEntry(entryId, personId, { [STAGE]: STAGE_CALL, [REPORT]: link });
}

async function addNote(personId: string, title: string, content: string) {
  await call("POST", "/notes", {
    data: { parent_object: "people", parent_record_id: personId, title, format: "plaintext", content },
  });
}

function reportNote(lead: LeadInput, report: Report | null, link: string | null, practiceName: string, city: string, scanError?: string) {
  const lines = [
    `Practice: ${practiceName}, ${city}`,
    `Role: ${lead.role}`,
    `Phone: ${lead.phone}`,
  ];
  if (report) {
    lines.push(`Score: ${report.total}/100 (${report.problems} problems found)`);
    for (const c of report.categories) lines.push(`${c.name}: ${c.skipped ? "not checked" : `${c.score}/25`}`);
    const fixes = report.categories
      .filter((c) => !c.skipped)
      .flatMap((c) => c.checks.filter((x) => !x.passed && !x.sample))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
    if (fixes.length) {
      lines.push("", "Top fixes:");
      for (const f of fixes) lines.push(`- ${f.title}${f.value ? ` (${f.value})` : ""}`);
    }
    const you = report.competitors.find((c) => c.isYou);
    if (you) lines.push("", `Google map rank for "${report.searchPhrase}": ${you.rank ? `#${you.rank}` : "not in top 20"}`);
  } else if (scanError) {
    lines.push("Scan failed; follow up manually.");
  }
  if (link) lines.push("", `Report: ${link}`);
  return lines.join("\n");
}

/** Never throws; CRM problems are logged and returned as a short code. */
export async function syncLeadToAttio(opts: {
  lead: LeadInput;
  practiceName: string;
  city: string;
  report: Report | null;
  link: string | null;
  scanError?: string;
}): Promise<{ ok: true; personId: string } | { ok: false; error: string }> {
  try {
    const companyId = await upsertCompany(opts.practiceName, practiceDomain(opts.report?.website, opts.lead.email));
    const personId = await upsertPerson(opts.lead, companyId);
    const title = opts.report
      ? `Practice Grader: ${opts.practiceName} scored ${opts.report.total}/100`
      : `Practice Grader: ${opts.practiceName} (scan failed)`;
    await addNote(personId, title, reportNote(opts.lead, opts.report, opts.link, opts.practiceName, opts.city, opts.scanError));
    await addToList(personId, opts.report, opts.link);
    return { ok: true, personId };
  } catch (e) {
    const error = e instanceof AttioError ? `${e.status} ${e.body.slice(0, 160)}` : e instanceof Error ? e.message : String(e);
    console.error("[attio] sync failed:", error);
    return { ok: false, error };
  }
}

/** Adds a "wants a call" note to the person (matched by email). Never throws. */
export async function noteCallRequest(lead: LeadInput, practiceName: string, link: string) {
  try {
    const personId = await upsertPerson(lead, null);
    await addNote(
      personId,
      `Requested a free audit call: ${practiceName}`,
      `${lead.firstName} clicked "Book my free audit call" on their Practice Grader report.\n\nPhone: ${lead.phone}\nEmail: ${lead.email}\nReport: ${link}`,
    );
    await moveToCallRequested(personId, link);
  } catch (e) {
    console.error("[attio] call note failed:", e instanceof AttioError ? `${e.status} ${e.body}` : e);
  }
}
