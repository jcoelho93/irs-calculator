import Decimal from "decimal.js";

/**
 * Money arithmetic. All monetary maths runs on Decimal (never binary floats).
 *
 * ROUNDING POLICY (documented per requirements §27):
 *  - Inputs are rounded to cents (half-up) when they enter the engine.
 *  - Each *reported* monetary figure (parcel amounts, lawyer fee, VAT, IRS) is
 *    rounded half-up to cents once, at the stage that produces it.
 *  - Ratios (effective rates) are returned unrounded as fractions; the UI rounds.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type D = Decimal;
export const D = (v: Decimal.Value | null | undefined): Decimal =>
  new Decimal(v === null || v === undefined || v === "" || Number.isNaN(v) ? 0 : v);

export const ZERO = new Decimal(0);

/** Round to cents, half-up. */
export const cents = (v: Decimal.Value): Decimal => D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Convert to a JS number at the boundary (already rounded to cents). */
export const num = (v: Decimal.Value): number => cents(v).toNumber();

export const sum = (values: Decimal.Value[]): Decimal => values.reduce<Decimal>((a, b) => a.plus(b), ZERO);

export const min = (a: Decimal.Value, b: Decimal.Value): Decimal => Decimal.min(a, b);
export const max = (a: Decimal.Value, b: Decimal.Value): Decimal => Decimal.max(a, b);

/** Safe ratio; returns 0 when the denominator is 0. */
export const ratio = (a: Decimal.Value, b: Decimal.Value): number => (D(b).isZero() ? 0 : D(a).div(b).toNumber());
