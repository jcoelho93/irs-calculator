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
  irsJovem: { exemptShareByYear: [1, 0.75, 0.75, 0.75, 0.5, 0.5, 0.5, 0.25, 0.25, 0.25], capIasMultiple: 55 },
  maxMunicipalBenefit: 0.05,
  socialSecurity: { employeeRate: 0.11, selfEmployedRate: 0.214, selfEmployedBase: 0.7 },
  categoryBCoefficients: [
    { id: "professional", label: "Atividades profissionais da tabela do art. 151.º", coefficient: 0.75 },
    { id: "services", label: "Outras prestações de serviços", coefficient: 0.35 },
    { id: "sales", label: "Vendas de mercadorias e produtos", coefficient: 0.15 },
  ],
  sourceIds: [
    "irs-brackets-2026",
    "specific-deduction-2026",
    "disability-56a",
    "disability-87",
    "solidarity-68a",
    "category-b-coefficients",
    "social-security",
    "irs-jovem",
    "municipal-benefit",
  ],
};
