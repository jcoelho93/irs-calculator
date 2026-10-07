import type { TaxYearRules } from "./types";

/** Portuguese rules for IRS 2026 (income earned in 2026, mainland rate table). */
export const PT_2026: TaxYearRules = {
  taxYear: 2026,
  ias: 537.13,
  brackets: [
    { upTo: 8342, rate: 0.125 },
    { upTo: 12587, rate: 0.157 },
    { upTo: 17838, rate: 0.212 },
    { upTo: 23089, rate: 0.241 },
    { upTo: 29397, rate: 0.311 },
    { upTo: 43090, rate: 0.349 },
    { upTo: 46566, rate: 0.431 },
    { upTo: 86634, rate: 0.446 },
    { upTo: null, rate: 0.48 },
  ],
  specificDeductionCatA: 4587.09,
  disability: {
    minIncapacityPct: 60,
    categoryAConsideredShare: 0.85,
    maxExcludedPerCategory: 2500,
    taxpayerCreditIasMultiple: 4,
  },
  solidarity: [
    { from: 80000, to: 250000, rate: 0.025 },
    { from: 250000, to: null, rate: 0.05 },
  ],
  terminationIndemnity: { excessInclusionRate: 1 },
  sourceIds: [
    "irs-brackets-2026",
    "specific-deduction-2026",
    "termination-indemnity-2026",
    "disability-56a",
    "disability-87",
    "solidarity-68a",
    "damages-treatment",
    "accrued-rights",
    "lawyer-fees",
  ],
};
