/**
 * Stage 1: sample data only.
 * Stage 2 replaces this with live Google Places, PageSpeed and site checks.
 * The output shape (Report) stays the same, so the UI does not change.
 */
import { PRACTICE_TYPES } from "./practice-types";
import { scoreCategory, summarize } from "./scoring";
import type { Category, Competitor, GradeRequest, Report } from "./types";

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

export function buildSampleReport(req: GradeRequest): Report {
  const t = PRACTICE_TYPES[req.practiceType];
  const r = seeded(`${req.practiceName.toLowerCase()}|${req.city}|${req.practiceType}`);
  const p = (x: number) => r() < x;

  const rating = Math.round((3.9 + r() * 1.05) * 10) / 10;
  const reviews = Math.round(18 + r() * 260);
  const lcp = Math.round((1.6 + r() * 4.2) * 10) / 10;
  const rank = 1 + Math.floor(r() * 9);
  const daysSinceReview = Math.round(4 + r() * 120);
  const searchPhrase = `${t.noun} near me`;

  const raw: Omit<Category, "score">[] = [
    {
      id: "google",
      name: "Google search",
      checks: [
        { id: "map-rank", title: "Shows in the top 3 map results", detail: `For "${searchPhrase}" searched from ${req.city}.`, value: `Rank #${rank}`, passed: rank <= 3, weight: 6 },
        { id: "gbp-verified", title: "Google Business Profile is verified", detail: "Unverified profiles can be edited by anyone and rank lower.", passed: p(0.8), weight: 5 },
        { id: "gbp-category", title: "Primary category matches what you do", detail: `Your main category should read "${cap(t.noun)}".`, passed: p(0.65), weight: 4 },
        { id: "gbp-booking", title: "Booking link on your profile", detail: "Patients can request an appointment straight from Google.", passed: p(0.45), weight: 4 },
        { id: "gbp-hours", title: "Holiday and weekend hours are set", detail: "Wrong hours are one of the top reasons people pick another office.", passed: p(0.55), weight: 3 },
        { id: "gbp-photos", title: "New photos in the last 90 days", detail: "Fresh office and team photos lift profile clicks.", passed: p(0.4), weight: 3 },
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
        { id: "recent-review", title: "A new review in the last 30 days", detail: "Recent reviews tell Google and patients you are active.", value: `${daysSinceReview} days ago`, passed: daysSinceReview <= 30, weight: 5 },
        { id: "review-replies", title: "You reply to reviews", detail: "Replying to good and bad reviews builds trust.", passed: p(0.45), weight: 4 },
        { id: "nap", title: "Name, address and phone match everywhere", detail: "Checked against Yelp, Healthgrades, Apple Maps and Bing.", passed: p(0.4), weight: 4 },
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

  const categories: Category[] = raw.map((c) => ({ ...c, score: scoreCategory(c.checks) }));
  const summary = summarize(categories, req.practiceType);

  // Sample competitors, always ahead of or near the practice.
  const prefixes = ["Coastline", "Bayside", "Harbor", "Seaside", "Sunset", "Peninsula", "Shoreline", "Breakwater"];
  const used = new Set<string>();
  const others: Omit<Competitor, "rank">[] = [];
  while (others.length < 3) {
    const n = prefixes[Math.floor(r() * prefixes.length)];
    if (used.has(n)) continue;
    used.add(n);
    others.push({
      name: `${n} ${t.competitorSuffix}`,
      rating: Math.round((4.6 + r() * 0.4) * 10) / 10,
      reviews: Math.round(140 + r() * 520),
      score: Math.min(96, summary.total + 8 + Math.round(r() * 24)),
    });
  }
  const competitors: Competitor[] = [
    ...others,
    { name: req.practiceName, rating, reviews, score: summary.total, isYou: true },
  ]
    .sort((a, b) => b.score - a.score)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  return {
    practiceName: req.practiceName,
    city: req.city,
    practiceType: req.practiceType,
    ...summary,
    categories,
    competitors,
    searchPhrase,
    source: "sample",
    generatedAt: new Date().toISOString(),
  };
}
