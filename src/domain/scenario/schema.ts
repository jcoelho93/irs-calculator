import { z } from "zod";
import { PARCEL_CATEGORIES } from "../parcels/types";
import { SCHEMA_VERSION, TERMINATION_REASONS } from "./types";
import type { Scenario } from "./types";

const money = z.number().finite();
const isoDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/);
const categories = PARCEL_CATEGORIES.map((c) => c.value) as [string, ...string[]];

export const parcelSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  amount: money,
  category: z.enum(categories),
  notes: z.string().default(""),
  legalBasis: z.string().default(""),
  userConfidence: z.enum(["high", "medium", "low"]).default("medium"),
  override: z.enum(["fully_taxable", "fully_excluded"]).nullable().default(null),
  enabled: z.boolean().default(true),
});

export const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  notes: z.string().default(""),
  employment: z.object({
    startDate: isoDate,
    terminationDate: isoDate,
    monthlyGrossSalary: money,
    avgMonthlyRemuneration: money,
    avgFromAnnual: z.boolean().default(false),
    annualGrossSalary: money,
    terminationReason: z.enum(TERMINATION_REASONS),
    employer: z.string().default(""),
    position: z.string().default(""),
    collectiveAgreement: z.string().default(""),
    rehiredWithin24Months: z.boolean().default(false),
  }),
  tax: z.object({
    taxYear: z.number().int(),
    maritalStatus: z.enum(["single", "married_joint", "married_separate", "other"]),
    dependents: z.number().int().min(0),
    disabilityPct: z.number().min(0).max(100),
    otherAnnualIncome: money,
    socialSecurityContributions: money,
    withholdingOnSettlement: money,
  }),
  parcels: z.array(parcelSchema),
  settlementTotal: money,
  lawyer: z.object({
    mode: z.enum(["percentage", "fixed", "hybrid"]),
    percentage: money,
    fixedAmount: money,
    vatRate: money,
    vatIncluded: z.boolean(),
  }),
  otherCosts: money,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const exportEnvelopeSchema = z.object({
  version: z.number().int(),
  scenario: z.unknown(),
});

/** Migrate older exported scenarios to the current schema. v1 is current. */
export function migrateScenario(version: number, raw: unknown): unknown {
  if (version > SCHEMA_VERSION) throw new Error(`Unsupported schema version ${version}`);
  // Future: if (version < 2) raw = v1ToV2(raw);
  return raw;
}

export function parseScenario(version: number, raw: unknown): Scenario {
  return scenarioSchema.parse(migrateScenario(version, raw)) as Scenario;
}
