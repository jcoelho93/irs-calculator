import { describe, expect, it } from "vitest";
import { calculateScenario } from "./calculations/scenario";
import { calculateLawyerFee } from "./calculations/lawyerFees";
import { computeSeniority } from "./calculations/duration";
import { validateScenario } from "./calculations/validation";
import { calculateIrs, progressiveTax } from "./tax/irs";
import { applyThreshold, terminationThreshold } from "./tax/termination";
import { D, cents } from "./money";
import { getTaxRules, taxRules, UnsupportedTaxYearError } from "./rules";
import { PT_2026 } from "./rules/pt2026";
import type { TaxYearRules } from "./rules/types";
import { duplicateScenario, newParcel, newScenario } from "./scenario/defaults";
import { EMPTY_INPUT, calculateSimple } from "./simple";
import type { SimpleInput } from "./simple";
import type { Scenario } from "./scenario/types";

/** 2015-03-01 -> 2024-06-30: 9 full years + fraction = 10. avg 2,000 -> threshold 20,000. */
function base(): Scenario {
  const s = newScenario();
  s.employment.startDate = "2015-03-01";
  s.employment.terminationDate = "2024-06-30";
  s.employment.avgMonthlyRemuneration = 2000;
  s.tax.taxYear = 2026;
  s.parcels[0].amount = 50000;
  s.settlementTotal = 50000;
  s.lawyer.percentage = 25;
  return s;
}

describe("money / rounding", () => {
  it("avoids binary float error", () => {
    expect(D(0.1).plus(0.2).toNumber()).toBe(0.3);
  });
  it("rounds half-up at cent level", () => {
    expect(cents("1.005").toNumber()).toBe(1.01);
    expect(cents("1.004").toNumber()).toBe(1);
    expect(cents("2.675").toNumber()).toBe(2.68);
  });
});

describe("seniority", () => {
  it("short employment counts as one year-or-fraction", () => {
    expect(computeSeniority("2024-01-10", "2024-03-10")).toMatchObject({ fullYears: 0, yearsOrFraction: 1 });
  });
  it("multi-year with fraction", () => {
    expect(computeSeniority("2015-03-01", "2024-06-30")).toMatchObject({ fullYears: 9, yearsOrFraction: 10 });
  });
  it("exact anniversary boundary is not an extra year (inclusive end date)", () => {
    expect(computeSeniority("2020-01-01", "2024-12-31")).toMatchObject({ fullYears: 5, yearsOrFraction: 5 });
  });
  it("one day past the boundary starts a new year", () => {
    expect(computeSeniority("2020-01-01", "2025-01-01")).toMatchObject({ fullYears: 5, yearsOrFraction: 6 });
  });
  it("single day of employment", () => {
    expect(computeSeniority("2024-05-05", "2024-05-05")).toMatchObject({ fullYears: 0, yearsOrFraction: 1, totalDays: 1 });
  });
  it("handles leap-day starts", () => {
    expect(computeSeniority("2020-02-29", "2021-02-27")).toMatchObject({ fullYears: 0, yearsOrFraction: 1 });
  });
  it("returns null for inverted or missing dates", () => {
    expect(computeSeniority("2024-05-05", "2023-01-01")).toBeNull();
    expect(computeSeniority("", "2023-01-01")).toBeNull();
  });
});

describe("termination threshold", () => {
  it("threshold = avg monthly x years or fraction", () => {
    const t = terminationThreshold(2000, computeSeniority("2015-03-01", "2024-06-30"), false)!;
    expect(t.threshold).toBe(20000);
  });
  it("is lost when re-hired within 24 months", () => {
    expect(terminationThreshold(2000, computeSeniority("2015-03-01", "2024-06-30"), true)!.threshold).toBe(0);
  });
  it("returns null without remuneration or dates", () => {
    expect(terminationThreshold(0, computeSeniority("2015-03-01", "2024-06-30"), false)).toBeNull();
    expect(terminationThreshold(2000, null, false)).toBeNull();
  });
  it("below / at / above threshold", () => {
    expect(applyThreshold(15000, 20000, PT_2026)).toEqual({ excluded: 15000, taxable: 0, remainingAfter: 5000 });
    expect(applyThreshold(20000, 20000, PT_2026)).toEqual({ excluded: 20000, taxable: 0, remainingAfter: 0 });
    expect(applyThreshold(50000, 20000, PT_2026)).toEqual({ excluded: 20000, taxable: 30000, remainingAfter: 0 });
  });
});

