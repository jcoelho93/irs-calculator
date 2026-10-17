import { DEFAULT_INPUT, PERIOD_MONTHS } from "./income";
import type { IncomeInput } from "./income";
import { supportedTaxYears } from "./rules";
import type { Bracket } from "./rules/types";

/** Identifies files written by this app, so an unrelated JSON file is rejected. */
export const FILE_KIND = "irs-income-calculator";
export const FILE_VERSION = 1;

export interface SavedFile {
  kind: typeof FILE_KIND;
  version: number;
  savedAt: string;
  input: IncomeInput;
}

export class InvalidFileError extends Error {}

export function serializeInput(input: IncomeInput, now = new Date()): string {
  const file: SavedFile = { kind: FILE_KIND, version: FILE_VERSION, savedAt: now.toISOString(), input };
  return JSON.stringify(file, null, 2);
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isBrackets(v: unknown): v is Bracket[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((b) => b && typeof b === "object" && (b.upTo === null || isNum(b.upTo)) && isNum(b.rate))
  );
}

/**
 * Keep only the known fields whose values have the right type; anything missing or malformed falls
 * back to the default. Used for imported files and for what is stored in the browser.
 */
export function sanitizeInput(raw: unknown): IncomeInput {
  const out: IncomeInput = { ...DEFAULT_INPUT };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_INPUT) as (keyof IncomeInput)[]) {
    const v = r[key];
    if (v === undefined) continue;
    const ok =
      key === "taxYear" ? supportedTaxYears().includes(v as number)
      : key === "employmentPeriod" ? typeof v === "string" && v in PERIOD_MONTHS
      : key === "brackets" ? v === null || isBrackets(v)
      : key === "solidarity" ? typeof v === "boolean"
      : DEFAULT_INPUT[key] === null ? v === null || isNum(v)
      : isNum(v);
    if (ok) (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}

export function parseSavedFile(text: string): IncomeInput {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidFileError("O ficheiro não é um JSON válido.");
  }
  const f = data as Partial<SavedFile> | null;
  if (!f || typeof f !== "object" || f.kind !== FILE_KIND || !f.input) {
    throw new InvalidFileError("O ficheiro não foi exportado por esta calculadora.");
  }
  if (!isNum(f.version) || f.version > FILE_VERSION) {
    throw new InvalidFileError("O ficheiro foi criado por uma versão mais recente da calculadora.");
  }
  return sanitizeInput(f.input);
}
