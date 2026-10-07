import type { Scenario } from "../scenario/types";
import { supportedTaxYears } from "../rules";
import { computeSeniority } from "./duration";
import type { ValidationIssue } from "./types";

const isoOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function validateScenario(s: Scenario): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const err = (field: string, message: string) => out.push({ field, message, severity: "error" });
  const warn = (field: string, message: string) => out.push({ field, message, severity: "warning" });

  const e = s.employment;
  if (!isoOk(e.startDate)) warn("employment.startDate", "Start date is missing; the termination threshold cannot be computed.");
  if (!isoOk(e.terminationDate)) warn("employment.terminationDate", "Termination date is missing; the termination threshold cannot be computed.");
  if (isoOk(e.startDate) && isoOk(e.terminationDate) && !computeSeniority(e.startDate, e.terminationDate))
    err("employment.terminationDate", "Termination date is before the employment start date.");
  if (e.monthlyGrossSalary < 0) err("employment.monthlyGrossSalary", "Cannot be negative.");
  if (e.annualGrossSalary < 0) err("employment.annualGrossSalary", "Cannot be negative.");
  if (e.avgMonthlyRemuneration < 0) err("employment.avgMonthlyRemuneration", "Cannot be negative.");
  if (!(e.avgMonthlyRemuneration > 0)) warn("employment.avgMonthlyRemuneration", "Average monthly remuneration is required for the termination-compensation threshold.");

  if (!supportedTaxYears().includes(s.tax.taxYear)) err("tax.taxYear", `No rules available for ${s.tax.taxYear}. Supported: ${supportedTaxYears().join(", ")}.`);
  if (s.tax.disabilityPct < 0 || s.tax.disabilityPct > 100) err("tax.disabilityPct", "Must be between 0 and 100.");
  if (s.tax.otherAnnualIncome < 0) err("tax.otherAnnualIncome", "Cannot be negative.");
  if (s.tax.socialSecurityContributions < 0) err("tax.socialSecurityContributions", "Cannot be negative.");
  if (s.tax.withholdingOnSettlement < 0) err("tax.withholdingOnSettlement", "Cannot be negative.");

  for (const p of s.parcels) {
    if (p.amount < 0) err(`parcels.${p.id}.amount`, "Amount cannot be negative.");
    if (!p.name.trim()) warn(`parcels.${p.id}.name`, "Parcel has no name.");
  }
  if (s.settlementTotal < 0) err("settlementTotal", "Cannot be negative.");

  const l = s.lawyer;
  if (l.percentage < 0 || l.percentage > 100) err("lawyer.percentage", "Percentage must be between 0 and 100.");
  if (l.vatRate < 0 || l.vatRate > 100) err("lawyer.vatRate", "VAT rate must be between 0 and 100.");
  if (l.fixedAmount < 0) err("lawyer.fixedAmount", "Cannot be negative.");
  if (s.otherCosts < 0) err("otherCosts", "Cannot be negative.");

  const allocated = s.parcels.filter((p) => p.enabled).reduce((a, p) => a + p.amount, 0);
  if (Math.abs(allocated - s.settlementTotal) > 0.005)
    warn("parcels", `Parcels total ${allocated.toFixed(2)} but the settlement is ${s.settlementTotal.toFixed(2)}.`);
  return out;
}
