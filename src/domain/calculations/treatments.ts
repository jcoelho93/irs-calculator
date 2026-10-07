import { D, cents, num } from "../money";
import type { Confidence, Parcel, ParcelTreatment, TreatmentStatus } from "../parcels/types";
import type { TaxYearRules } from "../rules/types";
import { applyThreshold } from "../tax/termination";
import type { TerminationThreshold } from "../tax/termination";

export interface TreatmentContext {
  rules: TaxYearRules;
  threshold: TerminationThreshold | null;
  /** Remaining qualifying threshold, consumed in parcel order across all indemnity parcels. */
  remainingThreshold: number;
  /** If true treat every uncertain parcel as fully taxable (conservative pass). */
  conservative: boolean;
}

const full = (
  p: Parcel,
  status: TreatmentStatus,
  taxable: number,
  excluded: number,
  explanation: string,
  legalBasis: string,
  sourceIds: string[],
  confidence: Confidence,
  overridden = false,
): ParcelTreatment => ({
  parcelId: p.id,
  classification: p.category,
  status,
  grossAmount: p.amount,
  taxableAmount: taxable,
  excludedAmount: excluded,
  explanation,
  legalBasis,
  sourceIds,
  confidence,
  overridden,
});

const taxableAll = (p: Parcel, expl: string, basis: string, src: string[], conf: Confidence, status: TreatmentStatus = "fully_taxable") =>
  full(p, status, p.amount, 0, expl, basis, src, conf);

const excludedAll = (p: Parcel, status: TreatmentStatus, expl: string, basis: string, src: string[], conf: Confidence) =>
  full(p, status, 0, p.amount, expl, basis, src, conf);

/** Is this parcel's outcome one that depends on facts/interpretation? */
export const isUncertain = (t: ParcelTreatment): boolean =>
  t.status === "potentially_excluded" || t.status === "unknown" || t.status === "requires_validation";

/**
 * Determine the tax treatment of one parcel. Category alone does not fix the result:
 * termination indemnities depend on threshold, seniority and remuneration; damages depend
 * on facts; manual overrides win and are flagged.
 */
export function treatParcel(p: Parcel, ctx: TreatmentContext): { treatment: ParcelTreatment; remainingThreshold: number } {
  let remaining = ctx.remainingThreshold;
  const amount = p.amount;
  let t: ParcelTreatment;

  if (p.override) {
    t =
      p.override === "fully_taxable"
        ? full(p, "fully_taxable", amount, 0, "Manual override: treated as fully taxable Category A income.", "User assumption", [], "low", true)
        : full(p, "potentially_excluded", 0, amount, "Manual override: treated as fully excluded from IRS. This is a user assumption that must be justified by the real nature of the payment.", "User assumption", [], "low", true);
  } else {
    switch (p.category) {
      case "termination_indemnity": {
        if (!ctx.threshold) {
          t = taxableAll(
            p,
            "Cannot compute the exclusion threshold (needs start/termination dates and average monthly remuneration). Not modelled: shown as fully taxable until those inputs are provided.",
            "CIRS art. 2(4)(b)",
            ["termination-indemnity-2026"],
            "low",
            "requires_validation",
          );
          break;
        }
        const split = applyThreshold(amount, remaining, ctx.rules);
        remaining = split.remainingAfter;
        const status: TreatmentStatus =
          split.taxable === 0 ? "potentially_excluded" : split.excluded === 0 ? "fully_taxable" : "partially_taxable";
        const th = ctx.threshold;
        const why = th.exclusionLost
          ? "A new link with the same entity within 24 months voids the exclusion, so the whole amount is taxable."
          : `Qualifying threshold = average monthly remuneration (${th.avgMonthlyRemuneration}) x ${th.years} year(s) or fraction = ${th.threshold}. This parcel uses ${num(D(amount).minus(split.taxable))} of the threshold; the excess ${split.taxable} is taxable.`;
        t = full(
          p,
          status,
          split.taxable,
          split.excluded,
          why,
          "CIRS art. 2(4)(b)",
          ["termination-indemnity-2026"],
          // Facts of remuneration/seniority are inputs the user must verify.
          ctx.rules.terminationIndemnity.excessInclusionRate === 1 ? "medium" : "low",
        );
        break;
      }
      case "salary_arrears":
      case "holiday_pay":
      case "holiday_allowance":
      case "christmas_allowance":
      case "other_remuneration":
        t = taxableAll(
          p,
          "Accrued remuneration is ordinary Category A income. It does not benefit from the termination-compensation exclusion.",
          "CIRS art. 2(1)",
          ["accrued-rights"],
          "high",
        );
        break;
      case "notice_compensation":
        t = taxableAll(
          p,
          "Compensation for missing notice may be argued either as remuneration or as termination compensation. Modelled conservatively as taxable; validate the characterisation.",
          "CIRS art. 2 (characterisation to confirm)",
          ["accrued-rights"],
          "low",
          "requires_validation",
        );
        break;
      case "moral_damages":
        t = excludedAll(
          p,
          "potentially_excluded",
          "Damages repairing genuinely non-patrimonial harm are generally not income from work. Whether they are respected as such depends on the facts, legal basis and wording of the settlement.",
          "CIRS (article to be confirmed)",
          ["damages-treatment"],
          "medium",
        );
        break;
      case "material_damages":
        t = excludedAll(
          p,
          "potentially_excluded",
          "Material damages repairing a proven loss may fall outside IRS, but amounts that replace lost income can be taxable as Category A. Requires validation against the legal basis.",
          "CIRS (article to be confirmed)",
          ["damages-treatment"],
          "low",
        );
        break;
      case "litigation_settlement":
        t = taxableAll(
          p,
          "A general settlement without an itemised legal basis cannot be reliably classified. Shown as fully taxable until each component is characterised.",
          "To be determined",
          ["damages-treatment"],
          "low",
          "requires_validation",
        );
        break;
      case "lawyer_fee_reimbursed":
      case "other_legal_costs_reimbursed":
        t = excludedAll(
          p,
          "requires_validation",
          "A reimbursement of legal costs actually incurred is modelled as a pass-through, not income. Its IRS treatment is a separate legal question and is not assumed to be settled.",
          "To be determined",
          ["lawyer-fees"],
          "low",
        );
        break;
      case "other_compensation":
      case "unknown":
      default:
        t = taxableAll(p, "Unclassified amounts are shown as fully taxable until their nature is established.", "To be determined", [], "low", "unknown");
    }
  }

  // Conservative pass: anything uncertain becomes fully taxable.
  if (ctx.conservative && isUncertain(t) && t.excludedAmount > 0) {
    t = { ...t, taxableAmount: num(cents(t.grossAmount)), excludedAmount: 0, explanation: `[Conservative case] ${t.explanation}` };
  }
  return { treatment: t, remainingThreshold: remaining };
}
