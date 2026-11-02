export type PracticeType = "dental" | "ortho" | "clinic" | "chiro" | "medspa" | "pt";

export type CategoryId = "google" | "web" | "reviews" | "ai";

export interface GradeRequest {
  practiceName: string;
  city: string;
  practiceType: PracticeType;
  /** Google place ID from autocomplete. Without it the report uses sample data. */
  placeId?: string;
  /** Autocomplete session token, reused on Place Details for Google billing */
  sessionToken?: string;
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
  /** True while this one check still uses sample data */
  sample?: boolean;
}

export interface Category {
  id: CategoryId;
  name: string;
  /** Score out of 25 */
  score: number;
  checks: Check[];
  /** True while every check in this category still uses sample data */
  sample: boolean;
  /** Shown above the checks, e.g. why some checks were skipped */
  note?: string;
  /** Nothing in this category could be measured; it's left out of the total */
  skipped?: boolean;
}

export interface Competitor {
  /** Position in the local Google results; null when outside the top 20 */
  rank: number | null;
  name: string;
  rating?: number;
  reviews?: number;
  isYou?: boolean;
}

export interface Report {
  practiceName: string;
  address?: string;
  mapsUri?: string;
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
  /** "live" when Google data was used; "sample" for the stage 1 fallback */
  source: "sample" | "live";
  generatedAt: string;
  /** Short error codes for checks that failed to run (not shown in the UI) */
  diagnostics?: string[];
}