describe("termination compensation in a scenario", () => {
  it("100% compensation: excess over threshold is taxable", () => {
    const r = calculateScenario(base());
    expect(r.threshold?.threshold).toBe(20000);
    expect(r.grossSettlement).toBe(50000);
    expect(r.excludedSettlement).toBe(20000);
    expect(r.taxableSettlement).toBe(30000);
    expect(r.parcels[0].status).toBe("partially_taxable");
  });
  it("multiple indemnity parcels share one threshold in order", () => {
    const s = base();
    s.parcels = [
      newParcel({ name: "a", amount: 12000, category: "termination_indemnity" }),
      newParcel({ name: "b", amount: 12000, category: "termination_indemnity" }),
    ];
    s.settlementTotal = 24000;
    const r = calculateScenario(s);
    expect(r.parcels[0]).toMatchObject({ excludedAmount: 12000, taxableAmount: 0 });
    expect(r.parcels[1]).toMatchObject({ excludedAmount: 8000, taxableAmount: 4000 });
  });
  it("without dates/remuneration it does not invent an exclusion", () => {
    const s = newScenario();
    s.parcels[0].amount = 50000;
    const r = calculateScenario(s);
    expect(r.threshold).toBeNull();
    expect(r.excludedSettlement).toBe(0);
    expect(r.parcels[0].status).toBe("requires_validation");
    expect(r.risk.level).toBe("red");
  });
  it("avgFromAnnual derives the monthly figure", () => {
    const s = base();
    s.employment.avgFromAnnual = true;
    s.employment.annualGrossSalary = 28000;
    expect(calculateScenario(s).threshold?.avgMonthlyRemuneration).toBe(2333.33);
  });
});

describe("parcel allocation", () => {
  it("accrued remuneration is fully taxable and gets no exclusion", () => {
    const s = base();
    s.parcels = [newParcel({ name: "arrears", amount: 10000, category: "salary_arrears" })];
    s.settlementTotal = 10000;
    const r = calculateScenario(s);
    expect(r.taxableSettlement).toBe(10000);
    expect(r.excludedSettlement).toBe(0);
  });
  it("mixed allocation", () => {
    const s = base();
    s.parcels = [
      newParcel({ amount: 35000, category: "termination_indemnity" }),
      newParcel({ amount: 10000, category: "salary_arrears" }),
      newParcel({ amount: 5000, category: "moral_damages" }),
    ];
    s.settlementTotal = 50000;
    const r = calculateScenario(s);
    expect(r.grossSettlement).toBe(50000);
    expect(r.taxableSettlement).toBe(15000 + 10000); // 35000-20000 + 10000
    expect(r.excludedSettlement).toBe(25000);
    expect(r.risk.level).toBe("yellow");
    expect(r.conservative!.estimatedIRS).toBeGreaterThan(r.estimatedIRS);
  });
  it("zero-value and disabled parcels contribute nothing", () => {
    const s = base();
    s.parcels.push(newParcel({ amount: 0, category: "moral_damages" }), newParcel({ amount: 5000, category: "salary_arrears", enabled: false }));
    const r = calculateScenario(s);
    expect(r.grossSettlement).toBe(50000);
    expect(r.parcels).toHaveLength(2);
  });
  it("reports unallocated settlement", () => {
    const s = base();
    s.settlementTotal = 59000;
    const r = calculateScenario(s);
    expect(r.unallocated).toBe(9000);
    expect(validateScenario(s).some((i) => i.field === "parcels")).toBe(true);
  });
  it("manual override is honoured and flagged", () => {
    const s = base();
    s.parcels[0].override = "fully_taxable";
    const r = calculateScenario(s);
    expect(r.taxableSettlement).toBe(50000);
    expect(r.parcels[0].overridden).toBe(true);
  });
});

