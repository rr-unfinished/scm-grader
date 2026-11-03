/**
 * Sends grader leads to Attio (https://docs.attio.com/rest-api/overview).
 *
 * For each lead:
 * 1. The practice is created or updated as a Company, matched on its website domain.
 * 2. The person is created or updated as a Person, matched on email, and linked to the company.
 * 3. A note with the score, top fixes and report link is added to the person.
 * 4. If ATTIO_LIST is set, the person is added to that list at stage "New",
 *    with their scores, practice type, city, map rank and report link.
 *    Repeat scans update those values but never move the stage back.
 * A later "Book my free audit call" click adds a second note and moves the
 * list entry to "Call requested".
 *
 * Matching on email and domain means repeat scans update the same records
 * instead of creating duplicates.
 */
import "server-only";
import type { LeadInput } from "./leads";
import { PRACTICE_TYPES, SOUTH_BAY_CITIES } from "./practice-types";
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

// Accepts "scm_grader", "/scm_grader" or a pasted URL path ending in the slug.
const LIST = (process.env.ATTIO_LIST || "").trim().replace(/^\/+|\/+$/g, "").split("/").pop() || "";
export const STAGE_NEW = "New";
export const STAGE_CALL = "Call requested";

/**
 * List columns the app fills, matched by the name you gave them in Attio.
 * Columns that don't exist on the list are skipped.
 */
const COLUMNS = {
  stage: "Stage",
  score: "Score",
  report: "Report link",
  practiceType: "Practice type",
  city: "City",
  mapRank: "Google map rank",
  googleScore: "Google search score",
  websiteScore: "Website score",
  reviewsScore: "Reviews score",
  aiScore: "AI search score",
  lastScanned: "Last scanned",
  callRequestedOn: "Call requested on",
} as const;
type Column = keyof typeof COLUMNS;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Looked up once per server instance; Attio column names rarely change.
let slugCache: Promise<Partial<Record<Column, string>>> | null = null;

function listSlugs(): Promise<Partial<Record<Column, string>>> {
  if (!slugCache) {
    slugCache = call<{ data: { title: string; api_slug: string; is_archived?: boolean }[] }>(
      "GET",
      `/lists/${encodeURIComponent(LIST)}/attributes?limit=200`,
    )
      .then((res) => {
        // Attio returns columns in the order shown in the app; the first match wins.
        const byTitle = new Map<string, string>();
        for (const a of res.data.filter((x) => !x.is_archived)) {
          if (!byTitle.has(norm(a.title))) byTitle.set(norm(a.title), a.api_slug);
        }
        const out: Partial<Record<Column, string>> = {};
        for (const [key, title] of Object.entries(COLUMNS) as [Column, string][]) {
          const slug = byTitle.get(norm(title));
          if (slug) out[key] = slug;
        }
        return out;
      })
      .catch((e) => {
        slugCache = null; // try again next time
        throw e;
      });
  }
  return slugCache;
}

/** Today's date in the South Bay, as Attio's YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

function scanValues(report: Report | null, link: string | null): Partial<Record<Column, unknown>> {
  const v: Partial<Record<Column, unknown>> = { lastScanned: today() };
  if (link) v.report = link;
  if (!report) return v;
  const cat = (id: string) => report.categories.find((c) => c.id === id);
  const catScore = (id: string) => {
    const c = cat(id);
    return c && !c.skipped ? c.score : undefined;
  };
  v.score = report.total;
  v.practiceType = PRACTICE_TYPES[report.practiceType].label;
  v.city = report.city;
  const you = report.competitors.find((c) => c.isYou);
  if (you?.rank) v.mapRank = you.rank;
  v.googleScore = catScore("google");
  v.websiteScore = catScore("web");
  v.reviewsScore = catScore("reviews");
  v.aiScore = catScore("ai");
  return v;
}

async function findEntry(personId: string): Promise<string | null> {
  const res = await call<{ data: { list_id: string; list_api_slug: string; entry_id: string }[] }>(
    "GET",
    `/objects/people/records/${personId}/entries?limit=1000`,
  );
  const hit = res.data.find((e) => e.list_api_slug === LIST || e.list_id === LIST);
  return hit?.entry_id ?? null;
}

/**
 * Writes the values that have a matching column. If Attio rejects the batch
 * (say, a select option name doesn't match), it retries one column at a time
 * so the good values still land, and logs the ones that didn't.
 */
