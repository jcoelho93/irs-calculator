import { describe, expect, it } from "vitest";
import { calculateIrs, progressiveTax } from "./tax/irs";
import { D, cents } from "./money";
import { getTaxRules, taxRules, UnsupportedTaxYearError } from "./rules";
import { PT_2026 } from "./rules/pt2026";
import type { TaxYearRules } from "./rules/types";
import { DEFAULT_INPUT, calculateIncome } from "./income";
import type { IncomeInput } from "./income";
import { NotAModelo3Error, parseModelo3, patchFromModelo3 } from "./modelo3";
import { NotALiquidacaoError, parseLiquidacao, patchFromLiquidacao } from "./liquidacao";
import { FILE_KIND, FILE_VERSION, InvalidFileError, parseSavedFile, sanitizeInput, serializeInput } from "./file";

const inc = (p: Partial<IncomeInput>) => calculateIncome({ ...DEFAULT_INPUT, ...p });

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
});

describe("other deductions from tax", () => {
  it("are subtracted from the tax", () => {
    const a = calculateIrs({ grossCategoryA: 30000, disabilityPct: 0, socialSecurityContributions: 0 }, PT_2026);
    const b = calculateIrs({ grossCategoryA: 30000, disabilityPct: 0, socialSecurityContributions: 0, otherTaxDeductions: 1000 }, PT_2026);
    expect(b.otherDeductions).toBe(1000);
    expect(b.finalIrs).toBeCloseTo(a.finalIrs - 1000, 2);
  });
  it("cannot make tax negative and stack after the disability credit", () => {
    const r = calculateIrs({ grossCategoryA: 12000, disabilityPct: 60, socialSecurityContributions: 0, otherTaxDeductions: 99999 }, PT_2026);
    expect(r.finalIrs).toBe(0);
    expect(r.disabilityCredit + r.otherDeductions).toBe(r.bracketTax);
  });
});

describe("income calculator", () => {
  it("empty input gives zeros", () => {
    const r = inc({});
    expect(r.grossTotal).toBe(0);
    expect(r.irs.finalIrs).toBe(0);
    expect(r.netAnnual).toBe(0);
  });
  it("monthly x 14 employment: SS 11%, contributions used as specific deduction when higher", () => {
    const r = inc({ employment: 3000, employmentPeriod: "monthly14" });
    expect(r.grossEmployment).toBe(42000);
    expect(r.ssEmployment).toBe(4620);
    expect(r.irs.specificDeduction).toBe(4620);
    expect(r.irs.taxableIncome).toBe(37380);
    expect(r.netAnnual).toBeCloseTo(42000 - 4620 - r.irs.finalIrs, 2);
    expect(r.netPerMonth).toBeCloseTo(r.netAnnual / 14, 2);
  });
  it("period changes the annual gross", () => {
    expect(inc({ employment: 1000, employmentPeriod: "monthly12" }).grossEmployment).toBe(12000);
    expect(inc({ employment: 12000, employmentPeriod: "annual" }).grossEmployment).toBe(12000);
    expect(inc({ employment: 12000, employmentPeriod: "annual" }).monthsPerYear).toBe(12);
  });
  it("category B: default 75% coefficient and SS 21.4% on 70%", () => {
    const r = inc({ selfEmployed: 40000 });
    expect(r.irs.taxableCategoryB).toBe(30000);
    expect(r.ssSelfEmployed).toBe(5992);
    expect(r.irs.specificDeduction).toBe(0);
  });
  it("custom coefficient and SS overrides are honoured", () => {
    const r = inc({ selfEmployed: 40000, selfEmployedCoefficient: 0.35, selfEmployedSsRate: 0 });
    expect(r.irs.taxableCategoryB).toBe(14000);
    expect(r.ssSelfEmployed).toBe(0);
  });
  it("A and B are taxed together", () => {
    const both = inc({ employment: 30000, employmentPeriod: "annual", selfEmployed: 20000 });
    const a = inc({ employment: 30000, employmentPeriod: "annual" });
    const b = inc({ selfEmployed: 20000 });
    expect(both.irs.finalIrs).toBeGreaterThan(a.irs.finalIrs + b.irs.finalIrs);
  });
  it("deductions from tax lower the IRS", () => {
    const a = inc({ employment: 30000, employmentPeriod: "annual" });
    const b = inc({ employment: 30000, employmentPeriod: "annual", taxDeductions: 800 });
    expect(b.irs.finalIrs).toBeCloseTo(a.irs.finalIrs - 800, 2);
  });
  it("withholding balance: positive is due, negative is refund", () => {
    const r = inc({ employment: 30000, employmentPeriod: "annual", withholding: 10000 });
    expect(r.withholdingBalance).toBeCloseTo(r.irs.finalIrs - 10000, 2);
    expect(r.withholdingBalance).toBeLessThan(0);
  });
  it("bracket, specific deduction and solidarity overrides", () => {
    const r = inc({ employment: 100000, employmentPeriod: "annual", employeeSsRate: 0, specificDeduction: 0, brackets: [{ upTo: null, rate: 0.5 }], solidarity: false });
    expect(r.irs.finalIrs).toBe(50000);
    expect(r.irs.solidaritySurcharge).toBe(0);
  });
  it("non-ascending edited brackets do not produce negative slices", () => {
    expect(progressiveTax(10000, { ...PT_2026, brackets: [{ upTo: 5000, rate: 0.1 }, { upTo: 1000, rate: 0.2 }, { upTo: null, rate: 0.3 }] }).tax.toNumber()).toBe(2000);
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
    const r = calculateIncome({ ...DEFAULT_INPUT, taxYear: 2099, employment: 30000, employmentPeriod: "annual", employeeSsRate: 0 }, getTaxRules(2099, reg));
    expect(r.irs.finalIrs).toBe(15000);
  });
});

