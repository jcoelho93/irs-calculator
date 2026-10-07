import { D, cents, max, num } from "../money";
import type { TaxYearRules } from "../rules/types";
import type { Seniority } from "../calculations/duration";

export interface TerminationThreshold {
  /** Average monthly regular remuneration used. */
  avgMonthlyRemuneration: number;
  /** Years (or fraction) of seniority used as multiplier. */
  years: number;
  /** avg monthly remuneration x years: the amount that is not taxed (art. 2(4)). */
  threshold: number;
  exclusionLost: boolean;
  steps: string[];
}

/**
 * Qualifying amount for termination compensation:
 *   threshold = avg monthly regular remuneration (12m) x (years or fraction of seniority)
 * Compensation up to the threshold is not taxed; the excess is taxed (at `excessInclusionRate`).
 * Exclusion is lost entirely if the worker is re-linked to the same entity within 24 months.
 * Returns null when inputs required for the threshold are missing.
 */
export function terminationThreshold(
  avgMonthlyRemuneration: number,
  seniority: Seniority | null,
  rehiredWithin24Months: boolean,
): TerminationThreshold | null {
  if (!seniority || !(avgMonthlyRemuneration > 0)) return null;
  const threshold = cents(D(avgMonthlyRemuneration).mul(seniority.yearsOrFraction));
  const steps = [
    `Average monthly regular remuneration (last 12 months): ${avgMonthlyRemuneration}`,
    `Seniority: ${seniority.fullYears} full year(s) + fraction = ${seniority.yearsOrFraction} year(s) or fraction`,
    `Threshold = ${avgMonthlyRemuneration} x ${seniority.yearsOrFraction} = ${num(threshold)}`,
  ];
  if (rehiredWithin24Months) steps.push("New link with the same entity within 24 months: exclusion does not apply.");
  return {
    avgMonthlyRemuneration,
    years: seniority.yearsOrFraction,
    threshold: rehiredWithin24Months ? 0 : num(threshold),
    exclusionLost: rehiredWithin24Months,
    steps,
  };
}

/** Split an amount against what remains of the threshold. */
export function applyThreshold(
  amount: number,
  remainingThreshold: number,
  rules: TaxYearRules,
): { excluded: number; taxable: number; remainingAfter: number } {
  const used = D(Math.min(amount, remainingThreshold));
  const excess = max(D(amount).minus(used), 0);
  const taxable = cents(excess.mul(rules.terminationIndemnity.excessInclusionRate));
  const excluded = D(amount).minus(taxable);
  return { excluded: num(excluded), taxable: num(taxable), remainingAfter: num(max(D(remainingThreshold).minus(used), 0)) };
}
