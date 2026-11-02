/**
 * Server-only helpers for the Google Places API (New).
 * The key never reaches the browser; the browser talks to our /api routes.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/op-overview
 */
import "server-only";
import { SOUTH_BAY_BOUNDS } from "./practice-types";

// Overridable so tests can point at a local mock server.
const BASE = process.env.GOOGLE_PLACES_BASE_URL || "https://places.googleapis.com/v1";
const TIMEOUT_MS = 8000;

export class PlacesError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PlacesError";
  }
}

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

async function call<T>(path: string, init: { method: "GET" | "POST"; fieldMask: string; body?: unknown }): Promise<T> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError("GOOGLE_PLACES_API_KEY is not set");
  const res = await fetch(`${BASE}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": init.fieldMask,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    // Log Google's message for debugging in Vercel logs; never echo it to the browser.
    const text = await res.text().catch(() => "");
    console.error(`[places] ${init.method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    throw new PlacesError(`Places request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

/* ---------- Autocomplete ---------- */

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
}

export interface Suggestion {
  placeId: string;
  name: string;
  detail: string;
}

export async function autocomplete(input: string, sessionToken?: string): Promise<Suggestion[]> {
  const data = await call<AutocompleteResponse>("/places:autocomplete", {
    method: "POST",
    fieldMask:
      "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    body: {
      input,
      sessionToken,
      includedRegionCodes: ["us"],
      includedPrimaryTypes: ["establishment"],
      locationRestriction: { rectangle: SOUTH_BAY_BOUNDS },
    },
  });
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((p) => ({
      placeId: p.placeId,
      name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      detail: p.structuredFormat?.secondaryText?.text ?? "",
    }))
    .slice(0, 5);
}

/* ---------- Place details ---------- */

export interface PlaceDetails {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  reviews?: { publishTime?: string; rating?: number }[];
  photos?: { name: string }[];
  businessStatus?: string;
  googleMapsUri?: string;
}

const DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "websiteUri",
  "nationalPhoneNumber",
  "regularOpeningHours",
  "reviews",
  "photos",
  "businessStatus",
  "googleMapsUri",
].join(",");

export async function placeDetails(placeId: string, sessionToken?: string): Promise<PlaceDetails> {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  return call<PlaceDetails>(`/places/${encodeURIComponent(placeId)}${qs}`, {
    method: "GET",
    fieldMask: DETAILS_FIELDS,
  });
}

/* ---------- Text search (local map results) ---------- */

export interface SearchResult {
  id: string;
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
}

export async function searchNearby(
  query: string,
  center: { latitude: number; longitude: number },
): Promise<SearchResult[]> {
  const data = await call<{ places?: SearchResult[] }>("/places:searchText", {
    method: "POST",
    fieldMask: "places.id,places.displayName,places.rating,places.userRatingCount",
    body: {
      textQuery: query,
      pageSize: 20,
      locationBias: { circle: { center, radius: 5000 } },
    },
  });
  return data.places ?? [];
}