describe("export / import", () => {
  const sample: IncomeInput = { ...DEFAULT_INPUT, employment: 2500, selfEmployed: 10000, taxDeductions: 900, brackets: [{ upTo: 10000, rate: 0.1 }, { upTo: null, rate: 0.3 }], solidarity: false };
  it("round-trips every field", () => {
    expect(parseSavedFile(serializeInput(sample))).toEqual(sample);
  });
  it("rejects invalid JSON and files from other apps", () => {
    expect(() => parseSavedFile("not json")).toThrow(InvalidFileError);
    expect(() => parseSavedFile(JSON.stringify({ input: sample }))).toThrow(InvalidFileError);
    expect(() => parseSavedFile(JSON.stringify({ kind: FILE_KIND, version: FILE_VERSION + 1, input: sample }))).toThrow(InvalidFileError);
  });
  it("drops unknown or malformed fields and keeps defaults", () => {
    const r = sanitizeInput({ irsJovemYear: 12, employment: "abc", selfEmployed: 5000, employmentPeriod: "weekly", taxYear: 1999, brackets: [{ rate: "x" }], extra: 1 });
    expect(r).toEqual({ ...DEFAULT_INPUT, selfEmployed: 5000 });
  });
});

describe("IRS Jovem (art. 12-B)", () => {
  const irs = (a: number, year: number, b = 0) =>
    calculateIrs({ grossCategoryA: a, categoryB: { gross: b, taxable: b * 0.75 }, disabilityPct: 0, socialSecurityContributions: 0, irsJovemYear: year }, PT_2026);
  it("exempts the share for the benefit year", () => {
    expect(irs(40000, 8).irsJovemExemptA).toBe(10000); // 25%
    expect(irs(40000, 5).irsJovemExemptA).toBe(20000); // 50%
    expect(irs(40000, 0).irsJovemExempt).toBe(0);
    expect(irs(40000, 11).irsJovemExempt).toBe(0);
  });
  it("caps the exemption at 55 x IAS across A and B", () => {
    const r = irs(25000, 1, 10000);
    expect(r.irsJovemExemptA).toBe(25000);
    expect(r.irsJovemExemptB).toBe(4542.15); // 29,542.15 - 25,000
    expect(r.irsJovemExempt).toBe(29542.15);
  });
  it("applies the B coefficient to what is left after the exemption", () => {
    expect(irs(0, 8, 10000).taxableCategoryB).toBe(5625); // (10,000 - 2,500) x 0.75
  });
  it("applies after the art. 56-A disability exclusion and before the B coefficient", () => {
    const r = calculateIrs({ grossCategoryA: 40000, categoryB: { gross: 10000, taxable: 7500 }, disabilityPct: 60, socialSecurityContributions: 0, irsJovemYear: 8 }, PT_2026);
    expect(r.disabilityExclusionA).toBe(2500);
    expect(r.disabilityExclusionB).toBe(1500);
    expect(r.irsJovemExemptA).toBe(9375); // (40,000 - 2,500) x 25%
    expect(r.irsJovemExemptB).toBe(2125); // (10,000 - 1,500) x 25%
    expect(r.taxableCategoryB).toBe(4781.25); // (10,000 - 1,500 - 2,125) x 0.75
  });
  it("exempt income sets the rate but is not taxed", () => {
    const r = irs(40000, 8);
    const base = r.taxableIncome + r.irsJovemExempt;
    const expected = progressiveTax(base, PT_2026).tax.mul(r.taxableIncome).div(base);
    expect(r.bracketTax).toBe(cents(expected).toNumber());
    expect(r.finalIrs).toBeLessThan(irs(40000, 0).finalIrs);
    expect(r.finalIrs).toBeGreaterThan(irs(30000, 0).finalIrs); // higher rate than plain 30,000
  });
});

