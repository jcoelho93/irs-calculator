import { calculateScenario } from "./calculations/scenario";
import type { CalculationResult } from "./calculations/types";
import { D, num } from "./money";
import { newParcel, newScenario } from "./scenario/defaults";
import type { Scenario } from "./scenario/types";
import { getTaxRules } from "./rules";
import type { TaxYearRules } from "./rules/types";

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
  /** Lawyer fee as % of the total. */
  lawyerPct: number;
  /** True if the quoted fee % does not include VAT (23% is added on top). */
  lawyerVatExcluded: boolean;
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
  lawyerVatExcluded: false,
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
  s.lawyer = { mode: "percentage", percentage: i.lawyerPct, fixedAmount: 0, vatRate: 23, vatIncluded: !i.lawyerVatExcluded };
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