describe("lawyer fees", () => {
  const cfg = { mode: "percentage" as const, percentage: 25, fixedAmount: 0, vatRate: 23, vatIncluded: false };
  it("percentage, VAT excluded", () => {
    expect(calculateLawyerFee(cfg, 50000)).toMatchObject({ baseFee: 12500, vat: 2875, total: 15375 });
  });
  it("percentage, VAT included in quote", () => {
    expect(calculateLawyerFee({ ...cfg, vatIncluded: true }, 50000)).toMatchObject({ total: 12500, baseFee: 10162.6, vat: 2337.4 });
  });
  it("fixed", () => {
    expect(calculateLawyerFee({ ...cfg, mode: "fixed", fixedAmount: 15000 }, 50000)).toMatchObject({ baseFee: 15000, vat: 3450, total: 18450 });
  });
  it("hybrid", () => {
    expect(calculateLawyerFee({ ...cfg, mode: "hybrid", fixedAmount: 2000, percentage: 20 }, 50000)).toMatchObject({ baseFee: 12000, total: 14760 });
  });
  it("0 base gives 0 share", () => {
    expect(calculateLawyerFee(cfg, 0).percentOfSettlement).toBe(0);
  });
  it("employer reimbursement is excluded from the fee base and shown as cash in", () => {
    const s = base();
    s.lawyer = { ...cfg, vatIncluded: true };
    s.parcels = [
      newParcel({ amount: 49000, category: "termination_indemnity" }),
      newParcel({ amount: 1000, category: "lawyer_fee_reimbursed" }),
    ];
    s.settlementTotal = 50000;
    const r = calculateScenario(s);
    expect(r.lawyerFee).toBe(12250); // 25% of 49000, not 50000
    expect(r.employerReimbursedLegalCosts).toBe(1000);
    expect(r.grossSettlement).toBe(50000);
  });
  it("is never treated as deductible", () => {
    const s = base();
    const a = calculateScenario(s);
    s.lawyer.percentage = 0;
    const b = calculateScenario(s);
    expect(a.estimatedIRS).toBe(b.estimatedIRS);
    expect(a.lawyer.deductibilityAssumed).toBe(false);
  });
});

describe("IRS calculation", () => {
  it("progressive slicing", () => {
    // 10,000: 8,342*12.5% + 1,658*15.7% = 1042.75 + 260.306 = 1303.056
    expect(progressiveTax(10000, PT_2026).tax.toNumber()).toBeCloseTo(1303.056, 6);
  });
  it("zero income gives zero tax", () => {
    expect(calculateIrs({ grossCategoryA: 0, disabilityPct: 0, socialSecurityContributions: 0 }, PT_2026).finalIrs).toBe(0);
  });
  it("applies the specific deduction (or contributions if higher)", () => {
    expect(calculateIrs({ grossCategoryA: 20000, disabilityPct: 0, socialSecurityContributions: 0 }, PT_2026).specificDeduction).toBe(4587.09);
    expect(calculateIrs({ grossCategoryA: 60000, disabilityPct: 0, socialSecurityContributions: 6600 }, PT_2026).specificDeduction).toBe(6600);
  });
  it("disability >= 60%: art. 56-A exclusion capped and art. 87 credit applied", () => {
    const d = calculateIrs({ grossCategoryA: 50000, disabilityPct: 60, socialSecurityContributions: 0 }, PT_2026);
    expect(d.disabilityExclusion).toBe(2500); // 15% = 7,500 capped at 2,500
    expect(d.disabilityCredit).toBe(2148.52); // 4 x 537.13
    const n = calculateIrs({ grossCategoryA: 50000, disabilityPct: 59, socialSecurityContributions: 0 }, PT_2026);
    expect(n.disabilityExclusion).toBe(0);
    expect(n.disabilityCredit).toBe(0);
    expect(d.finalIrs).toBeLessThan(n.finalIrs);
  });
  it("art. 56-A exclusion is 15% below the cap", () => {
    expect(calculateIrs({ grossCategoryA: 10000, disabilityPct: 60, socialSecurityContributions: 0 }, PT_2026).disabilityExclusion).toBe(1500);
  });
  it("credit cannot make tax negative", () => {
    const d = calculateIrs({ grossCategoryA: 6000, disabilityPct: 60, socialSecurityContributions: 0 }, PT_2026);
    expect(d.finalIrs).toBeGreaterThanOrEqual(0);
  });
  it("solidarity surcharge above 80k taxable", () => {
    const r = calculateIrs({ grossCategoryA: 300000, disabilityPct: 0, socialSecurityContributions: 0 }, PT_2026);
    expect(r.solidaritySurcharge).toBeGreaterThan(0);
  });
  it("estimated IRS is incremental over the baseline", () => {
    const s = base();
    s.tax.otherAnnualIncome = 30000;
    const r = calculateScenario(s);
    expect(r.estimatedIRS).toBeCloseTo(r.totalIRSWithSettlement - r.baselineIRS, 2);
    expect(r.netCash).toBeCloseTo(r.grossSettlement - r.estimatedIRS - r.lawyerFee - r.otherCosts, 2);
  });
  it("withholding is distinct from final liability", () => {
    const s = base();
    s.tax.withholdingOnSettlement = 5000;
    const r = calculateScenario(s);
    expect(r.estimatedIRS).not.toBe(5000);
    expect(r.withholdingBalance).toBeCloseTo(r.estimatedIRS - 5000, 2);
    expect(r.netCash).toBe(calculateScenario({ ...s, tax: { ...s.tax, withholdingOnSettlement: 0 } }).netCash);
  });
  it("disability lowers estimated IRS in a scenario", () => {
    const s = base();
    const a = calculateScenario(s).estimatedIRS;
    s.tax.disabilityPct = 60;
    expect(calculateScenario(s).estimatedIRS).toBeLessThan(a);
  });
});

