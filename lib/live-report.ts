/**
 * Live report.
 * Google search + Reviews: Google Places (stage 2).
 * Website + structured data + FAQ: PageSpeed and a homepage scan (stage 3).
 * ChatGPT and AI Overviews checks: still sample until stage 4.
 */
import "server-only";
import { placeDetails, searchNearby, type PlaceDetails, type SearchResult } from "./google-places";
import { CITY_CENTERS, PRACTICE_TYPES, isSouthBayCity } from "./practice-types";
import { mobileSpeed, type SpeedResult } from "./pagespeed";
import { mergeYou, sampleCategories } from "./sample-report";
import { analyzeHtml, fetchHomepage, type SiteFindings } from "./site-scan";
import { scoreCategory, summarize } from "./scoring";
import type { Category, Check, Competitor, GradeRequest, Report } from "./types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function buildLiveReport(req: GradeRequest & { placeId: string }): Promise<Report> {
  const t = PRACTICE_TYPES[req.practiceType];
  const center = isSouthBayCity(req.city) ? CITY_CENTERS[req.city] : CITY_CENTERS.Torrance;

  const [place, results] = await Promise.all([
    placeDetails(req.placeId, req.sessionToken),
    searchNearby(t.searchQuery, center),
  ]);

  const name = place.displayName?.text || req.practiceName;
  const index = results.findIndex((r) => r.id === place.id || r.id === req.placeId);
  const rank = index >= 0 ? index + 1 : null;
  const others = results.filter((r) => r.id !== place.id && r.id !== req.placeId);

  // Website checks run in parallel; PageSpeed is the slow one (often 15-30s).
  const site = place.websiteUri;
  const [speed, page] = site
    ? await Promise.all([mobileSpeed(site), fetchHomepage(site)])
    : [null, null];
  const findings = page ? analyzeHtml(page.html, req.practiceType) : null;
  const host = site ? safeHost(site) : null;

  const google = googleCategory(place, rank, req.city, t);
  const reviews = reviewsCategory(place, others);
  const web = websiteCategory(t, host, speed, findings);
  const sampleAi = sampleCategories({ ...req, practiceName: name }, ["ai"]).categories[0];
  const ai = aiCategory(sampleAi, host, findings, t.schemaType);
  const categories = [google, web, reviews, ai];
  const summary = summarize(categories, req.practiceType);

  const competitors = mergeYou(
    others.slice(0, 3).map((r) => ({
      rank: results.indexOf(r) + 1,
      name: r.displayName?.text ?? "Unnamed practice",
      rating: r.rating,
      reviews: r.userRatingCount,
    })),
    { rank, name, rating: place.rating, reviews: place.userRatingCount, isYou: true } satisfies Competitor,
  );

  return {
    practiceName: name,
    address: place.formattedAddress,
    mapsUri: place.googleMapsUri,
    city: req.city,
    practiceType: req.practiceType,
    ...summary,
    categories,
    competitors,
    searchPhrase: `${t.searchQuery} near me`,
    source: "live",
    generatedAt: new Date().toISOString(),
  };
}

function googleCategory(
  place: PlaceDetails,
  rank: number | null,
  city: string,
  t: (typeof PRACTICE_TYPES)[keyof typeof PRACTICE_TYPES],
): Category {
  const label = place.primaryTypeDisplayName?.text ?? "";
  const categoryOk =
    (place.primaryType !== undefined && t.expectedTypes.includes(place.primaryType)) ||
    t.categoryKeywords.some((k) => label.toLowerCase().includes(k));
  const photos = place.photos?.length ?? 0;
  const hasHours = (place.regularOpeningHours?.weekdayDescriptions?.length ?? 0) > 0;

  const checks: Check[] = [
    {
      id: "map-rank",
      title: "Shows in the top 3 map results",
      detail: `For "${t.searchQuery} near me" searched from ${city}.`,
      value: rank ? `Rank #${rank}` : "Not in top 20",
      passed: rank !== null && rank <= 3,
      weight: 6,
    },
    {
      id: "gbp-category",
      title: "Primary category matches what you do",
      detail: label
        ? categoryOk
          ? `Google lists you as "${label}".`
          : `Google lists you as "${label}". It should read "${cap(t.noun)}".`
        : `No main category is set. It should read "${cap(t.noun)}".`,
      passed: categoryOk,
      weight: 4,
    },
    {
      id: "gbp-website",
      title: "Website linked on your profile",
      detail: place.websiteUri ? "Patients can tap through to your site from Google." : "Add your website so patients can tap through from Google.",
      passed: Boolean(place.websiteUri),
      weight: 4,
    },
    {
      id: "gbp-phone",
      title: "Phone number on your profile",
      detail: place.nationalPhoneNumber ? "Patients can call straight from the search results." : "Add a phone number so patients can call from Google.",
      value: place.nationalPhoneNumber,
      passed: Boolean(place.nationalPhoneNumber),
      weight: 3,
    },
    {
      id: "gbp-hours",
      title: "Business hours are listed",
      detail: hasHours ? "Your regular hours show on Google." : "Missing hours are one of the top reasons people pick another office.",
      passed: hasHours,
      weight: 3,
    },
    {
      id: "gbp-photos",
      title: "At least 10 photos on your profile",
      detail: "Office and team photos lift profile clicks.",
      value: photos >= 10 ? "10+ photos" : `${photos} photo${photos === 1 ? "" : "s"}`,
      passed: photos >= 10,
      weight: 3,
    },
  ];
  return { id: "google", name: "Google search", checks, score: scoreCategory(checks), sample: false };
}

