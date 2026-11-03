/**
 * Cost protection for /api/grade, built on the leads table:
 * - scan limits per visitor (by a hashed IP; raw IPs are never stored)
 * - a daily cap across everyone
 * - reuse of a practice's report from the last 24 hours
 * Everything fails open: if Supabase can't answer, the scan goes ahead.
 */
import "server-only";
import { createHash } from "node:crypto";
import { leadsConfigured, supabaseBase } from "./leads";
import type { Report } from "./types";

const HOUR = 60 * 60 * 1000;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const LIMITS = {
  perHour: num(process.env.SCAN_LIMIT_HOUR, 5),
  perDay: num(process.env.SCAN_LIMIT_DAY, 15),
  allPerDay: num(process.env.SCAN_LIMIT_GLOBAL_DAY, 300),
  reuseHours: num(process.env.SCAN_REUSE_HOURS, 24),
};

function headers(extra: Record<string, string> = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const h: Record<string, string> = { apikey: key, ...extra };
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

/** A one-way hash of the visitor's IP, salted so it can't be reversed by lookup. */
export function visitorHash(request: Request): string | null {
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "scm-grader";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

async function count(filter: string): Promise<number | null> {
  try {
    const res = await fetch(`${supabaseBase()}/rest/v1/leads?select=id&${filter}`, {
      method: "HEAD",
      headers: headers({ Prefer: "count=exact", Range: "0-0" }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok && res.status !== 206) {
      console.error(`[guard] count ${res.status} (run the stage 6 SQL if ip_hash is missing)`);
      return null;
    }
    const total = res.headers.get("content-range")?.split("/")[1];
    return total && total !== "*" ? Number(total) : null;
  } catch (e) {
    console.error("[guard] count failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

const since = (ms: number) => encodeURIComponent(new Date(Date.now() - ms).toISOString());

/** Returns a message the visitor can act on when they've hit a limit, else null. */
export async function checkLimits(ipHash: string | null): Promise<string | null> {
  if (!leadsConfigured()) return null;
  const [all, hour, day] = await Promise.all([
    count(`created_at=gte.${since(24 * HOUR)}`),
    ipHash ? count(`ip_hash=eq.${ipHash}&created_at=gte.${since(HOUR)}`) : Promise.resolve(null),
    ipHash ? count(`ip_hash=eq.${ipHash}&created_at=gte.${since(24 * HOUR)}`) : Promise.resolve(null),
  ]);
  if (all !== null && all >= LIMITS.allPerDay) {
    return "The grader is very busy right now. Please try again tomorrow, or reply to any of our emails and we'll run your report for you.";
  }
  if (hour !== null && hour >= LIMITS.perHour) {
    return "You've run several scans in the last hour. Please wait a bit and try again.";
  }
  if (day !== null && day >= LIMITS.perDay) {
    return "You've reached today's scan limit. Please try again tomorrow.";
  }
  return null;
}

/** The latest report for this practice, type and city from the reuse window, if any. */
export async function recentReport(placeId: string, practiceType: string, city: string): Promise<Report | null> {
  if (!leadsConfigured() || LIMITS.reuseHours <= 0) return null;
  const q = [
    "select=report",
    `place_id=eq.${encodeURIComponent(placeId)}`,
    `practice_type=eq.${encodeURIComponent(practiceType)}`,
    `city=eq.${encodeURIComponent(city)}`,
    "report=not.is.null",
    `created_at=gte.${since(LIMITS.reuseHours * HOUR)}`,
    "order=created_at.desc",
    "limit=1",
  ].join("&");
  try {
    const res = await fetch(`${supabaseBase()}/rest/v1/leads?${q}`, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const [row] = (await res.json()) as { report: Report }[];
    return row?.report ?? null;
  } catch {
    return null;
  }
}
