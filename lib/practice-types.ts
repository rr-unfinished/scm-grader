import type { PracticeType } from "./types";

export interface PracticeTypeInfo {
  label: string;
  /** What a patient types: "dentist near me" */
  noun: string;
  plural: string;
  /** Average first-year value of a new patient, USD */
  patientValue: number;
  /** Typical monthly new-patient searches a well-ranked practice captures */
  baseMonthlyPatients: number;
  services: string;
  schemaType: string;
  competitorSuffix: string;
  /** Query sent to Google to find the local map results */
  searchQuery: string;
  /** Google place types that count as the right primary category */
  expectedTypes: string[];
  /** Words that, in Google's category label, count as the right category */
  categoryKeywords: string[];
}

export const PRACTICE_TYPES: Record<PracticeType, PracticeTypeInfo> = {
  dental: {
    label: "Dental",
    noun: "dentist",
    plural: "dental practices",
    patientValue: 1200,
    baseMonthlyPatients: 34,
    services: "implants, Invisalign and cleanings",
    schemaType: "Dentist",
    competitorSuffix: "Family Dental",
    searchQuery: "dentist",
    expectedTypes: ["dentist", "dental_clinic"],
    categoryKeywords: ["dentist", "dental"],
  },
  ortho: {
    label: "Orthodontics",
    noun: "orthodontist",
    plural: "orthodontic practices",
    patientValue: 5200,
    baseMonthlyPatients: 12,
    services: "braces, Invisalign and retainers",
    schemaType: "Dentist",
    competitorSuffix: "Orthodontics",
    searchQuery: "orthodontist",
    // Google's API has no orthodontist type; orthodontists come back as "Dentist".
    expectedTypes: ["orthodontist", "dentist", "dental_clinic"],
    categoryKeywords: ["orthodont", "dentist", "dental"],
  },
  clinic: {
    label: "Medical clinic",
    noun: "urgent care clinic",
    plural: "medical clinics",
    patientValue: 450,
    baseMonthlyPatients: 60,
    services: "urgent care, physicals and vaccines",
    schemaType: "MedicalClinic",
    competitorSuffix: "Medical Group",
    searchQuery: "urgent care",
    expectedTypes: ["doctor", "medical_clinic", "medical_center", "urgent_care_center", "hospital"],
    categoryKeywords: ["urgent care", "clinic", "medical", "doctor", "physician"],
  },
  chiro: {
    label: "Chiropractic",
    noun: "chiropractor",
    plural: "chiropractic practices",
    patientValue: 900,
    baseMonthlyPatients: 28,
    services: "adjustments, sports injury and back pain",
    schemaType: "Chiropractic",
    competitorSuffix: "Chiropractic",
    searchQuery: "chiropractor",
    expectedTypes: ["chiropractor"],
    categoryKeywords: ["chiropract"],
  },
  medspa: {
    label: "Med spa",
    noun: "med spa",
    plural: "med spas",
    patientValue: 1500,
    baseMonthlyPatients: 26,
    services: "Botox, fillers and laser treatments",
    schemaType: "MedicalBusiness",
    competitorSuffix: "Aesthetics",
    searchQuery: "med spa",
    // Google's API often reports med spas as plain "Spa".
    expectedTypes: ["medical_spa", "skin_care_clinic", "spa"],
    categoryKeywords: ["med spa", "medical spa", "skin care", "aesthetic", "spa"],
  },
  pt: {
    label: "Physical therapy",
    noun: "physical therapist",
    plural: "physical therapy practices",
    patientValue: 1300,
    baseMonthlyPatients: 22,
    services: "post-surgery rehab and sports injury",
    schemaType: "PhysicalTherapy",
    competitorSuffix: "Physical Therapy",
    searchQuery: "physical therapist",
    expectedTypes: ["physiotherapist", "physical_therapist"],
    categoryKeywords: ["physical therap", "physiotherap"],
  },
};

export const SOUTH_BAY_CITIES = [
  "Torrance",
  "Redondo Beach",
  "Manhattan Beach",
  "Hermosa Beach",
  "El Segundo",
  "Gardena",
  "Palos Verdes Estates",
  "Rancho Palos Verdes",
  "Lomita",
  "Carson",
  "Hawthorne",
  "Lawndale",
  "Inglewood",
  "Harbor City",
  "San Pedro",
  "Wilmington",
] as const;

export type SouthBayCity = (typeof SOUTH_BAY_CITIES)[number];

/** Approximate city centers. Map rank is measured as if searching from here. */
export const CITY_CENTERS: Record<SouthBayCity, { latitude: number; longitude: number }> = {
  Torrance: { latitude: 33.8358, longitude: -118.3406 },
  "Redondo Beach": { latitude: 33.8492, longitude: -118.3884 },
  "Manhattan Beach": { latitude: 33.8847, longitude: -118.4109 },
  "Hermosa Beach": { latitude: 33.8622, longitude: -118.3995 },
  "El Segundo": { latitude: 33.9192, longitude: -118.4165 },
  Gardena: { latitude: 33.8883, longitude: -118.309 },
  "Palos Verdes Estates": { latitude: 33.8006, longitude: -118.3901 },
  "Rancho Palos Verdes": { latitude: 33.7445, longitude: -118.387 },
  Lomita: { latitude: 33.7922, longitude: -118.3151 },
  Carson: { latitude: 33.8317, longitude: -118.2817 },
  Hawthorne: { latitude: 33.9164, longitude: -118.3526 },
  Lawndale: { latitude: 33.8872, longitude: -118.3526 },
  Inglewood: { latitude: 33.9617, longitude: -118.3531 },
  "Harbor City": { latitude: 33.79, longitude: -118.2981 },
  "San Pedro": { latitude: 33.7361, longitude: -118.2922 },
  Wilmington: { latitude: 33.7803, longitude: -118.2626 },
};

/** A box around the South Bay, used to keep autocomplete results local. */
export const SOUTH_BAY_BOUNDS = {
  low: { latitude: 33.69, longitude: -118.5 },
  high: { latitude: 34.0, longitude: -118.2 },
};

export function isPracticeType(v: unknown): v is PracticeType {
  return typeof v === "string" && v in PRACTICE_TYPES;
}

export function isSouthBayCity(v: unknown): v is SouthBayCity {
  return typeof v === "string" && (SOUTH_BAY_CITIES as readonly string[]).includes(v);
}

/**
 * Finds the South Bay city in an address like "Hawthorne Blvd, Torrance, CA, USA".
 * Only whole comma-separated parts count, so a street name never matches.
 */
export function cityFromAddress(address: string): SouthBayCity | null {
  const parts = address.split(",").map((s) => s.trim().toLowerCase());
  for (let i = parts.length - 1; i >= 0; i--) {
    const hit = SOUTH_BAY_CITIES.find((c) => c.toLowerCase() === parts[i]);
    if (hit) return hit;
  }
  return null;
}
