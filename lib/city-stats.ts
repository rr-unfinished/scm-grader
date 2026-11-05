/**
 * Real local numbers for each city page, from the same Google search the
 * grader uses ("dentist" near the city center). Cached for a day, so 16
 * city pages cost at most 16 searches a day.
 * Returns null without a key or if Google can't be reached; the page still renders.
 */
import "server-only";
import { placesConfigured, searchNearby } from "./google-places";
import { CITY_CENTERS, type SouthBayCity } from "./practice-types";

export const STATS_REFRESH_SECONDS = 24 * 60 * 60;

export interface CityStats {
  /** Practices in Google's top 20 for the search */
  found: number;
  /** Of the first 10 with ratings */
  avgRating: number;
  medianReviews: number;
  with100Reviews: number;
  rated48: number;
  sample: number;
  top: { name: string; rating?: number; reviews?: number; mapsUri?: string }[];
  fetchedAt: string;
}

export async function cityStats(city: SouthBayCity): Promise<CityStats | null> {
  if (!placesConfigured()) return null;
  try {
    const results = await searchNearby("dentist", CITY_CENTERS[city], {
      revalidateSeconds: STATS_REFRESH_SECONDS,
      withMapsLink: true,
    });
    const rated = results.filter((r) => typeof r.rating === "number").slice(0, 10);
    if (rated.length < 3) return null;
    const ratings = rated.map((r) => r.rating!);
    const reviews = rated.map((r) => r.userRatingCount ?? 0).sort((a, b) => a - b);
    const mid = Math.floor(reviews.length / 2);
    return {
      found: results.length,
      avgRating: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
      medianReviews: reviews.length % 2 ? reviews[mid] : Math.round((reviews[mid - 1] + reviews[mid]) / 2),
      with100Reviews: rated.filter((r) => (r.userRatingCount ?? 0) >= 100).length,
      rated48: rated.filter((r) => (r.rating ?? 0) >= 4.8).length,
      sample: rated.length,
      top: results.slice(0, 5).map((r) => ({
        name: r.displayName?.text ?? "Unnamed practice",
        rating: r.rating,
        reviews: r.userRatingCount,
        mapsUri: r.googleMapsUri,
      })),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[city-stats] ${city}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
