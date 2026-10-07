export type Confidence = "high" | "medium" | "low";

export type ParcelCategory =
  | "termination_indemnity"
  | "salary_arrears"
  | "holiday_pay"
  | "holiday_allowance"
  | "christmas_allowance"
  | "notice_compensation"
  | "other_remuneration"
  | "moral_damages"
  | "material_damages"
  | "litigation_settlement"
  | "lawyer_fee_reimbursed"
  | "other_legal_costs_reimbursed"
  | "other_compensation"
  | "unknown";

export type ParcelGroup = "Employment-related" | "Damages" | "Costs" | "Other";

export const PARCEL_CATEGORIES: { value: ParcelCategory; label: string; group: ParcelGroup }[] = [
  { value: "termination_indemnity", label: "Termination indemnity / compensation", group: "Employment-related" },
  { value: "salary_arrears", label: "Salary arrears", group: "Employment-related" },
  { value: "holiday_pay", label: "Holiday pay", group: "Employment-related" },
  { value: "holiday_allowance", label: "Holiday allowance", group: "Employment-related" },
  { value: "christmas_allowance", label: "Christmas allowance", group: "Employment-related" },
  { value: "notice_compensation", label: "Notice-period compensation", group: "Employment-related" },
  { value: "other_remuneration", label: "Other employment remuneration", group: "Employment-related" },
  { value: "moral_damages", label: "Moral / non-material damages", group: "Damages" },
  { value: "material_damages", label: "Material damages", group: "Damages" },
  { value: "litigation_settlement", label: "Litigation settlement / general damages", group: "Damages" },
  { value: "lawyer_fee_reimbursed", label: "Lawyer fee reimbursed by employer", group: "Costs" },
  { value: "other_legal_costs_reimbursed", label: "Other reimbursed legal costs", group: "Costs" },
  { value: "other_compensation", label: "Other compensation", group: "Other" },
  { value: "unknown", label: "Unknown / unclassified", group: "Other" },
];

export const categoryLabel = (c: ParcelCategory): string =>
  PARCEL_CATEGORIES.find((p) => p.value === c)?.label ?? c;

/** Manual override of the engine's tax treatment for a parcel. */
export type TreatmentOverride = "fully_taxable" | "fully_excluded";

export interface Parcel {
  id: string;
  name: string;
  amount: number;
  category: ParcelCategory;
  notes: string;
  /** Free-text legal basis / contract clause the user relies on. */
  legalBasis: string;
  /** User's own confidence in the factual classification. */
  userConfidence: Confidence;
  override: TreatmentOverride | null;
  enabled: boolean;
}

export type TreatmentStatus =
  | "fully_taxable"
  | "partially_taxable"
  | "potentially_excluded"
  | "not_normally_taxable"
  | "unknown"
  | "requires_validation";

export const STATUS_LABEL: Record<TreatmentStatus, string> = {
  fully_taxable: "Fully taxable",
  partially_taxable: "Partially taxable",
  potentially_excluded: "Potentially excluded",
  not_normally_taxable: "Not normally taxable",
  unknown: "Unknown",
  requires_validation: "Requires professional validation",
};

export interface ParcelTreatment {
  parcelId: string;
  classification: ParcelCategory;
  status: TreatmentStatus;
  grossAmount: number;
  taxableAmount: number;
  excludedAmount: number;
  explanation: string;
  legalBasis: string;
  sourceIds: string[];
  confidence: Confidence;
  overridden: boolean;
}
