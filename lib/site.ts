/** Public contact details shown in the footer and privacy policy. Set in Vercel to replace the placeholders. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[email]";

/** "+13104319550" or "3104319550" -> "(310) 431-9550"; anything else is shown as entered. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw;
}

export const CONTACT_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE ? formatPhone(process.env.NEXT_PUBLIC_CONTACT_PHONE) : "[phone]";
