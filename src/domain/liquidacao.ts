/**
 * Reads the figures the calculator can reuse from the text of a "Demonstração de Liquidação de IRS"
 * (the assessment PDF from Portal das Finanças). Pure text parsing: extracting the text from the PDF
 * lives in `lib/pdfText.ts`.
 */

export interface Liquidacao {
  /** Income year the assessment covers, e.g. 2025. */
  year: number | null;
  /** Line 19: deductions from tax actually applied, after the art. 78 limit. */
  deductionsApplied: number;
  /** "Dedução pessoas com deficiência" (art. 87), included in line 19. */
  disabilityDeduction: number;
  /** Line 20 rate, e.g. 0.02. */
  municipalBenefit: number;
  /** IRS Jovem year shown for "Sujeito Passivo A" in that income year; null when not under IRS Jovem. */
  irsJovemYear: number | null;
  /** Line 24, for information only (it is last year's). */
  withholding: number | null;
  /** Line 22, for information only. */
  netTax: number | null;
}

export class NotALiquidacaoError extends Error {}

/** "12.345,67" -> 12345.67 */
const ptNumber = (s: string): number => Number(s.replace(/\./g, "").replace(",", "."));

const AMOUNT = String.raw`(-?\d{1,3}(?:\.\d{3})*,\d{2})`;

/** Last amount on the first line whose start matches `label`. */
function amountAfter(lines: string[], label: RegExp): number | null {
  for (const line of lines) {
    if (!label.test(line)) continue;
    const all = [...line.matchAll(new RegExp(AMOUNT, "g"))];
    if (all.length > 0) return ptNumber(all[all.length - 1][1]);
  }
  return null;
}

export function parseLiquidacao(text: string): Liquidacao {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  if (!/Demonstra[çc][ãa]o de Liquida[çc][ãa]o de IRS/i.test(text)) {
    throw new NotALiquidacaoError("O PDF não parece ser uma demonstração de liquidação de IRS.");
  }
  // Line 19 of the summary ("19 Deduções à coleta 1.234,56"); the detail table has a header with
  // the same words but no amount, which amountAfter skips.
  const applied = amountAfter(lines, /^(19 )?Deduções à coleta\b/i) ?? amountAfter(lines, /^Dedução Efetiva\b/i);
  if (applied === null) {
    throw new NotALiquidacaoError("Não foi possível encontrar as deduções à coleta neste PDF.");
  }
  const period = text.match(/(\d{4})-01-01 a \d{4}-12-31/);
  const municipal = text.match(/Benefício Municipal \((\d+(?:,\d+)?)\s*%/i);
  const jovem = lines.find((l) => /^Sujeito Passivo A\b/.test(l))?.match(/(\d+)\s*º ano/);
  return {
    year: period ? Number(period[1]) : null,
    deductionsApplied: applied,
    disabilityDeduction: amountAfter(lines, /^Dedução pessoas com deficiência\b/i) ?? 0,
    municipalBenefit: municipal ? ptNumber(municipal[1]) / 100 : 0,
    irsJovemYear: jovem ? Number(jovem[1]) : null,
    withholding: amountAfter(lines, /^(24 )?Retenções na fonte\b/i),
    netTax: amountAfter(lines, /^(22 )?COLETA LÍQUIDA\b/i),
  };
}

/**
 * What the calculator takes from the assessment, for the given tax year. The disability deduction
 * is left out of the deductions total because the calculator adds it itself when the disability
 * degree is >= 60%; its presence tells us the taxpayer qualifies. The IRS Jovem year moves forward
 * by the number of years between the assessment and the tax year (none after the 10th).
 */
export interface LiquidacaoPatch {
  taxDeductions: number;
  hasDisability: boolean;
  municipalBenefit: number;
  irsJovemYear: number;
}

export function patchFromLiquidacao(l: Liquidacao, taxYear: number): LiquidacaoPatch {
  const ahead = l.year === null ? 1 : Math.max(0, taxYear - l.year);
  const jy = l.irsJovemYear === null ? 0 : l.irsJovemYear + ahead;
  return {
    taxDeductions: Math.max(0, Math.round((l.deductionsApplied - l.disabilityDeduction) * 100) / 100),
    hasDisability: l.disabilityDeduction > 0,
    municipalBenefit: l.municipalBenefit,
    irsJovemYear: jy >= 1 && jy <= 10 ? jy : 0,
  };
}
