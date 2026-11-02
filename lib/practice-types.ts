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

export function isPracticeType(v: unknown): v is PracticeType {
  return typeof v === "string" && v in PRACTICE_TYPES;
}
