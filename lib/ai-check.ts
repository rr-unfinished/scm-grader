/**
 * Stage 4: asks ChatGPT (OpenAI Responses API + web search) who it would
 * recommend locally, and checks whether the practice is named.
 * Docs: https://developers.openai.com/api/docs/guides/tools-web-search
 */
import "server-only";

const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
// gpt-5-mini: much higher rate limits than larger models on new API accounts.
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
// The whole ChatGPT step must finish inside the 60s function limit with room to spare.
const BUDGET_MS = 42000;
const MIN_CALL_MS = 8000;

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface AiResult {
  asked: number;
  named: number;
}

/** Short, key-free reason the last OpenAI call failed, for debugging. */
export let lastAiError: string | null = null;

interface ResponsesApi {
  output_text?: string;
  output?: { type: string; content?: { type?: string; text?: string }[] }[];
}

async function ask(question: string, city: string, timeoutMs: number, retry = true): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: "low" },
        tools: [
          {
            type: "web_search",
            search_context_size: "low",
            user_location: { type: "approximate", country: "US", region: "California", city, timezone: "America/Los_Angeles" },
          },
        ],
        input: question,
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status === 429 && retry) {
      // Rate limited: wait as long as OpenAI asks (capped), then try once more.
      const wait = Math.min(8, Number(res.headers.get("retry-after")) || 3) * 1000;
      if (timeoutMs - wait < MIN_CALL_MS) {
        lastAiError = "429 rate_limit_exceeded";
        return null;
      }
      await new Promise((r) => setTimeout(r, wait));
      return ask(question, city, timeoutMs - wait, false);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[ai-check] ${res.status}: ${text.slice(0, 300)}`);
      let code = "";
      try {
        const err = JSON.parse(text).error ?? {};
        code = [err.code, err.type, err.param].filter(Boolean).join(" ");
      } catch {}
      lastAiError = `${res.status} ${code}`.trim();
      return null;
    }
    const data = (await res.json()) as ResponsesApi;
    if (data.output_text) return data.output_text;
    const parts = (data.output ?? [])
      .filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .map((c) => c.text ?? "");
    return parts.join("\n") || null;
  } catch (e) {
    console.error("[ai-check] failed:", e instanceof Error ? e.message : e);
    lastAiError = e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network";
    return null;
  }
}

/** Returns null when ChatGPT couldn't be reached at all. */
export async function chatgptMentions(opts: {
  practiceName: string;
  noun: string;
  city: string;
  websiteHost?: string | null;
}): Promise<AiResult | null> {
  const questions = [
    `What are the best ${opts.noun}s in ${opts.city}, California? Recommend up to 8 specific practices by name.`,
    `I'm looking for a good ${opts.noun} near ${opts.city}, CA. Which practices would you recommend, and why?`,
  ];
  lastAiError = null;
  // Ask one question at a time and stop as soon as the practice is named,
  // which keeps token use (and rate-limit pressure) low.
  let asked = 0;
  let named = 0;
  const deadline = Date.now() + BUDGET_MS;
  for (const q of questions) {
    const left = deadline - Date.now();
    if (left < MIN_CALL_MS) break;
    const a = await ask(q, opts.city, left);
    if (a === null) continue;
    asked++;
    if (mentions(a, opts.practiceName, opts.city, opts.websiteHost)) {
      named++;
      break;
    }
  }
  return asked === 0 ? null : { asked, named };
}

/* ---------- Name matching (pure, testable) ---------- */

const GENERIC = new Set([
  "the", "of", "and", "at", "in", "a", "dental", "dentistry", "dentist", "dentists", "family", "cosmetic", "general",
  "group", "care", "center", "centre", "clinic", "office", "practice", "associates", "dds", "dmd", "md", "inc", "llc",
  "pc", "orthodontics", "orthodontist", "chiropractic", "chiropractor", "physical", "therapy", "therapist", "pt",
  "med", "medical", "spa", "aesthetics", "wellness", "health", "urgent", "smiles", "smile", "studio", "dr",
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Drops a trailing location like "Exer Urgent Care - Manhattan Beach". */
function baseName(name: string): string {
  return name.split(/\s[-–—|]\s|\s\(/)[0];
}

export function mentions(answer: string, practiceName: string, city: string, websiteHost?: string | null): boolean {
  const text = ` ${normalize(answer)} `;
  const baseRaw = baseName(practiceName).trim();
  const base = normalize(baseRaw);
  const cityWords = new Set(normalize(city).split(" "));
  const distinctive = base.split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w) && !cityWords.has(w));

  if (websiteHost) {
    const root = websiteHost.toLowerCase().replace(/^www\./, "").split(".")[0];
    if (root.length >= 5 && answer.toLowerCase().includes(root)) return true;
  }

  if (distinctive.length > 0) {
    // "SmileWell Family Dentistry" matches "SmileWell" anywhere.
    return text.includes(` ${base} `) || distinctive.every((w) => text.includes(` ${w} `));
  }

  // Generic names like "Physical Therapy San Pedro" read like ordinary words,
  // so they only count when written as a name: same words, same capitals.
  const tidy = (x: string) => x.replace(/[‐-―]/g, "-").replace(/\s+/g, " ");
  const escaped = tidy(baseRaw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`).test(tidy(answer));
}
