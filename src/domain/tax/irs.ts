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
  /** Deductions from tax (deduções à coleta): dependents, general expenses, health, education, housing... */
  otherTaxDeductions?: number;
  /** IRS Jovem benefit year (1-10); 0 or absent = not applicable. */
  irsJovemYear?: number;
  /** Share of the net tax handed back by the municipality (0.05 = 5%). */
  municipalBenefit?: number;
}

export interface IrsBreakdown {
  grossCategoryA: number;
  /** art. 56-A: part of gross income excluded for taxpayers with disability (A + B). */
  disabilityExclusion: number;
  disabilityExclusionA: number;
  disabilityExclusionB: number;
  /** IRS Jovem: gross A + B income exempted (art. 12-B), counted only to set the rate. */
  irsJovemExempt: number;
  irsJovemExemptA: number;
  irsJovemExemptB: number;
  /** Category B income taxable after the regime and art. 56-A. */
  taxableCategoryB: number;
  consideredIncome: number;
  specificDeduction: number;
  taxableIncome: number;
  /** Tax on taxable income via progressive brackets, after removing the share of exempt income. */
  bracketTax: number;
  /** Bracket tax plus solidarity surcharge (coleta total). */
  grossTax: number;
  /** art. 87 credit actually used. */
  disabilityCredit: number;
  /** Other deductions from tax actually used (capped at the remaining tax). */
  otherDeductions: number;
  solidaritySurcharge: number;
  /** Benefício municipal handed back. */
  municipalBenefit: number;
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
    // Guard against user-edited limits that are not ascending.
    const width = upper === null ? remaining : max(min(remaining, upper.minus(lower)), 0);
    tax = tax.plus(width.mul(b.rate));
    marginal = b.rate;
    remaining = remaining.minus(width);
    if (upper !== null) lower = max(lower, upper);
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
 * Estimated FINAL annual IRS (liquidation) for a single taxpayer with Category A and B income.
 * Deductions from tax are taken as one total. Includes IRS Jovem and the benefício municipal. Not modelled: mínimo de existência (art. 70),
 * art. 78 caps on deductions, joint taxation (quociente conjugal), other categories, autonomous rates.
 */
export function calculateIrs(input: IrsInput, rules: TaxYearRules): IrsBreakdown {
  const grossAIn = D(Math.max(0, input.grossCategoryA));
  const bGrossIn = D(Math.max(0, input.categoryB?.gross ?? 0));
  const disabled = hasFiscalDisability(input.disabilityPct, rules);
  const d = rules.disability;

  // art. 56-A: only 85% considered; the excluded part is capped PER CATEGORY.
  const exclude = (g: Decimal) => (disabled ? min(g.mul(1 - d.categoryAConsideredShare), d.maxExcludedPerCategory) : ZERO);
  const exclA = exclude(grossAIn);
  const exclB = exclude(bGrossIn);

  // art. 12-B (IRS Jovem): a share of what remains is exempt, with one cap for A and B together.
  // Order (art. 56-A first, then IRS Jovem, then the B coefficient) reconciles exactly with a real
  // assessment; the A-before-B order for the cap is not confirmed.
  const jy = Math.floor(input.irsJovemYear ?? 0);
  const share = jy >= 1 ? (rules.irsJovem.exemptShareByYear[jy - 1] ?? 0) : 0;
  const cap = D(rules.ias).mul(rules.irsJovem.capIasMultiple);
  const jovemA = min(grossAIn.minus(exclA).mul(share), cap);
  const jovemB = min(bGrossIn.minus(exclB).mul(share), cap.minus(jovemA));
  const exempt = jovemA.plus(jovemB);

  const consideredA = grossAIn.minus(exclA).minus(jovemA);

  // Category B: no art. 25 specific deduction. The regime coefficient (taxable/gross) is applied
  // to what is left after art. 56-A and IRS Jovem.
  const bTaxableRaw = min(D(Math.max(0, input.categoryB?.taxable ?? 0)), bGrossIn);
  const consideredB = bGrossIn.minus(exclB).minus(jovemB);
  const taxableB = bGrossIn.isZero() ? ZERO : consideredB.mul(bTaxableRaw).div(bGrossIn);

  // art. 25: greater of the fixed deduction and mandatory contributions; can't exceed Cat A income.
  const specific = min(max(rules.specificDeductionCatA, D(input.socialSecurityContributions)), consideredA);
  const taxable = max(consideredA.minus(specific).plus(taxableB), 0);

  // Exempt income is added to set the rate, then the tax on it is removed: tax on (taxable + exempt)
  // scaled by taxable / (taxable + exempt).
  const rateBase = taxable.plus(exempt);
  const { tax: rateTax, marginal } = progressiveTax(rateBase, rules);
  const tax = rateBase.isZero() ? ZERO : rateTax.mul(taxable).div(rateBase);
  const bracketTax = cents(tax);
  const solidarity = cents(solidaritySurcharge(taxable, rules));
  const grossTax = bracketTax.plus(solidarity);

  // art. 87: one credit per taxpayer (not per category). Neither it nor the other deductions can
  // make the tax negative (art. 78 caps for high incomes not modelled).
  const credit = cents(disabled ? min(grossTax, D(rules.ias).mul(d.taxpayerCreditIasMultiple)) : ZERO);
  const other = cents(min(max(D(input.otherTaxDeductions ?? 0), 0), grossTax.minus(credit)));
  const net = grossTax.minus(credit).minus(other);
  const mShare = Math.min(Math.max(input.municipalBenefit ?? 0, 0), rules.maxMunicipalBenefit);
  const municipal = cents(net.mul(mShare));

  return {
    grossCategoryA: num(grossAIn),
    irsJovemExempt: num(exempt),
    irsJovemExemptA: num(jovemA),
    irsJovemExemptB: num(jovemB),
    disabilityExclusion: num(exclA.plus(exclB)),
    disabilityExclusionA: num(exclA),
    disabilityExclusionB: num(exclB),
    taxableCategoryB: num(taxableB),
    consideredIncome: num(consideredA.plus(consideredB)),
    specificDeduction: num(specific),
    taxableIncome: num(taxable),
    bracketTax: num(bracketTax),
    grossTax: num(grossTax),
    disabilityCredit: num(credit),
    otherDeductions: num(other),
    solidaritySurcharge: num(solidarity),
    municipalBenefit: num(municipal),
    finalIrs: num(max(net.minus(municipal), 0)),
    marginalRate: rateBase.isZero() ? rules.brackets[0].rate : marginal,
  };
}
