/** Public contact details shown in the footer and privacy policy. Set in Vercel to replace the placeholders. */
// Strips invisible characters that sneak in when values are pasted.
const clean = (v?: string) => (v ?? "").replace(/[^\x21-\x7E]/g, "");
export const CONTACT_EMAIL = clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL) || "[email]";

/** "+13104319550" or "3104319550" -> "(310) 431-9550"; anything else is shown as entered. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE ? formatPhone(process.env.NEXT_PUBLIC_CONTACT_PHONE) : "[phone]";

/** tel: and mailto: links, or null while the placeholders are showing. */
const phoneDigits = (process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
export const CONTACT_PHONE_HREF = phoneDigits.length === 10 ? `tel:+1${phoneDigits}` : null;
export const CONTACT_EMAIL_HREF = clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL).includes("@") ? `mailto:${clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL)}` : null;

/** Google Analytics 4 measurement ID. NEXT_PUBLIC_GA_ID overrides it; set it to "off" to disable. */
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || "G-FM4HLLK9HV").trim();
export const GA_ENABLED = /^G-[A-Z0-9]+$/.test(GA_ID);