describe("benefício municipal", () => {
  it("hands back a share of the tax after deductions", () => {
    const base = { grossCategoryA: 40000, disabilityPct: 0, socialSecurityContributions: 0, otherTaxDeductions: 1000 };
    const r = calculateIrs({ ...base, municipalBenefit: 0.02 }, PT_2026);
    expect(r.municipalBenefit).toBe(cents(D(r.grossTax).minus(1000).mul(0.02)).toNumber());
    expect(r.finalIrs).toBeCloseTo(r.grossTax - 1000 - r.municipalBenefit, 2);
  });
  it("is capped at 5%", () => {
    const base = { grossCategoryA: 40000, disabilityPct: 0, socialSecurityContributions: 0 };
    expect(calculateIrs({ ...base, municipalBenefit: 0.5 }, PT_2026).municipalBenefit).toBe(calculateIrs({ ...base, municipalBenefit: 0.05 }, PT_2026).municipalBenefit);
  });
});

/** Text as pdf.js extracts it from a demonstração de liquidação. All figures and ids are made up. */
const LIQ = `Demonstração de Liquidação de IRS
Sujeito Passivo Número de Liquidação Período de Rendimentos
100000002 2026.5000000001 2025-01-01 a 2025-12-31
Descrição Valores
1 RENDIMENTO GLOBAL 40.000,00
18 COLETA TOTAL [(11-12)x(1,00)+13-14+15+16+17] 9.000,00
19 Deduções à coleta 3.100,50
20 Benefício Municipal (2,50% da coleta) 147,49
22 COLETA LÍQUIDA (18 - 19 - 20 (>=0) + 21) 5.752,01
24 Retenções na fonte 6.000,00
Regime IRS Jovem
Titular Ano de obtenção de rendimentos
Sujeito Passivo A 3º ano
Sujeito Passivo B / Cônjuge Falecido -
Deduções à Coleta Valor Despesa Dedução
Dedução despesas gerais e familiares 9.000,00 250,00
Dedução pessoas com deficiência 0,00 2.090,00
Total das Deduções : 3.100,50
Dedução Efetiva : 3.100,50`;

