/**
 * Mobile load time from Google PageSpeed Insights.
 * Prefers real-visitor data (Chrome UX Report) when Google has it, because
 * it reflects what patients actually experience; falls back to Google's lab test.
 * Docs: https://developers.google.com/speed/docs/insights/v5/get-started
 */
import "server-only";

const BASE = process.env.PAGESPEED_BASE_URL || "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
// PageSpeed runs a full Lighthouse test, which often takes 15 to 30 seconds.
const TIMEOUT_MS = 40000;

export interface SpeedResult {
  /** Largest Contentful Paint in seconds (time until the main content shows) */
  lcpSeconds: number;
  source: "real visitors" | "lab test";
}

interface PsiResponse {
  loadingExperience?: {
    metrics?: { LARGEST_CONTENTFUL_PAINT_MS?: { percentile?: number } };
  };
  lighthouseResult?: {
    audits?: { "largest-contentful-paint"?: { numericValue?: number } };
  };
}

/** Returns null when PageSpeed can't measure the site (timeout, blocked, error). */
export async function mobileSpeed(url: string): Promise<SpeedResult | null> {
  const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const qs = new URLSearchParams({ url, strategy: "mobile", category: "performance" });
  if (key) qs.set("key", key);
  try {
    const res = await fetch(`${BASE}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[pagespeed] ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as PsiResponse;
    const field = data.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
    if (typeof field === "number" && field > 0) {
      return { lcpSeconds: round1(field / 1000), source: "real visitors" };
    }
    const lab = data.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue;
    if (typeof lab === "number" && lab > 0) {
      return { lcpSeconds: round1(lab / 1000), source: "lab test" };
    }
    return null;
  } catch (e) {
    console.error("[pagespeed] failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;
