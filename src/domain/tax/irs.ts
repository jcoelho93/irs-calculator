import type Decimal from "decimal.js";
import { D, ZERO, cents, max, min, num } from "../money";
import type { TaxYearRules } from "../rules/types";

export interface IrsInput {
  /** Gross category A income for the year (everything taxable as Cat A). */
  grossCategoryA: number;
  /**
   * Category B (self-employed). `gross` is the gross income; `taxable` is the amount taxable after
   * the regime (simplified-regime coefficient or organised-accounting profit), before art. 56-A.
   * The art. 56-A exclusion is computed on the gross figure and the result is scaled by
   * taxable/gross. The order versus the coefficient is NOT confirmed by an official source.
   */
  categoryB?: { gross: number; taxable: number };
  disabilityPct: number;
  socialSecurityContributions: number;
}

export interface IrsBreakdown {
  grossCategoryA: number;
  /** art. 56-A: part of gross income excluded for taxpayers with disability (A + B). */
  disabilityExclusion: number;
  disabilityExclusionA: number;
  disabilityExclusionB: number;
  /** Category B income taxable after the regime and art. 56-A. */
  taxableCategoryB: number;
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
  const d = rules.disability;

  // art. 56-A: only 85% considered; the excluded part is capped PER CATEGORY.
  const exclude = (g: Decimal) => (disabled ? min(g.mul(1 - d.categoryAConsideredShare), d.maxExcludedPerCategory) : ZERO);

  const exclA = exclude(gross);
  const consideredA = gross.minus(exclA);

  // Category B: no art. 25 specific deduction.
  const bGross = D(Math.max(0, input.categoryB?.gross ?? 0));
  const bTaxableRaw = min(D(Math.max(0, input.categoryB?.taxable ?? 0)), bGross);
  const exclB = exclude(bGross);
  const consideredB = bGross.minus(exclB);
  const taxableB = bGross.isZero() ? ZERO : consideredB.mul(bTaxableRaw).div(bGross);

  // art. 25: greater of the fixed deduction and mandatory contributions; can't exceed Cat A income.
  const specific = min(max(rules.specificDeductionCatA, D(input.socialSecurityContributions)), consideredA);
  const taxable = max(consideredA.minus(specific).plus(taxableB), 0);

  const { tax, marginal } = progressiveTax(taxable, rules);
  const bracketTax = cents(tax);

  // art. 87: one credit per taxpayer (not per category), cannot make tax negative.
  const credit = disabled ? min(bracketTax, D(rules.ias).mul(d.taxpayerCreditIasMultiple)) : ZERO;
  const solidarity = cents(solidaritySurcharge(taxable, rules));
  const final = bracketTax.minus(cents(credit)).plus(solidarity);

  return {
    grossCategoryA: num(gross),
    disabilityExclusion: num(exclA.plus(exclB)),
    disabilityExclusionA: num(exclA),
    disabilityExclusionB: num(exclB),
    taxableCategoryB: num(taxableB),
    consideredIncome: num(consideredA.plus(consideredB)),
    specificDeduction: num(specific),
    taxableIncome: num(taxable),
    bracketTax: num(bracketTax),
    disabilityCredit: num(credit),
    solidaritySurcharge: num(solidarity),
    finalIrs: num(max(final, 0)),
    marginalRate: taxable.isZero() ? rules.brackets[0].rate : marginal,
  };
}
