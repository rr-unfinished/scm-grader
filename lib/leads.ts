/**
 * Leads and saved reports, stored in Supabase through its REST API.
 * Server-only: uses the secret key, which bypasses Row Level Security.
 * Table: supabase/schema.sql
 */
import "server-only";
import type { Report } from "./types";

export const CONSENT_TEXT =
  "By continuing you agree that South Coast Marketing may contact you about your report. Message and data rates may apply.";

export interface LeadInput {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
}

export interface SavedLead extends LeadInput {
  id: string;
  createdAt: string;
  practiceName: string;
  city: string;
  report: Report | null;
}

const ROLES = ["Owner / doctor", "Office manager", "Marketing", "Other"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Short, key-free reason the last save failed, for debugging. */
export let lastLeadError: string | null = null;

export function leadsConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const isReportId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Returns the cleaned lead, or an error message the person can act on. */
export function validateLead(raw: unknown): { lead: LeadInput } | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const lead: LeadInput = {
    firstName: str(r.firstName, 60),
    lastName: str(r.lastName, 60),
    role: str(r.role, 40),
    email: str(r.email, 200).toLowerCase(),
    phone: str(r.phone, 30),
  };
  if (!lead.firstName) return { error: "Add your first name." };
  if (!ROLES.includes(lead.role)) return { error: "Choose your role." };
  if (!EMAIL.test(lead.email)) return { error: "Enter a valid email, like name@practice.com." };
  if (lead.phone.replace(/\D/g, "").length < 10) return { error: "Enter a 10-digit mobile number." };
  return { lead };
}

function headers(extra: Record<string, string> = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  // New-style secret keys (sb_secret_...) go in apikey only; legacy service_role JWTs also need Authorization.
  const h: Record<string, string> = { apikey: key, "Content-Type": "application/json", ...extra };
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

const url = (path: string) => `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;

export async function saveLead(input: {
  lead: LeadInput;
  practiceName: string;
  city: string;
  practiceType: string;
  placeId?: string;
  report: Report | null;
  scanError?: string;
}): Promise<string | null> {
  const { diagnostics: _omit, ...report } = input.report ?? ({} as Report);
  const row = {
    first_name: input.lead.firstName,
    last_name: input.lead.lastName || null,
    role: input.lead.role,
    email: input.lead.email,
    phone: input.lead.phone,
    consent_text: CONSENT_TEXT,
    practice_name: input.practiceName,
    city: input.city,
    practice_type: input.practiceType,
    place_id: input.placeId ?? null,
    score: input.report?.total ?? null,
    report: input.report ? report : null,
    scan_error: input.scanError ?? null,
  };
  lastLeadError = null;
  try {
    const res = await fetch(url("leads?select=id"), {
      method: "POST",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[leads] save ${res.status}: ${text.slice(0, 300)}`);
      let code = "";
      try {
        const j = JSON.parse(text);
        code = [j.code, j.message].filter(Boolean).join(" ").slice(0, 160);
      } catch {}
      lastLeadError = `${res.status} ${code}`.trim();
      return null;
    }
    const [saved] = (await res.json()) as { id: string }[];
    return saved?.id ?? null;
  } catch (e) {
    console.error("[leads] save failed:", e instanceof Error ? e.message : e);
    lastLeadError = e instanceof Error ? e.name : "error";
    return null;
  }
}

interface Row {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string | null;
  role: string;
  email: string;
  phone: string;
  practice_name: string;
  city: string;
  report: Report | null;
}

export async function getLead(id: string): Promise<SavedLead | null> {
  if (!leadsConfigured() || !isReportId(id)) return null;
  try {
    const res = await fetch(
      url(`leads?id=eq.${id}&select=id,created_at,first_name,last_name,role,email,phone,practice_name,city,report`),
      { headers: headers(), signal: AbortSignal.timeout(8000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const [row] = (await res.json()) as Row[];
    if (!row) return null;
    return {
      id: row.id,
      createdAt: row.created_at,
      firstName: row.first_name,
      lastName: row.last_name ?? "",
      role: row.role,
      email: row.email,
      phone: row.phone,
      practiceName: row.practice_name,
      city: row.city,
      report: row.report,
    };
  } catch {
    return null;
  }
}

/** Records the call request. Returns false if it was already requested or not found. */
export async function markWantsCall(id: string): Promise<boolean> {
  if (!leadsConfigured() || !isReportId(id)) return false;
  try {
    const res = await fetch(url(`leads?id=eq.${id}&wants_call_at=is.null&select=id`), {
      method: "PATCH",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify({ wants_call_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    return ((await res.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}
