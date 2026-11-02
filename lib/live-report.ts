/**
 * Stage 2: live Google data for the Google search and Reviews categories.
 * Website (stage 3) and AI search (stage 4) still come from sample data.
 */
import "server-only";
import { placeDetails, searchNearby, type PlaceDetails, type SearchResult } from "./google-places";
import { CITY_CENTERS, PRACTICE_TYPES, isSouthBayCity } from "./practice-types";
import { mergeYou, sampleCategories } from "./sample-report";
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

  const google = googleCategory(place, rank, req.city, t);
  const reviews = reviewsCategory(place, others);
  const sample = sampleCategories({ ...req, practiceName: name }, ["web", "ai"]).categories;
  const categories = [google, sample[0], reviews, sample[1]];
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
