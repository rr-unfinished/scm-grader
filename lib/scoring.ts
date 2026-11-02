import { PRACTICE_TYPES } from "./practice-types";
import type { Category, Check, PracticeType } from "./types";

/** Each category is worth 25 points; checks inside it are weighted. */
export function scoreCategory(checks: Check[]): number {
  const total = checks.reduce((a, c) => a + c.weight, 0);
  const earned = checks.reduce((a, c) => a + (c.passed ? c.weight : 0), 0);
  return total === 0 ? 0 : Math.round((earned / total) * 25);
}

export function summarize(categories: Category[], practiceType: PracticeType) {
  const t = PRACTICE_TYPES[practiceType];
  // Categories we couldn't measure are left out, and the rest scaled to 100.
  const measured = categories.filter((c) => !c.skipped);
  const raw = measured.reduce((a, c) => a + c.score, 0);
  const total = measured.length ? Math.round((raw * 100) / (measured.length * 25)) : 0;
  const problems = categories.reduce((a, c) => a + c.checks.filter((x) => !x.passed).length, 0);
  // Rough estimate: the further below 100, the larger the share of local searches lost.
  const missedPatientsPerMonth = Math.max(2, Math.round((t.baseMonthlyPatients * (100 - total)) / 100));
  const missedRevenuePerYear = missedPatientsPerMonth * 12 * t.patientValue;
  return { total, problems, missedPatientsPerMonth, missedRevenuePerYear };
}

export type Grade = "strong" | "needs-work" | "poor";

export function gradeOf(score: number, max: number): Grade {
  const f = score / max;
  if (f >= 0.8) return "strong";
  if (f >= 0.55) return "needs-work";
  return "poor";
}

export const GRADE_LABEL: Record<Grade, string> = {
  strong: "Strong",
  "needs-work": "Needs work",
  poor: "Poor",
};
