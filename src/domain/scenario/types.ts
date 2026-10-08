import type { Parcel } from "../parcels/types";

export const TERMINATION_REASONS = [
  "Extinção do posto de trabalho",
  "Despedimento coletivo",
  "Despedimento por inadaptação",
  "Despedimento por facto imputável ao trabalhador",
  "Revogação / acordo",
  "Rescisão pelo trabalhador",
  "Other",
] as const;
export type TerminationReason = (typeof TERMINATION_REASONS)[number];

export type MaritalStatus = "single" | "married_joint" | "married_separate" | "other";

export type LawyerFeeMode = "percentage" | "fixed" | "hybrid";

export interface LawyerFeeConfig {
  mode: LawyerFeeMode;
  /** Percentage points, e.g. 25 = 25%. */
  percentage: number;
  fixedAmount: number;
  /** Percentage points. */
  vatRate: number;
  /** If true, the quoted fee already includes VAT. */
  vatIncluded: boolean;
}

export interface Employment {
  startDate: string; // ISO yyyy-mm-dd
  terminationDate: string;
  monthlyGrossSalary: number;
  /** Average monthly regular remuneration (last 12 months, incl. holiday/Christmas allowances / 12). */
  avgMonthlyRemuneration: number;
  /** If true, avgMonthlyRemuneration is derived from the annual gross salary / 12. */
  avgFromAnnual: boolean;
  annualGrossSalary: number;
  terminationReason: TerminationReason;
  employer: string;
  position: string;
  collectiveAgreement: string;
  /** art. 2(4): new link with the same entity within 24 months voids the exclusion. */
  rehiredWithin24Months: boolean;
}

export interface TaxInputs {
  taxYear: number;
  maritalStatus: MaritalStatus;
  dependents: number;
  /** Permanent incapacity percentage (0-100). */
  disabilityPct: number;
  /** Other annual gross Category A income in the tax year, excluding this settlement. */
  otherAnnualIncome: number;
  /** Gross Category B (self-employed) income in the tax year. */
  categoryBGross: number;
  /** Category B income taxable after the regime, before the art. 56-A exclusion. */
  categoryBTaxable: number;
  /** Mandatory social-security contributions on that income (used if higher than the specific deduction). */
  socialSecurityContributions: number;
  /** IRS withheld at source on the settlement (not the same as final liability). */
  withholdingOnSettlement: number;
}

export interface Scenario {
  id: string;
  name: string;
  notes: string;
  employment: Employment;
  tax: TaxInputs;
  parcels: Parcel[];
  /** Total settlement agreed (for the allocation check). */
  settlementTotal: number;
  lawyer: LawyerFeeConfig;
  otherCosts: number;
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA_VERSION = 1;
