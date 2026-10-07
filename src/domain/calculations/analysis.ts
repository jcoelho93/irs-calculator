import type { Scenario } from "../scenario/types";
import { calculateScenario } from "./scenario";
import { D, num } from "../money";
import type { TaxYearRules } from "../rules/types";
import { getTaxRules } from "../rules";

export type SensitivityVariable =
  | { kind: "parcel"; parcelId: string }
  | { kind: "lawyerPercentage" }
  | { kind: "otherIncome" };

export interface SensitivityRow {
  value: number;
  estimatedIRS: number;
  lawyerFee: number;
  netCash: number;
  taxable: number;
}

export function applyVariable(s: Scenario, v: SensitivityVariable, value: number): Scenario {
  const c = structuredClone(s);
  if (v.kind === "parcel") {
    const p = c.parcels.find((x) => x.id === v.parcelId);
    if (p) p.amount = value;
    // keep the declared total in line with the sum of enabled parcels
    c.settlementTotal = num(c.parcels.filter((x) => x.enabled).reduce((a, x) => D(a).plus(x.amount), D(0)));
  } else if (v.kind === "lawyerPercentage") c.lawyer.percentage = value;
  else c.tax.otherAnnualIncome = value;
  return c;
}

/** Evaluate the scenario at `steps` evenly spaced values in [from, to]. */
export function sensitivity(
  s: Scenario,
  v: SensitivityVariable,
  from: number,
  to: number,
  steps: number,
  rules: TaxYearRules = getTaxRules(s.tax.taxYear),
): SensitivityRow[] {
  const n = Math.max(2, Math.min(200, Math.floor(steps)));
  return Array.from({ length: n }, (_, i) => {
    const value = num(D(from).plus(D(to).minus(from).mul(i).div(n - 1)));
    const r = calculateScenario(applyVariable(s, v, value), rules, { skipConservative: true });
    return { value, estimatedIRS: r.estimatedIRS, lawyerFee: r.lawyerFee, netCash: r.netCash, taxable: r.taxableSettlement };
  });
}

export interface OptimizeVariable {
  parcelId: string;
  min: number;
  max: number;
}
export interface OptimizeCandidate {
  allocation: Record<string, number>;
  estimatedIRS: number;
  netCash: number;
  taxable: number;
}

export const OPTIMIZE_WARNING =
  "The calculator can compare legally plausible classifications and allocations. It must not recommend misrepresenting the actual nature of a payment to obtain a tax advantage.";

/**
 * Exhaustive grid search over user-defined plausible ranges. Total of the chosen
 * parcels is fixed to `total`; the last variable takes the remainder.
 */
export function optimize(
  s: Scenario,
  vars: OptimizeVariable[],
  total: number,
  step: number,
  rules: TaxYearRules = getTaxRules(s.tax.taxYear),
  maxEvaluations = 20000,
): { maxNet: OptimizeCandidate | null; minIRS: OptimizeCandidate | null; evaluated: number; truncated: boolean } {
  if (vars.length < 1 || step <= 0) return { maxNet: null, minIRS: null, evaluated: 0, truncated: false };
  const out: OptimizeCandidate[] = [];
  let truncated = false;
  const rec = (i: number, remaining: number, acc: Record<string, number>) => {
    if (out.length >= maxEvaluations) {
      truncated = true;
      return;
    }
    const v = vars[i];
    if (i === vars.length - 1) {
      if (remaining < v.min - 1e-9 || remaining > v.max + 1e-9) return;
      evaluate({ ...acc, [v.parcelId]: num(remaining) });
      return;
    }
    for (let x = v.min; x <= Math.min(v.max, remaining) + 1e-9; x += step) rec(i + 1, remaining - x, { ...acc, [v.parcelId]: num(x) });
  };
  const evaluate = (alloc: Record<string, number>) => {
    const c = structuredClone(s);
    for (const p of c.parcels) if (p.id in alloc) p.amount = alloc[p.id];
    const r = calculateScenario(c, rules, { skipConservative: true });
    out.push({ allocation: alloc, estimatedIRS: r.estimatedIRS, netCash: r.netCash, taxable: r.taxableSettlement });
  };
  rec(0, total, {});
  const maxNet = out.reduce<OptimizeCandidate | null>((b, c) => (!b || c.netCash > b.netCash ? c : b), null);
  const minIRS = out.reduce<OptimizeCandidate | null>((b, c) => (!b || c.estimatedIRS < b.estimatedIRS ? c : b), null);
  return { maxNet, minIRS, evaluated: out.length, truncated };
}

export type Metric = "estimatedIRS" | "netCash" | "lawyerFee" | "taxableSettlement";
export const METRIC_GOAL: Record<Metric, { label: string; better: "min" | "max" }> = {
  estimatedIRS: { label: "lowest estimated tax", better: "min" },
  netCash: { label: "highest net cash", better: "max" },
  lawyerFee: { label: "lowest lawyer cost", better: "min" },
  taxableSettlement: { label: "lowest taxable income", better: "min" },
};

/** Index of best/worst scenario per metric (null if fewer than 2 or all equal). */
export function rankMetric(values: number[], better: "min" | "max"): { best: number[]; worst: number[] } {
  if (values.length < 2) return { best: [], worst: [] };
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  if (hi === lo) return { best: [], worst: [] };
  const bestV = better === "min" ? lo : hi;
  const worstV = better === "min" ? hi : lo;
  const idx = (t: number) => values.flatMap((v, i) => (v === t ? [i] : []));
  return { best: idx(bestV), worst: idx(worstV) };
}