describe("category B and disability (art. 56-A per category)", () => {
  const A = (g: number, pct: number, b?: { gross: number; taxable: number }) =>
    calculateIrs({ grossCategoryA: g, categoryB: b, disabilityPct: pct, socialSecurityContributions: 0 }, PT_2026);
  it("the 2,500 cap applies separately to each category", () => {
    const r = A(50000, 60, { gross: 50000, taxable: 50000 });
    expect(r.disabilityExclusionA).toBe(2500);
    expect(r.disabilityExclusionB).toBe(2500);
    expect(r.disabilityExclusion).toBe(5000);
  });
  it("a category below the cap excludes 15% of its own gross", () => {
    const r = A(0, 60, { gross: 10000, taxable: 10000 });
    expect(r.disabilityExclusionB).toBe(1500);
    expect(r.disabilityExclusionA).toBe(0);
  });
  it("category B has no specific deduction", () => {
    const r = A(0, 0, { gross: 20000, taxable: 20000 });
    expect(r.specificDeduction).toBe(0);
    expect(r.taxableIncome).toBe(20000);
  });
  it("B taxable is scaled by taxable/gross after the exclusion", () => {
    const r = A(0, 60, { gross: 40000, taxable: 30000 });
    expect(r.taxableCategoryB).toBe(28125); // (40000 - 2500) x 0.75
  });
  it("taxable B cannot exceed gross B", () => {
    expect(A(0, 0, { gross: 10000, taxable: 99999 }).taxableIncome).toBe(10000);
  });
  it("the art. 87 credit is applied once, not per category", () => {
    const r = A(50000, 60, { gross: 50000, taxable: 50000 });
    expect(r.disabilityCredit).toBe(2148.52);
  });
  it("without B input results are unchanged", () => {
    expect(A(30000, 60).taxableIncome).toBe(A(30000, 60, { gross: 0, taxable: 0 }).taxableIncome);
  });
  it("settlement gains nothing from the Category A cap when salary already used it", () => {
    const s = base();
    s.tax.disabilityPct = 60;
    s.tax.otherAnnualIncome = 50000;
    const r = calculateScenario(s);
    expect(r.irsDetail.withSettlement.disabilityExclusionA).toBe(2500);
    expect(r.irsDetail.baseline.disabilityExclusionA).toBe(2500);
  });
  it("Category B income raises the tax on the settlement (higher brackets)", () => {
    const s = base();
    const a = calculateScenario(s).estimatedIRS;
    s.tax.categoryBGross = 40000;
    s.tax.categoryBTaxable = 30000;
    expect(calculateScenario(s).estimatedIRS).toBeGreaterThan(a);
  });
  it("simple input maps Category B and clamps taxable to gross", () => {
    const r = calculateSimple({ ...EMPTY_INPUT, total: 10000, catBGross: 5000, catBTaxable: 9000 });
    expect(r.irsDetail.baseline.taxableCategoryB).toBe(5000);
  });
});