// Select columns' option titles, by slug, so values can match regardless of capitals.
let optionCache: Promise<Record<string, string[]>> | null = null;

function selectOptions(): Promise<Record<string, string[]>> {
  if (!optionCache) {
    optionCache = (async () => {
      const attrs = await call<{ data: { api_slug: string; type: string; is_archived?: boolean }[] }>(
        "GET",
        `/lists/${encodeURIComponent(LIST)}/attributes?limit=200`,
      );
      const out: Record<string, string[]> = {};
      for (const a of attrs.data.filter((x) => x.type === "select" && !x.is_archived)) {
        const opts = await call<{ data: { title: string; is_archived: boolean }[] }>(
          "GET",
          `/lists/${encodeURIComponent(LIST)}/attributes/${a.api_slug}/options`,
        );
        out[a.api_slug] = opts.data.filter((o) => !o.is_archived).map((o) => o.title);
      }
      return out;
    })().catch((e) => {
      optionCache = null;
      throw e;
    });
  }
  return optionCache;
}

export interface ListWrite {
  entry: "created" | "updated";
  sent: Record<string, unknown>;
  skipped: string[];
  rejected: string[];
}

async function writeEntry(
  entryId: string | null,
  personId: string,
  values: Partial<Record<Column, unknown>>,
): Promise<ListWrite> {
  const skipped: string[] = [];
  const slugs = await listSlugs();
  const options = await selectOptions().catch(() => ({}) as Record<string, string[]>);
  const entryValues: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values) as [Column, unknown][]) {
    const slug = slugs[key];
    if (val === undefined) continue;
    if (!slug) {
      skipped.push(`${COLUMNS[key]}: no column with this name`);
      continue;
    }
    const opts = options[slug];
    if (opts && typeof val === "string") {
      // Dropdown: use the option's exact title ("Medical Clinic" for "Medical clinic"),
      // sent as a one-item list, which works for single- and multi-select columns.
      const match = opts.find((o) => norm(o) === norm(val));
      if (!match) {
        console.error(`[attio] no "${val}" option in ${slug}; add it to the column in Attio`);
        skipped.push(`${COLUMNS[key]}: no "${val}" option`);
        continue;
      }
      entryValues[slug] = [match];
    } else {
      entryValues[slug] = val;
    }
  }
  const base = `/lists/${encodeURIComponent(LIST)}/entries`;
  let id = entryId;
  const send = async (v: Record<string, unknown>) => {
    if (id) return call("PATCH", `${base}/${id}`, { data: { entry_values: v } });
    const res = await call<{ data: { id: { entry_id: string } } }>("POST", base, {
      data: { parent_record_id: personId, parent_object: "people", entry_values: v },
    });
    id = res.data.id.entry_id;
    return res;
  };
  const rejected: string[] = [];
  try {
    await send(entryValues);
  } catch (e) {
    if (!(e instanceof AttioError) || e.status !== 400) throw e;
    if (!id) await send({}); // still put them on the list
    for (const [slug, val] of Object.entries(entryValues)) {
      try {
        await send({ [slug]: val });
      } catch (err) {
        if (err instanceof AttioError && err.status === 400) rejected.push(`${slug}=${JSON.stringify(val)}: ${err.body.slice(0, 200)}`);
        else throw err;
      }
    }
    if (rejected.length) console.error(`[attio] list values rejected: ${rejected.join(", ")}`);
  }
  return { entry: entryId ? "updated" : "created", sent: entryValues, skipped, rejected };
}

async function addToList(personId: string, report: Report | null, link: string | null): Promise<ListWrite | null> {
  if (!LIST) return null;
  const entryId = await findEntry(personId);
  const values = scanValues(report, link);
  // New entries start at "New"; existing ones keep whatever stage you've moved them to.
  return writeEntry(entryId, personId, entryId ? values : { ...values, stage: STAGE_NEW });
}

