import { D, cents, num } from "../money";
import type { LawyerFeeConfig } from "../scenario/types";

export interface LawyerFeeResult {
  baseFee: number;
  vat: number;
  total: number;
  percentOfSettlement: number;
  /** Always true: lawyer fees are modelled as cash cost only. */
  deductibilityAssumed: false;
}

/**
 * Lawyer fee on a recovery base (gross settlement excluding reimbursed legal costs).
 * - percentage: pct * base
 * - fixed: fixedAmount
 * - hybrid: fixedAmount + pct * base
 * If vatIncluded the quoted figure already contains VAT and is split out;
 * otherwise VAT is added on top.
 */
export function calculateLawyerFee(cfg: LawyerFeeConfig, base: number): LawyerFeeResult {
  const pct = D(cfg.percentage).div(100);
  const vatRate = D(cfg.vatRate).div(100);
  const quoted = {
    percentage: D(base).mul(pct),
    fixed: D(cfg.fixedAmount),
    hybrid: D(cfg.fixedAmount).plus(D(base).mul(pct)),
  }[cfg.mode];

  let baseFee: ReturnType<typeof D>;
  let vat: ReturnType<typeof D>;
  let total: ReturnType<typeof D>;
  if (cfg.vatIncluded) {
    total = cents(quoted);
    baseFee = cents(quoted.div(vatRate.plus(1)));
    vat = total.minus(baseFee);
  } else {
    baseFee = cents(quoted);
    vat = cents(baseFee.mul(vatRate));
    total = baseFee.plus(vat);
  }
  return {
    baseFee: num(baseFee),
    vat: num(vat),
    total: num(total),
    percentOfSettlement: D(base).isZero() ? 0 : total.div(base).toNumber(),
    deductibilityAssumed: false,
  };
}
