export interface Seniority {
  /** Whole completed years. */
  fullYears: number;
  /** "Anos ou fração": a started year counts as a full year (art. 2(4) CIRS). */
  yearsOrFraction: number;
  totalDays: number;
}

const parse = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Seniority between start and termination dates.
 * Both dates are counted inclusively: an employee who starts 2020-01-01 and leaves
 * 2024-12-31 has exactly 5 full years. Anniversary based, no 365-day approximation.
 * Returns null when dates are missing or inverted.
 */
export function computeSeniority(startIso: string, endIso: string): Seniority | null {
  const s = parse(startIso);
  const e = parse(endIso);
  if (!s || !e || e < s) return null;
  // exclusive end = day after termination
  const endExcl = new Date(e.getTime() + 86_400_000);
  let years = endExcl.getUTCFullYear() - s.getUTCFullYear();
  const anniv = (y: number) => new Date(Date.UTC(s.getUTCFullYear() + y, s.getUTCMonth(), s.getUTCDate()));
  if (anniv(years) > endExcl) years -= 1;
  const hasFraction = anniv(years).getTime() !== endExcl.getTime();
  const totalDays = Math.round((endExcl.getTime() - s.getTime()) / 86_400_000);
  return { fullYears: years, yearsOrFraction: years + (hasFraction ? 1 : 0), totalDays };
}