async function moveToCallRequested(personId: string, link: string) {
  if (!LIST) return;
  const entryId = await findEntry(personId);
  await writeEntry(entryId, personId, { stage: STAGE_CALL, report: link, callRequestedOn: today() });
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
}): Promise<{ ok: true; personId: string; list: ListWrite | null } | { ok: false; error: string }> {
  try {
    const companyId = await upsertCompany(opts.practiceName, practiceDomain(opts.report?.website, opts.lead.email));
    const personId = await upsertPerson(opts.lead, companyId);
    const title = opts.report
      ? `Practice Grader: ${opts.practiceName} scored ${opts.report.total}/100`
      : `Practice Grader: ${opts.practiceName} (scan failed)`;
    await addNote(personId, title, reportNote(opts.lead, opts.report, opts.link, opts.practiceName, opts.city, opts.scanError));
    const list = await addToList(personId, opts.report, opts.link);
    return { ok: true, personId, list };
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

/**
 * Read-only checks for /api/health: is the token valid, which workspace and
 * permissions does it have, can it see the list, and which columns match.
 * Never returns the token itself.
 */
export async function attioStatus() {
  if (!attioConfigured()) return { configured: false };
  const out: Record<string, unknown> = { configured: true, listSet: Boolean(LIST), listSlug: LIST || null };
  try {
    const self = await call<{ active: boolean; scope?: string; workspace_name?: string }>("GET", "/self");
    out.tokenActive = self.active;
    out.workspace = self.workspace_name ?? null;
    const scopes = (self.scope ?? "").split(" ").filter(Boolean);
    const need = ["record_permission:read-write", "object_configuration:read", "note:read-write", "list_entry:read-write", "list_configuration:read"];
    out.missingScopes = need.filter((n) => {
      const [k, lvl] = n.split(":");
      return !scopes.some((sc) => sc === n || (lvl === "read" && sc === `${k}:read-write`));
    });
  } catch (e) {
    out.tokenError = e instanceof AttioError ? `${e.status} ${e.body.slice(0, 120)}` : String(e);
    return out;
  }
  if (!LIST) return out;
  try {
    const list = await call<{ data: { api_slug: string; name: string; parent_object: string[] } }>(
      "GET",
      `/lists/${encodeURIComponent(LIST)}`,
    );
    out.listFound = true;
    out.listName = list.data.name;
    out.listObject = list.data.parent_object;
    slugCache = null;
    const slugs = await listSlugs();
    out.columnsMatched = Object.keys(slugs);
    out.columnsMissing = (Object.keys(COLUMNS) as Column[]).filter((k) => !slugs[k]).map((k) => COLUMNS[k]);
    // For the two dropdown columns, show their type and options so mismatches are easy to spot.
    const attrs = await call<{ data: { title: string; api_slug: string; type: string }[] }>(
      "GET",
      `/lists/${encodeURIComponent(LIST)}/attributes?limit=200`,
    );
    const dropdowns: Record<string, unknown> = {};
    for (const key of ["city", "practiceType"] as Column[]) {
      const slug = slugs[key];
      const attr = attrs.data.find((x) => x.api_slug === slug);
      if (!slug || !attr) continue;
      const info: Record<string, unknown> = { type: attr.type };
      if (attr.type === "select") {
        const opts = await call<{ data: { title: string; is_archived: boolean }[] }>(
          "GET",
          `/lists/${encodeURIComponent(LIST)}/attributes/${slug}/options`,
        );
        const titles = opts.data.filter((o) => !o.is_archived).map((o) => o.title);
        const expected =
          key === "city" ? [...SOUTH_BAY_CITIES] : Object.values(PRACTICE_TYPES).map((t) => t.label);
        info.options = titles;
        info.missingOptions = expected.filter((x) => !titles.some((t) => norm(t) === norm(x)));
      }
      dropdowns[COLUMNS[key]] = info;
    }
    out.dropdowns = dropdowns;
    // Two columns with the same name means values may land in the one you aren't looking at.
    const counts = new Map<string, string[]>();
    for (const x of attrs.data) {
      const k = norm(x.title);
      counts.set(k, [...(counts.get(k) ?? []), x.api_slug]);
    }
    const wanted = new Set(Object.values(COLUMNS).map(norm));
    out.duplicateColumns = [...counts.entries()]
      .filter(([k, v]) => v.length > 1 && wanted.has(k))
      .map(([k, v]) => ({ name: k, slugs: v, appWritesTo: v[0] }));
  } catch (e) {
    out.listFound = false;
    out.listError = e instanceof AttioError ? `${e.status} ${e.body.slice(0, 160)}` : String(e);
  }
  return out;
}