describe("nota de liquidação import", () => {
  it("reads the applied deductions, disability, municipal benefit and IRS Jovem year", () => {
    const l = parseLiquidacao(LIQ);
    expect(l).toEqual({ year: 2025, deductionsApplied: 3100.5, disabilityDeduction: 2090, municipalBenefit: 0.025, irsJovemYear: 3, withholding: 6000, netTax: 5752.01 });
  });
  it("leaves the disability credit out and moves IRS Jovem to the tax year", () => {
    expect(patchFromLiquidacao(parseLiquidacao(LIQ), 2026)).toEqual({ taxDeductions: 1010.5, hasDisability: true, municipalBenefit: 0.025, irsJovemYear: 4 });
  });
  it("stops IRS Jovem after the 10th year and handles its absence", () => {
    expect(patchFromLiquidacao(parseLiquidacao(LIQ.replace("3º ano", "10º ano")), 2026).irsJovemYear).toBe(0);
    expect(patchFromLiquidacao(parseLiquidacao(LIQ.replace("Sujeito Passivo A 3º ano", "Sujeito Passivo A -")), 2026).irsJovemYear).toBe(0);
  });
  it("rejects other documents", () => {
    expect(() => parseLiquidacao("Fatura n.º 1")).toThrow(NotALiquidacaoError);
    expect(() => parseLiquidacao("Demonstração de Liquidação de IRS\nnada")).toThrow(NotALiquidacaoError);
  });
});

/** Pages as pdf.js extracts them from a Modelo 3 comprovativo. All figures and ids are made up. */
const M3 = [
  `Comprovativo Mod.3 IRS: 100000002 / 2025 / 0000-X0000-00 Página 1 de 3
DECLARAÇÃO DE RENDIMENTOS - IRS
MODELO 3
1 Anexo A 1 8 Anexo G1`,
  `1 CATEGORIAS A / H 2 ANO DOS RENDIMENTOS
01 2025
MODELO 3 PENSÕES
Anexo A
500000000 401 A 30.000,00 4.000,00 3.300,00 0,00
500000000 414 A 2.000,00 0,00
SOMA DE CONTROLO 32.000,00 4.000,00 3.300,00 0,00 0,00`,
  `DECLARAÇÃO DE RENDIMENTOS - IRS 01 2025
MODELO 3
Anexo B
A RENDIMENTOS PROFISSIONAIS, COMERCIAIS E INDUSTRIAIS VALOR
Vendas de mercadorias e produtos 401 1.000,00
Rendimento das atividades profissionais especificamente previstas na Tabela do art.º 151.º do CIRS 403 3.000,00
Rendimentos de prestações de serviços não previstos nos campos anteriores 404
Propriedade intelectual (não abrangida pelo art.º 58.º do EBF), industrial ou de prestação de informações 405 500,00
SOMA 4.500,00
B RENDIMENTOS AGRÍCOLAS, SILVÍCOLAS E PECUÁRIOS VALOR
Prestações de serviços 452 9.999,00`,
];

describe("Modelo 3 import", () => {
  it("reads Anexo A totals and Anexo B amounts by code", () => {
    expect(parseModelo3(M3)).toEqual({
      year: 2025,
      employment: { income: 32000, withholding: 4000, contributions: 3300 },
      selfEmployed: [{ code: "401", amount: 1000 }, { code: "403", amount: 3000 }, { code: "405", amount: 500 }],
    });
  });
  it("derives the SS rate and a weighted coefficient, skipping unknown codes", () => {
    expect(patchFromModelo3(parseModelo3(M3))).toEqual({
      employment: 32000,
      employeeSsRate: 0.103125,
      selfEmployed: 4000,
      selfEmployedCoefficient: 0.6, // (1,000 x 0.15 + 3,000 x 0.75) / 4,000
      skippedCodes: ["405"],
    });
  });
  it("works with only one of the annexes", () => {
    expect(parseModelo3([M3[0], M3[2]]).employment).toBeNull();
    expect(parseModelo3([M3[0], M3[1]]).selfEmployed).toEqual([]);
  });
  it("rejects other documents", () => {
    expect(() => parseModelo3(["Fatura"])).toThrow(NotAModelo3Error);
    expect(() => parseModelo3([M3[0]])).toThrow(NotAModelo3Error);
  });
});