function reviewsCategory(place: PlaceDetails, others: SearchResult[]): Category {
  const rating = place.rating;
  const count = place.userRatingCount ?? 0;

  const topRatings = others
    .slice(0, 5)
    .map((o) => o.rating)
    .filter((r): r is number => typeof r === "number");
  const localAvg = topRatings.length ? topRatings.reduce((a, b) => a + b, 0) / topRatings.length : null;

  const checks: Check[] = [
    {
      id: "rating",
      title: "Google rating of 4.7 or higher",
      detail: "Patients filter for highly rated offices.",
      value: rating ? `${rating.toFixed(1)} ★` : "No rating yet",
      passed: (rating ?? 0) >= 4.7,
      weight: 6,
    },
    {
      id: "review-count",
      title: "At least 100 Google reviews",
      detail: "Review count is a top local ranking signal.",
      value: `${count} review${count === 1 ? "" : "s"}`,
      passed: count >= 100,
      weight: 6,
    },
    {
      id: "vs-local",
      title: "Rated as well as the top practices near you",
      detail: localAvg
        ? `The top practices near you average ${localAvg.toFixed(1)} ★.`
        : "Patients compare you with the offices listed beside you.",
      passed: localAvg === null ? (rating ?? 0) >= 4.7 : (rating ?? 0) >= Math.round(localAvg * 10) / 10,
      weight: 4,
    },
  ];
  return { id: "reviews", name: "Reviews & listings", checks, score: scoreCategory(checks), sample: false };
}

const safeHost = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

const cantCheck = (host: string | null) =>
  host ? `We couldn't load ${host} to check this.` : "No website is linked on your Google profile, so patients can't check this either.";

function websiteCategory(
  t: (typeof PRACTICE_TYPES)[keyof typeof PRACTICE_TYPES],
  host: string | null,
  speed: SpeedResult | null,
  f: SiteFindings | null,
): Category {
  const checks: Check[] = [];

  if (speed) {
    checks.push({
      id: "speed",
      title: "Loads fast on a phone",
      detail:
        speed.source === "real visitors"
          ? `Patients on phones wait about ${speed.lcpSeconds}s for your main content. Aim for under 2.5 seconds.`
          : `In Google's mobile test, your main content took ${speed.lcpSeconds}s to appear. Aim for under 2.5 seconds.`,
      value: `${speed.lcpSeconds}s`,
      passed: speed.lcpSeconds <= 2.5,
      weight: 6,
    });
  } else if (!host) {
    checks.push({ id: "speed", title: "Loads fast on a phone", detail: cantCheck(null), passed: false, weight: 6 });
  }
  // If PageSpeed timed out on a real site, the speed check is left out rather than guessed.

  const found = f?.services ?? [];
  checks.push(
    {
      id: "tap-call",
      title: "Tap-to-call button on mobile",
      detail: f ? (f.tapToCall ? "Your phone number is tappable on mobile." : "Make your phone number a tap-to-call link. Most new-patient calls come from a phone.") : cantCheck(host),
      passed: Boolean(f?.tapToCall),
      weight: 5,
    },
    {
      id: "booking",
      title: "Online booking on your site",
      detail: f ? (f.booking ? "Patients can book or request a visit online." : "Add online booking so patients can book after hours, when many of them are searching.") : cantCheck(host),
      passed: Boolean(f?.booking),
      weight: 5,
    },
    {
      id: "service-pages",
      title: "Pages for your main services",
      detail: f
        ? found.length >= 3
          ? `Your homepage links to pages for ${listOf(found.slice(0, 4))}.`
          : `Add separate pages for ${t.services}. Each page helps you rank for that treatment.`
        : cantCheck(host),
      value: f ? `${found.length} found` : undefined,
      passed: found.length >= 3,
      weight: 5,
    },
    {
      id: "insurance",
      title: "Insurance and pricing info",
      detail: f
        ? f.insurance
          ? "Your homepage mentions insurance, financing or pricing."
          : 'Add an "insurance we accept" section. It answers the first question patients ask.'
        : cantCheck(host),
      passed: Boolean(f?.insurance),
      weight: 4,
    },
  );
  return { id: "web", name: "Website", checks, score: scoreCategory(checks), sample: false };
}

function aiCategory(sample: Category, host: string | null, f: SiteFindings | null, schemaType: string): Category {
  const kept = sample.checks
    .filter((c) => c.id === "chatgpt" || c.id === "ai-overviews")
    .map((c) => ({ ...c, sample: true }));
  const checks: Check[] = [
    ...kept,
    {
      id: "schema",
      title: "Structured data for your practice",
      detail: f
        ? f.localSchema
          ? "Your site tells search and AI tools your practice details in a format they read directly."
          : `Add ${schemaType} schema so AI tools can read your hours, location and services.`
        : cantCheck(host),
      value: f?.localSchema ? f.schemaTypes.find((x) => x.toLowerCase() !== "website" && x.toLowerCase() !== "webpage") : undefined,
      passed: Boolean(f?.localSchema),
      weight: 6,
    },
    {
      id: "faq",
      title: "Answers to common patient questions",
      detail: f
        ? f.faq
          ? "Your site has FAQ content that AI assistants can quote."
          : "Add an FAQ section. It's what AI assistants quote back to patients."
        : cantCheck(host),
      passed: Boolean(f?.faq),
      weight: 6,
    },
  ];
  return { id: "ai", name: "AI search", checks, score: scoreCategory(checks), sample: checks.every((c) => c.sample) };
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
