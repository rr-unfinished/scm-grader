/**
 * Cloudflare Turnstile verification (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
 * Off until TURNSTILE_SECRET_KEY is set. Tokens are single-use and expire after 5 minutes.
 */
import "server-only";

const VERIFY_URL = process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/** True when the visitor passed (or the check is off). */
export async function verifyTurnstile(token: unknown, request: Request): Promise<boolean> {
  if (!turnstileConfigured()) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) form.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.error("[turnstile] failed:", data["error-codes"]?.join(",") ?? res.status);
    return Boolean(data.success);
  } catch (e) {
    // If Cloudflare itself is unreachable, let the scan through rather than lose a real lead.
    console.error("[turnstile] verify unreachable:", e instanceof Error ? e.message : e);
    return true;
  }
}
