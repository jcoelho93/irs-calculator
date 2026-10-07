import type { Parcel, ParcelTreatment } from "../parcels/types";
import type { LawyerFeeResult } from "./lawyerFees";
import type { IrsBreakdown } from "../tax/irs";
import type { TerminationThreshold } from "../tax/termination";

export type RiskLevel = "green" | "yellow" | "red";

export interface ValidationIssue {
  /** Dot path of the field, e.g. "employment.terminationDate" or "parcels.<id>.amount". */
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface Assumption {
  id: string;
  text: string;
  level: "ok" | "warning" | "not_modelled";
}

export interface CalculationResult {
  taxYear: number;
  grossSettlement: number;
  taxableSettlement: number;
  excludedSettlement: number;
  /** Taxable employment income = other income + taxable settlement (Cat A). */
  taxableEmploymentIncome: number;
  otherTaxableIncome: number;
  /** IRS attributable to the settlement: IRS(with settlement) - IRS(without). */
  estimatedIRS: number;
  totalIRSWithSettlement: number;
  baselineIRS: number;
  lawyerFee: number;
  lawyer: LawyerFeeResult;
  otherCosts: number;
  netCash: number;
  effectiveTaxRate: number;
  effectiveLawyerCost: number;
  effectiveNetPercentage: number;
  /** Withholding is NOT final liability. */
  withholdingOnSettlement: number;
  /** estimatedIRS - withholding; positive = still to pay, negative = refund. */
  withholdingBalance: number;
  /** Cash reimbursed by employer for legal costs (part of gross). */
  employerReimbursedLegalCosts: number;
  /** Cash-in not allocated to any parcel vs the declared settlement total. */
  allocated: number;
  unallocated: number;
  threshold: TerminationThreshold | null;
  irsDetail: { withSettlement: IrsBreakdown; baseline: IrsBreakdown };
  parcels: ParcelTreatment[];
  risk: { level: RiskLevel; reasons: string[] };
  assumptions: Assumption[];
  issues: ValidationIssue[];
  /** Same scenario with every uncertain parcel treated as fully taxable. */
  conservative: { estimatedIRS: number; netCash: number } | null;
  /** Items that could not be modelled; UI shows "Not modelled". */
  notModelled: string[];
}

export type ParcelLike = Pick<Parcel, "id">;
