/**
 * Stage 4: asks ChatGPT (OpenAI Responses API + web search) who it would
 * recommend locally, and checks whether the practice is named.
 * Docs: https://developers.openai.com/api/docs/guides/tools-web-search
 */
import "server-only";

const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const TIMEOUT_MS = 45000;

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

async function ask(question: string, city: string): Promise<string | null> {
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
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
  const answers = await Promise.all(questions.map((q) => ask(q, opts.city)));
  const got = answers.filter((a): a is string => typeof a === "string");
  if (got.length === 0) return null;
  const named = got.filter((a) => mentions(a, opts.practiceName, opts.city, opts.websiteHost)).length;
  return { asked: got.length, named };
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
  const base = normalize(baseName(practiceName));
  if (base && text.includes(` ${base} `)) return true;

  if (websiteHost) {
    const root = websiteHost.toLowerCase().replace(/^www\./, "").split(".")[0];
    if (root.length >= 5 && answer.toLowerCase().includes(root)) return true;
  }

  const cityWords = new Set(normalize(city).split(" "));
  const distinctive = base.split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w) && !cityWords.has(w));
  if (distinctive.length === 0) return false; // e.g. "Dentist of Torrance": only an exact match counts
  return distinctive.every((w) => text.includes(` ${w} `));
}
