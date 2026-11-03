import { NextResponse } from "next/server";
import { openaiConfigured } from "@/lib/ai-check";
import { attioConfigured, attioStatus } from "@/lib/attio";
import { emailConfigured } from "@/lib/email";
import { placesConfigured } from "@/lib/google-places";
import { leadsConfigured, supabaseBase } from "@/lib/leads";
import { turnstileConfigured } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/** Which services are connected. Reports yes/no only, never key values. */
export async function GET(request: Request) {
  const supabaseUrl = supabaseBase();
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return NextResponse.json({
    google: placesConfigured(),
    openai: openaiConfigured(),
    supabase: leadsConfigured(),
    supabaseUrlLooksRight: /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl),
    supabaseKeyType: !supaKey ? "missing" : supaKey.startsWith("sb_secret_") ? "secret" : supaKey.startsWith("eyJ") ? "legacy jwt" : supaKey.startsWith("sb_publishable_") ? "publishable (wrong key)" : "unknown",
    resend: emailConfigured(),
    resendFromSet: Boolean(process.env.RESEND_FROM),
    leadNotifySet: Boolean(process.env.LEAD_NOTIFY_EMAIL),
    attio: attioConfigured(),
    botCheck: turnstileConfigured() && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    // ?attio=1 runs read-only checks against Attio (token, workspace, list, columns).
    ...(new URL(request.url).searchParams.get("attio") ? { attioDetails: await attioStatus() } : {}),
  });
}
