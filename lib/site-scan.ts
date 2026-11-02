/**
 * Loads a practice's homepage and looks for the things patients and AI tools
 * need: tap-to-call, online booking, service pages, insurance info,
 * structured data and FAQ content.
 *
 * The URL comes from the business's Google listing, which the business
 * controls, so fetching is locked to public http(s) addresses only.
 */
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { PracticeType } from "./types";

const TIMEOUT_MS = 9000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/* ---------- Safe fetch ---------- */

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http(s)");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("non-standard port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("local host");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("private address");
}

export interface FetchedPage {
  html: string;
  finalUrl: string;
}

/** Returns null when the site can't be loaded. */
export async function fetchHomepage(rawUrl: string): Promise<FetchedPage | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublic(url);
      const res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, url);
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (type && !type.includes("html")) return null;
      return { html: await readCapped(res), finalUrl: url.toString() };
    }
    return null;
  } catch (e) {
    console.error(`[site-scan] ${url.hostname}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, MAX_BYTES));
}

/* ---------- Analysis (pure, so it can be tested without the network) ---------- */

const SERVICE_KEYWORDS: Record<PracticeType, string[]> = {
  dental: ["implant", "invisalign", "crown", "veneer", "whitening", "root canal", "cleaning", "emergency", "extraction", "cosmetic", "pediatric", "denture", "bridge", "periodont", "sedation"],
  ortho: ["invisalign", "braces", "clear aligner", "retainer", "early treatment", "adult", "teen", "lingual", "ceramic", "phase", "emergency"],
  clinic: ["urgent care", "physical", "vaccin", "flu", "covid", "x-ray", "lab", "std", "sti", "occupational", "primary care", "telehealth", "injur", "pediatric", "travel"],
  chiro: ["adjustment", "back pain", "neck pain", "sciatica", "sports", "massage", "headache", "posture", "decompression", "auto", "injur", "pregnan", "pediatric"],
  medspa: ["botox", "filler", "laser", "facial", "microneedling", "hydrafacial", "coolsculpt", "peel", "prp", "hair removal", "weight loss", "iv therapy", "skin tightening", "dysport"],
  pt: ["sports", "post-surgical", "post surgical", "orthopedic", "back pain", "neck pain", "vestibular", "dry needling", "pelvic", "balance", "manual therapy", "injur", "rehab"],
};

const BOOKING_PROVIDERS = [
  "zocdoc", "nexhealth", "localmed", "solutionreach", "weavehelp", "getweave", "lighthouse360", "flexbook", "modento",
  "yapiapp", "carestack", "calendly", "acuityscheduling", "janeapp", "jane.app", "mindbodyonline", "vagaro", "joinblvd",
  "zenoti", "phreesia", "chirotouch", "webpt", "healthie", "practicefusion", "patientpop", "doctible", "opencare",
  "dentalhq", "denticon", "curve.dental", "glossgenius", "squareup.com/appointments", "booksy", "setmore", "intakeq",
];

const LOCAL_SCHEMA_TYPES = new Set([
  "localbusiness", "medicalbusiness", "medicalclinic", "medicalorganization", "dentist", "physician", "hospital",
  "healthandbeautybusiness", "dayspa", "physicaltherapy", "optician", "healthclub", "medicalspa",
]);

export interface SiteFindings {
  tapToCall: boolean;
  booking: boolean;
  services: string[];
  insurance: boolean;
  schemaTypes: string[];
  localSchema: boolean;
  faq: boolean;
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function linkTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(m[1])?.[1] ?? "";
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    out.push(`${href} ${text}`.toLowerCase().replace(/[-_/]+/g, " "));
  }
  return out;
}

function collectTypes(node: unknown, out: string[]) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") out.push(t);
  if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.push(x));
  for (const v of Object.values(obj)) if (v && typeof v === "object") collectTypes(v, out);
}

export function analyzeHtml(html: string, practiceType: PracticeType): SiteFindings {
  const lower = html.toLowerCase();
  const text = visibleText(html);
  const links = linkTexts(html);
  const linkBlob = links.join(" | ");

  const tapToCall = /href\s*=\s*["']\s*tel:/i.test(html);

  const booking =
    BOOKING_PROVIDERS.some((p) => lower.includes(p)) ||
    /\b(book|schedule|request)\s+(an?\s+|your\s+|my\s+)?(appointment|online|now|visit|consultation|exam)\b/.test(linkBlob) ||
    /\bbook online\b|\bonline (booking|scheduling)\b/.test(text);

  // Word-start match, so "lab" doesn't hit "available".
  // Keywords get the same hyphen-to-space treatment as links, so "x-ray" matches "/x-ray".
  const services = SERVICE_KEYWORDS[practiceType].filter((k) => {
    const norm = k.replace(/[-_/]+/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${norm}`).test(linkBlob);
  });

  const insurance =
    /\binsurance\b|\bppo\b|\bfinancing\b|\bcarecredit\b|\bcherry\b|\bpayment plans?\b|\bself[- ]pay\b|\bmembership plan\b|\bpricing\b/.test(text);

  const schemaTypes: string[] = [];
  const ldRe = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html))) {
    try {
      collectTypes(JSON.parse(m[1].trim()), schemaTypes);
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  }
  const microRe = /itemtype\s*=\s*["']https?:\/\/schema\.org\/([A-Za-z]+)["']/gi;
  while ((m = microRe.exec(html))) schemaTypes.push(m[1]);
  const uniqueTypes = [...new Set(schemaTypes)];
  const localSchema = uniqueTypes.some((t) => LOCAL_SCHEMA_TYPES.has(t.toLowerCase()));

  const faq =
    uniqueTypes.some((t) => t.toLowerCase() === "faqpage") ||
    /frequently asked questions/.test(text) ||
    /\bfaqs?\b/.test(linkBlob);

  return { tapToCall, booking, services, insurance, schemaTypes: uniqueTypes, localSchema, faq };
}
