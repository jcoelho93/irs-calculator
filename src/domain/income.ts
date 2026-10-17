import { D, ZERO, max, num, ratio } from "./money";
import { getTaxRules } from "./rules";
import type { Bracket, TaxYearRules } from "./rules/types";
import { calculateIrs } from "./tax/irs";
import type { IrsBreakdown } from "./tax/irs";

/** How the employment amount is entered. */
export type PayPeriod = "annual" | "monthly14" | "monthly12";

export const PERIOD_MONTHS: Record<PayPeriod, number> = { annual: 1, monthly14: 14, monthly12: 12 };

/**
 * Everything the calculator collects. The first block is what most people fill in; the rest are
 * advanced options where `null` means "use the default from the tax-year rules".
 */
export interface IncomeInput {
  taxYear: number;
  /** Category A (employment) gross pay, in the unit given by `employmentPeriod`. */
  employment: number;
  employmentPeriod: PayPeriod;
  /** Category B (self-employed) gross income for the year. */
  selfEmployed: number;
  /** Deductions from tax (deduções à coleta), e.g. copied from last year's assessment. */
  taxDeductions: number;

  // Advanced
  /** IRS Jovem benefit year in the tax year (1-10); 0 = not applicable. */
  irsJovemYear: number;
  /** Benefício municipal: share of the tax the municipality hands back (0.02 = 2%). */
  municipalBenefit: number;
  disabilityPct: number;
  /** Simplified-regime coefficient for Category B (0.75 = 75% of gross is taxable). */
  selfEmployedCoefficient: number | null;
  employeeSsRate: number | null;
  selfEmployedSsRate: number | null;
  selfEmployedSsBase: number | null;
  specificDeduction: number | null;
  brackets: Bracket[] | null;
  solidarity: boolean;
  /** IRS already withheld during the year, to show the refund or amount due. */
  withholding: number;
}

export const DEFAULT_INPUT: IncomeInput = {
  taxYear: 2026,
  employment: 0,
  employmentPeriod: "monthly14",
  selfEmployed: 0,
  taxDeductions: 0,
  irsJovemYear: 0,
  municipalBenefit: 0,
  disabilityPct: 0,
  selfEmployedCoefficient: null,
  employeeSsRate: null,
  selfEmployedSsRate: null,
  selfEmployedSsBase: null,
  specificDeduction: null,
  brackets: null,
  solidarity: true,
  withholding: 0,
};

export interface IncomeResult {
  rules: TaxYearRules;
  grossEmployment: number;
  grossSelfEmployed: number;
  grossTotal: number;
  selfEmployedCoefficient: number;
  ssEmployment: number;
  ssSelfEmployed: number;
  socialSecurity: number;
  irs: IrsBreakdown;
  netAnnual: number;
  /** Net per payment, using the employment period (12 if the amount was entered annually). */
  netPerMonth: number;
  monthsPerYear: number;
  effectiveIrsRate: number;
  effectiveTotalRate: number;
  /** Positive = to pay with the annual return, negative = refund. */
  withholdingBalance: number;
}

/** The rules with the user's overrides applied. */
export function effectiveRules(i: IncomeInput, base: TaxYearRules = getTaxRules(i.taxYear)): TaxYearRules {
  return {
    ...base,
    brackets: i.brackets && i.brackets.length > 0 ? i.brackets : base.brackets,
    specificDeductionCatA: i.specificDeduction ?? base.specificDeductionCatA,
    solidarity: i.solidarity ? base.solidarity : [],
  };
}

export function calculateIncome(i: IncomeInput, base?: TaxYearRules): IncomeResult {
  const rules = effectiveRules(i, base);
  const months = PERIOD_MONTHS[i.employmentPeriod];
  const grossA = D(Math.max(0, i.employment)).mul(months);
  const grossB = D(Math.max(0, i.selfEmployed));
  const coefficient = i.selfEmployedCoefficient ?? rules.categoryBCoefficients[0].coefficient;

  const ss = rules.socialSecurity;
  const ssA = grossA.mul(i.employeeSsRate ?? ss.employeeRate);
  const ssB = grossB.mul(i.selfEmployedSsBase ?? ss.selfEmployedBase).mul(i.selfEmployedSsRate ?? ss.selfEmployedRate);

  const irs = calculateIrs(
    {
      grossCategoryA: num(grossA),
      categoryB: { gross: num(grossB), taxable: num(grossB.mul(coefficient)) },
      disabilityPct: i.disabilityPct,
      // Only mandatory Category A contributions count towards the art. 25 deduction.
      socialSecurityContributions: num(ssA),
      otherTaxDeductions: i.taxDeductions,
      irsJovemYear: i.irsJovemYear,
      municipalBenefit: i.municipalBenefit,
    },
    rules,
  );

  const gross = grossA.plus(grossB);
  const social = D(num(ssA)).plus(num(ssB));
  const net = max(gross.minus(social).minus(irs.finalIrs), ZERO);
  const perMonth = i.employmentPeriod === "annual" ? 12 : months;

  return {
    rules,
    grossEmployment: num(grossA),
    grossSelfEmployed: num(grossB),
    grossTotal: num(gross),
    selfEmployedCoefficient: coefficient,
    ssEmployment: num(ssA),
    ssSelfEmployed: num(ssB),
    socialSecurity: num(social),
    irs,
    netAnnual: num(net),
    netPerMonth: num(net.div(perMonth)),
    monthsPerYear: perMonth,
    effectiveIrsRate: ratio(irs.finalIrs, gross),
    effectiveTotalRate: ratio(gross.minus(net), gross),
    withholdingBalance: num(D(irs.finalIrs).minus(Math.max(0, i.withholding))),
  };
}
