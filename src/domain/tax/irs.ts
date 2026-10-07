import type Decimal from "decimal.js";
import { D, ZERO, cents, max, min, num } from "../money";
import type { TaxYearRules } from "../rules/types";

export interface IrsInput {
  /** Gross category A income for the year (everything taxable as Cat A). */
  grossCategoryA: number;
  disabilityPct: number;
  socialSecurityContributions: number;
}

export interface IrsBreakdown {
  grossCategoryA: number;
  /** art. 56-A: part of gross income excluded for taxpayers with disability. */
  disabilityExclusion: number;
  consideredIncome: number;
  specificDeduction: number;
  taxableIncome: number;
  /** Tax on taxable income via progressive brackets (coleta). */
  bracketTax: number;
  /** art. 87 credit actually used. */
  disabilityCredit: number;
  solidaritySurcharge: number;
  finalIrs: number;
  marginalRate: number;
}

export const hasFiscalDisability = (pct: number, rules: TaxYearRules): boolean =>
  pct >= rules.disability.minIncapacityPct;

/** Progressive tax by slicing taxable income through the brackets. */
export function progressiveTax(taxable: Decimal.Value, rules: TaxYearRules): { tax: Decimal; marginal: number } {
  let remaining = D(taxable);
  let lower = ZERO;
  let tax = ZERO;
  let marginal = rules.brackets[0].rate;
  for (const b of rules.brackets) {
    if (remaining.lte(0)) break;
    const upper = b.upTo === null ? null : D(b.upTo);
    const width = upper === null ? remaining : min(remaining, upper.minus(lower));
    tax = tax.plus(width.mul(b.rate));
    marginal = b.rate;
    remaining = remaining.minus(width);
    if (upper !== null) lower = upper;
  }
  return { tax, marginal };
}

export function solidaritySurcharge(taxable: Decimal.Value, rules: TaxYearRules): Decimal {
  const t = D(taxable);
  return rules.solidarity.reduce<Decimal>((acc, band) => {
    const top = band.to === null ? t : min(t, band.to);
    const slice = max(top.minus(band.from), 0);
    return acc.plus(slice.mul(band.rate));
  }, ZERO);
}

/**
 * Estimated FINAL annual IRS (liquidation) for a single taxpayer with Category A income.
 * Not modelled: dependents/general-expense/health deductions, mínimo de existência (art. 70),
 * joint taxation (quociente conjugal), other categories, autonomous rates, withholding.
 */
export function calculateIrs(input: IrsInput, rules: TaxYearRules): IrsBreakdown {
  const gross = D(Math.max(0, input.grossCategoryA));
  const disabled = hasFiscalDisability(input.disabilityPct, rules);

  // art. 56-A: only 85% considered; excluded part capped per category.
  const exclusion = disabled
    ? min(gross.mul(1 - rules.disability.categoryAConsideredShare), rules.disability.maxExcludedPerCategory)
    : ZERO;
  const considered = gross.minus(exclusion);

  // art. 25: greater of the fixed deduction and mandatory contributions; can't exceed income.
  const specific = min(max(rules.specificDeductionCatA, D(input.socialSecurityContributions)), considered);
  const taxable = max(considered.minus(specific), 0);

  const { tax, marginal } = progressiveTax(taxable, rules);
  const bracketTax = cents(tax);

  // art. 87: credit against computed tax, cannot make it negative.
  const credit = disabled ? min(bracketTax, D(rules.ias).mul(rules.disability.taxpayerCreditIasMultiple)) : ZERO;
  const solidarity = cents(solidaritySurcharge(taxable, rules));
  const final = bracketTax.minus(cents(credit)).plus(solidarity);

  return {
    grossCategoryA: num(gross),
    disabilityExclusion: num(exclusion),
    consideredIncome: num(considered),
    specificDeduction: num(specific),
    taxableIncome: num(taxable),
    bracketTax: num(bracketTax),
    disabilityCredit: num(credit),
    solidaritySurcharge: num(solidarity),
    finalIrs: num(max(final, 0)),
    marginalRate: taxable.isZero() ? rules.brackets[0].rate : marginal,
  };
}
