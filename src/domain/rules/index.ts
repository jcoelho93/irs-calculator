import type { TaxYearRules } from "./types";
import { PT_2026 } from "./pt2026";

/** Versioned by tax year. Add a new year by adding a module and registering it here. */
export const taxRules: Record<string, TaxYearRules> = {
  "2026": PT_2026,
};

export const supportedTaxYears = (): number[] => Object.keys(taxRules).map(Number).sort();

export class UnsupportedTaxYearError extends Error {
  constructor(year: number) {
    super(`No tax rules available for tax year ${year}`);
  }
}

export function getTaxRules(year: number, registry: Record<string, TaxYearRules> = taxRules): TaxYearRules {
  const r = registry[String(year)];
  if (!r) throw new UnsupportedTaxYearError(year);
  return r;
}

export { SOURCES, getSource } from "./sources";
export type { TaxYearRules, RuleSource } from "./types";
