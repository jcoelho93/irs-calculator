import { parseScenario, exportEnvelopeSchema } from "../scenario/schema";
import { SCHEMA_VERSION } from "../scenario/types";
import type { Scenario } from "../scenario/types";
import { categoryLabel } from "../parcels/types";
import type { CalculationResult } from "../calculations/types";

export const exportScenarioJson = (scenario: Scenario): string =>
  JSON.stringify({ version: SCHEMA_VERSION, scenario }, null, 2);

export function importScenarioJson(text: string): Scenario {
  const env = exportEnvelopeSchema.parse(JSON.parse(text));
  return parseScenario(env.version, env.scenario);
}

const esc = (v: string | number | boolean): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function parcelsToCsv(scenario: Scenario, result: CalculationResult): string {
  const header = ["name", "category", "amount", "enabled", "status", "taxable", "excluded", "confidence", "explanation"];
  const rows = scenario.parcels.map((p) => {
    const t = result.parcels.find((x) => x.parcelId === p.id);
    return [p.name, categoryLabel(p.category), p.amount, p.enabled, t?.status ?? "", t?.taxableAmount ?? "", t?.excludedAmount ?? "", t?.confidence ?? "", t?.explanation ?? ""];
  });
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
