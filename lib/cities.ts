/** City page helpers. Safe to use in the browser (no API keys here). */
import { CITY_CENTERS, SOUTH_BAY_CITIES, type SouthBayCity } from "./practice-types";

export const citySlug = (city: string) => city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const CITY_BY_SLUG: Record<string, SouthBayCity> = Object.fromEntries(
  SOUTH_BAY_CITIES.map((c) => [citySlug(c), c]),
);

/** The four parts of the South Bay, used on the home page and city pages. */
export const AREAS: { name: string; cities: SouthBayCity[] }[] = [
  { name: "Beach Cities", cities: ["Manhattan Beach", "Hermosa Beach", "Redondo Beach", "El Segundo"] },
  { name: "Torrance & central South Bay", cities: ["Torrance", "Gardena", "Lawndale", "Hawthorne", "Inglewood", "Lomita"] },
  { name: "Palos Verdes Peninsula", cities: ["Palos Verdes Estates", "Rancho Palos Verdes"] },
  { name: "Harbor Area", cities: ["San Pedro", "Wilmington", "Harbor City", "Carson"] },
];

export const areaOf = (city: SouthBayCity) => AREAS.find((a) => a.cities.includes(city))?.name ?? "South Bay";

/** Straight-line distance in miles between two city centers. */
function miles(a: SouthBayCity, b: SouthBayCity): number {
  const p = CITY_CENTERS[a];
  const q = CITY_CENTERS[b];
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(q.latitude - p.latitude);
  const dLng = rad(q.longitude - p.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p.latitude)) * Math.cos(rad(q.latitude)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** The closest other South Bay cities, nearest first. */
export function nearbyCities(city: SouthBayCity, count = 4): { city: SouthBayCity; miles: number }[] {
  return SOUTH_BAY_CITIES.filter((c) => c !== city)
    .map((c) => ({ city: c, miles: Math.round(miles(city, c) * 10) / 10 }))
    .sort((x, y) => x.miles - y.miles)
    .slice(0, count);
}