describe("tax years", () => {
  it("loads rules by year and rejects unknown ones", () => {
    expect(getTaxRules(2026).taxYear).toBe(2026);
    expect(() => getTaxRules(1999)).toThrow(UnsupportedTaxYearError);
  });
  it("different year rules change the result", () => {
    const alt: TaxYearRules = { ...PT_2026, taxYear: 2099, specificDeductionCatA: 0, brackets: [{ upTo: null, rate: 0.5 }] };
    const reg = { ...taxRules, "2099": alt };
    const s = base();
    const a = calculateScenario(s, getTaxRules(2026, reg));
    const b = calculateScenario({ ...s, tax: { ...s.tax, taxYear: 2099 } }, getTaxRules(2099, reg));
    expect(b.taxYear).toBe(2099);
    expect(b.estimatedIRS).toBe(15000); // 30,000 x 50%
    expect(a.estimatedIRS).not.toBe(b.estimatedIRS);
  });
  it("validation flags an unsupported year", () => {
    const s = base();
    s.tax.taxYear = 1999;
    expect(validateScenario(s).some((i) => i.field === "tax.taxYear" && i.severity === "error")).toBe(true);
  });
});

describe("validation", () => {
  it("flags negative amounts, inverted dates and bad percentages", () => {
    const s = base();
    s.parcels[0].amount = -1;
    s.employment.terminationDate = "2010-01-01";
    s.lawyer.percentage = 120;
    const f = validateScenario(s).map((i) => i.field);
    expect(f).toContain(`parcels.${s.parcels[0].id}.amount`);
    expect(f).toContain("employment.terminationDate");
    expect(f).toContain("lawyer.percentage");
  });
  it("warns about missing dates", () => {
    expect(validateScenario(newScenario()).some((i) => i.field === "employment.startDate")).toBe(true);
  });
});

describe("scenarios are independent", () => {
  it("duplicating then editing does not alter the original", () => {
    const a = base();
    const b = duplicateScenario(a);
    b.parcels[0].amount = 1;
    b.lawyer.percentage = 1;
    expect(a.parcels[0].amount).toBe(50000);
    expect(a.lawyer.percentage).toBe(25);
    expect(b.id).not.toBe(a.id);
    expect(b.parcels[0].id).not.toBe(a.parcels[0].id);
  });
  it("calculation does not mutate the input", () => {
    const a = base();
    const snap = JSON.stringify(a);
    calculateScenario(a);
    expect(JSON.stringify(a)).toBe(snap);
  });
});

describe("simple input mapping", () => {
  const input: SimpleInput = { ...EMPTY_INPUT, total: 50000, accrued: 10000, startDate: "2015-03-01", endDate: "2024-06-30", avgMonthlyPay: 2000 };
  it("splits total into termination compensation and accrued pay", () => {
    const r = calculateSimple(input);
    expect(r.grossSettlement).toBe(50000);
    expect(r.excludedSettlement).toBe(20000); // threshold 2000 x 10
    expect(r.taxableSettlement).toBe(30000); // 20000 excess + 10000 accrued
  });
  it("while compensation exceeds the threshold, moving money to accrued pay changes nothing", () => {
    expect(calculateSimple({ ...input, accrued: 20000 }).estimatedIRS).toBe(calculateSimple(input).estimatedIRS);
  });
  it("accrued pay only costs tax once it pushes compensation below the threshold", () => {
    expect(calculateSimple({ ...input, accrued: 40000 }).estimatedIRS).toBeGreaterThan(calculateSimple(input).estimatedIRS);
  });
  it("clamps accrued pay to the total", () => {
    expect(calculateSimple({ ...input, accrued: 999999 }).grossSettlement).toBe(50000);
  });
  it("blank input yields zeros and no exclusion", () => {
    const r = calculateSimple(EMPTY_INPUT);
    expect(r.grossSettlement).toBe(0);
    expect(r.estimatedIRS).toBe(0);
    expect(r.netCash).toBe(0);
  });
  it("net after lawyer = total - IRS - lawyer fee", () => {
    const r = calculateSimple({ ...input, lawyerPct: 10 });
    expect(r.lawyerFee).toBe(5000); // 10% of 50,000, VAT included
    expect(r.netCash).toBeCloseTo(r.grossSettlement - r.estimatedIRS - 5000, 2);
  });
  it("VAT is added on top when the quote excludes it", () => {
    expect(calculateSimple({ ...input, lawyerPct: 10, lawyerVatExcluded: true }).lawyerFee).toBe(6150);
  });
  it("is deterministic and does not mutate input", () => {
    const snap = JSON.stringify(input);
    const a = calculateSimple(input);
    const b = calculateSimple(input);
    expect([a.estimatedIRS, a.netCash, a.taxableSettlement]).toEqual([b.estimatedIRS, b.netCash, b.taxableSettlement]);
    expect(JSON.stringify(input)).toBe(snap);
  });
});
