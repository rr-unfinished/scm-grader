/**
 * Sample data. Used for the whole report when Google isn't configured or no
 * place was picked, and for the Website and AI categories until stages 3 and 4.
 */
import { PRACTICE_TYPES } from "./practice-types";
import { scoreCategory, summarize } from "./scoring";
import type { Category, CategoryId, Competitor, GradeRequest, Report } from "./types";

/** Seeded random so the same practice always gets the same sample report. */
function seeded(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface SampleExtras {
  rating: number;
  reviews: number;
  rank: number;
}

export function sampleCategories(req: GradeRequest, ids?: CategoryId[]): { categories: Category[]; extras: SampleExtras } {
  const t = PRACTICE_TYPES[req.practiceType];
  const r = seeded(`${req.practiceName.toLowerCase()}|${req.city}|${req.practiceType}`);
  const p = (x: number) => r() < x;

  const rating = Math.round((3.9 + r() * 1.05) * 10) / 10;
  const reviews = Math.round(18 + r() * 260);
  const lcp = Math.round((1.6 + r() * 4.2) * 10) / 10;
  const rank = 1 + Math.floor(r() * 9);

  const raw: Omit<Category, "score" | "sample">[] = [
    {
      id: "google",
      name: "Google search",
      checks: [
        { id: "map-rank", title: "Shows in the top 3 map results", detail: `For "${t.noun} near me" searched from ${req.city}.`, value: `Rank #${rank}`, passed: rank <= 3, weight: 6 },
        { id: "gbp-category", title: "Primary category matches what you do", detail: `Your main category should read "${cap(t.noun)}".`, passed: p(0.65), weight: 4 },
        { id: "gbp-website", title: "Website linked on your profile", detail: "Patients tap through to your site from Google.", passed: p(0.85), weight: 4 },
        { id: "gbp-phone", title: "Phone number on your profile", detail: "Lets patients call straight from the search results.", passed: p(0.9), weight: 3 },
        { id: "gbp-hours", title: "Business hours are listed", detail: "Missing hours are one of the top reasons people pick another office.", passed: p(0.8), weight: 3 },
        { id: "gbp-photos", title: "At least 10 photos on your profile", detail: "Office and team photos lift profile clicks.", passed: p(0.5), weight: 3 },
      ],
    },
    {
      id: "web",
      name: "Website",
      checks: [
        { id: "speed", title: "Loads fast on a phone", detail: "Main content should appear in under 2.5 seconds.", value: `${lcp}s`, passed: lcp <= 2.5, weight: 6 },
        { id: "tap-call", title: "Tap-to-call button on mobile", detail: "Most new-patient calls come from a phone.", passed: p(0.6), weight: 5 },
        { id: "booking", title: "Online booking on your site", detail: "Lets patients book after hours, when many of them are searching.", passed: p(0.4), weight: 5 },
        { id: "service-pages", title: "Pages for your main services", detail: `Separate pages for ${t.services} help you rank for each one.`, passed: p(0.45), weight: 5 },
        { id: "insurance", title: "Insurance and pricing info", detail: 'A clear "insurance we accept" page answers the first question patients ask.', passed: p(0.5), weight: 4 },
      ],
    },
    {
      id: "reviews",
      name: "Reviews & listings",
      checks: [
        { id: "rating", title: "Google rating of 4.7 or higher", detail: "Patients filter for highly rated offices.", value: `${rating.toFixed(1)} ★`, passed: rating >= 4.7, weight: 6 },
        { id: "review-count", title: "At least 100 Google reviews", detail: "Review count is a top local ranking signal.", value: `${reviews} reviews`, passed: reviews >= 100, weight: 6 },
        { id: "vs-local", title: "Rated as well as the top practices near you", detail: "Patients compare you with the offices listed beside you.", passed: p(0.4), weight: 4 },
      ],
    },
    {
      id: "ai",
      name: "AI search",
      checks: [
        { id: "chatgpt", title: "Recommended by ChatGPT", detail: `When asked for the best ${t.noun} in ${req.city}.`, passed: p(0.25), weight: 7 },
        { id: "ai-overviews", title: "Recommended by Google AI Overviews", detail: `For "${t.noun} in ${req.city}" searches.`, passed: p(0.3), weight: 6 },
        { id: "schema", title: "Structured data for your practice", detail: `${t.schemaType} schema helps AI tools read your hours, location and services.`, passed: p(0.35), weight: 6 },
        { id: "faq", title: "Answers to common patient questions", detail: "FAQ content is what AI assistants quote back to patients.", passed: p(0.4), weight: 6 },
      ],
    },
  ];

  const categories = raw
    .filter((c) => !ids || ids.includes(c.id))
    .map((c) => ({ ...c, score: scoreCategory(c.checks), sample: true }));
  return { categories, extras: { rating, reviews, rank } };
}

export function buildSampleReport(req: GradeRequest): Report {
  const t = PRACTICE_TYPES[req.practiceType];
  const { categories, extras } = sampleCategories(req);
  const summary = summarize(categories, req.practiceType);

  const prefixes = ["Coastline", "Bayside", "Harbor", "Seaside", "Sunset", "Peninsula", "Shoreline", "Breakwater"];
  const others: Competitor[] = prefixes
    .slice(0, 4)
    .map((n, i) => ({ rank: i + 1, name: `${n} ${t.competitorSuffix}`, rating: 4.9 - i * 0.1, reviews: 480 - i * 90 }));
  const you: Competitor = { rank: extras.rank, name: req.practiceName, rating: extras.rating, reviews: extras.reviews, isYou: true };
  const competitors = mergeYou(others, you);

  return {
    practiceName: req.practiceName,
    city: req.city,
    practiceType: req.practiceType,
    ...summary,
    categories,
    competitors,
    searchPhrase: `${t.noun} near me`,
    source: "sample",
    generatedAt: new Date().toISOString(),
  };
}

/** Top 3 others plus you, in rank order; you last when outside the list. */
export function mergeYou(others: Competitor[], you: Competitor): Competitor[] {
  const top = others.filter((c) => c.rank !== you.rank).slice(0, 3);
  const all = [...top, you];
  return all.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}
