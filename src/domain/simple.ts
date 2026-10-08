import { calculateScenario } from "./calculations/scenario";
import type { CalculationResult } from "./calculations/types";
import { D, num } from "./money";
import { newParcel, newScenario } from "./scenario/defaults";
import type { Scenario } from "./scenario/types";
import { getTaxRules } from "./rules";
import type { TaxYearRules } from "./rules/types";
import { calculateIrs } from "./tax/irs";

/** The handful of inputs the simple UI collects. */
export interface SimpleInput {
  /** Total compensation to be received. */
  total: number;
  /** Part of the total that is accrued pay owed anyway (holiday pay, arrears, allowances). */
  accrued: number;
  startDate: string;
  endDate: string;
  /** Average monthly regular pay over the last 12 months (incl. holiday/Christmas allowances / 12). */
  avgMonthlyPay: number;
  disabilityPct: number;
  /** Other taxable employment income in the payment year. */
  otherIncome: number;
  /** Lawyer fee as % of the total, VAT included. */
  lawyerPct: number;
}

export const EMPTY_INPUT: SimpleInput = {
  total: 0,
  accrued: 0,
  startDate: "",
  endDate: "",
  avgMonthlyPay: 0,
  disabilityPct: 0,
  otherIncome: 0,
  lawyerPct: 0,
};

/** Map the simple inputs onto the full scenario model used by the engine. */
export function toScenario(i: SimpleInput): Scenario {
  const s = newScenario("Simple");
  const accrued = Math.min(Math.max(i.accrued, 0), Math.max(i.total, 0));
  s.employment.startDate = i.startDate;
  s.employment.terminationDate = i.endDate;
  s.employment.avgMonthlyRemuneration = i.avgMonthlyPay;
  s.tax.disabilityPct = i.disabilityPct;
  s.tax.otherAnnualIncome = i.otherIncome;
  s.lawyer = { mode: "percentage", percentage: i.lawyerPct, fixedAmount: 0, vatRate: 23, vatIncluded: true };
  s.settlementTotal = i.total;
  s.parcels = [
    newParcel({ name: "Termination compensation", amount: num(D(i.total).minus(accrued)), category: "termination_indemnity" }),
    newParcel({ name: "Accrued pay", amount: accrued, category: "salary_arrears" }),
  ];
  return s;
}

export function calculateSimple(i: SimpleInput, rules: TaxYearRules = getTaxRules(2026)): CalculationResult {
  return calculateScenario(toScenario(i), rules);
}

export interface SpreadResult {
  shareNextYear: number;
  estimatedIRS: number;
  netCash: number;
}

/**
 * IRS if the taxable part is paid partly in the following year. Only meaningful when the
 * agreement genuinely pays in instalments across years. Assumes the same rules apply next year.
 * Tax is progressive per year, so splitting a large taxable amount can lower the total.
 */
export function spreadAcrossYears(
  i: SimpleInput,
  shareNextYear: number,
  otherIncomeNextYear: number,
  rules: TaxYearRules = getTaxRules(2026),
): SpreadResult {
  const base = calculateSimple(i, rules);
  const taxable = D(base.taxableSettlement);
  const next = taxable.mul(shareNextYear);
  const common = { disabilityPct: i.disabilityPct, socialSecurityContributions: 0 };
  const irs = (income: unknown) => calculateIrs({ ...common, grossCategoryA: num(income as number) }, rules).finalIrs;
  const y1 = D(irs(D(i.otherIncome).plus(taxable.minus(next)))).minus(irs(i.otherIncome));
  const y2 = D(irs(D(otherIncomeNextYear).plus(next))).minus(irs(otherIncomeNextYear));
  const tax = num(y1.plus(y2));
  const net = num(D(base.grossSettlement).minus(tax).minus(base.lawyerFee));
  return { shareNextYear, estimatedIRS: tax, netCash: net };
}
