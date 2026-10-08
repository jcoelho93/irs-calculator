import type { Parcel } from "../parcels/types";
import type { Scenario } from "./types";

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

export const newParcel = (over: Partial<Parcel> = {}): Parcel => ({
  id: newId(),
  name: "New parcel",
  amount: 0,
  category: "unknown",
  notes: "",
  legalBasis: "",
  userConfidence: "medium",
  override: null,
  enabled: true,
  ...over,
});

/**
 * Blank starter scenario: no example amounts, dates, remuneration or fee rates.
 * Everything (including disability %) is a user input, never hard-coded.
 */
export function newScenario(name = "Scenario A"): Scenario {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    notes: "",
    employment: {
      startDate: "",
      terminationDate: "",
      monthlyGrossSalary: 0,
      avgMonthlyRemuneration: 0,
      avgFromAnnual: false,
      annualGrossSalary: 0,
      terminationReason: "Extinção do posto de trabalho",
      employer: "",
      position: "",
      collectiveAgreement: "",
      rehiredWithin24Months: false,
    },
    tax: {
      taxYear: 2026,
      maritalStatus: "single",
      dependents: 0,
      disabilityPct: 0,
      otherAnnualIncome: 0,
      categoryBGross: 0,
      categoryBTaxable: 0,
      socialSecurityContributions: 0,
      withholdingOnSettlement: 0,
    },
    parcels: [newParcel({ name: "Termination compensation", amount: 0, category: "termination_indemnity" })],
    settlementTotal: 0,
    lawyer: { mode: "percentage", percentage: 0, fixedAmount: 0, vatRate: 23, vatIncluded: true },
    otherCosts: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Deep, independent copy with fresh ids. */
export function duplicateScenario(s: Scenario, name?: string): Scenario {
  const now = new Date().toISOString();
  const copy: Scenario = structuredClone(s);
  return {
    ...copy,
    id: newId(),
    name: name ?? `${s.name} (copy)`,
    parcels: copy.parcels.map((p) => ({ ...p, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
}
