export type PracticeType = "dental" | "ortho" | "clinic" | "chiro" | "medspa" | "pt";

export type CategoryId = "google" | "web" | "reviews" | "ai";

export interface GradeRequest {
  practiceName: string;
  city: string;
  practiceType: PracticeType;
}

export interface Check {
  id: string;
  title: string;
  detail: string;
  /** Measured value shown beside the check, e.g. "4.2 ★" or "3.8s" */
  value?: string;
  passed: boolean;
  /** Points this check is worth inside its category */
  weight: number;
}

export interface Category {
  id: CategoryId;
  name: string;
  /** Score out of 25 */
  score: number;
  checks: Check[];
}

export interface Competitor {
  rank: number;
  name: string;
  rating: number;
  reviews: number;
  score: number;
  isYou?: boolean;
}

export interface Report {
  practiceName: string;
  city: string;
  practiceType: PracticeType;
  /** Score out of 100 */
  total: number;
  problems: number;
  missedPatientsPerMonth: number;
  missedRevenuePerYear: number;
  categories: Category[];
  competitors: Competitor[];
  searchPhrase: string;
  /** "sample" until stage 2 wires in live Google data */
  source: "sample" | "live";
  generatedAt: string;
}
