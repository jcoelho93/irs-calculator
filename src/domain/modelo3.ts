/**
 * Reads last year's income from the text of a Modelo 3 IRS declaration (the "comprovativo" PDF
 * from Portal das Finanças): Anexo A for employment income and Anexo B for self-employed income
 * under the simplified regime. Pure text parsing; `lib/pdfText.ts` extracts the pages.
 */

export interface Modelo3 {
  year: number | null;
  /** Anexo A, quadro 4A totals (all holders). */
  employment: { income: number; withholding: number; contributions: number } | null;
  /** Anexo B, quadro 4A amounts by income code. */
  selfEmployed: { code: string; amount: number }[];
}

export class NotAModelo3Error extends Error {}

/** Simplified-regime coefficients (art. 31 CIRS) for the common Anexo B codes. */
export const ANEXO_B_COEFFICIENTS: Record<string, number> = {
  "401": 0.15, // vendas de mercadorias e produtos
  "403": 0.75, // atividades da tabela do art. 151.º
  "404": 0.35, // outras prestações de serviços
};

const AMOUNT = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;
const ptNumber = (s: string): number => Number(s.replace(/\./g, "").replace(",", "."));
const amounts = (line: string): number[] => [...line.matchAll(new RegExp(AMOUNT, "g"))].map((m) => ptNumber(m[0]));

/** The page whose title line is exactly "Anexo X". */
const annexPage = (pages: string[], annex: string): string[] | undefined =>
  pages.map((p) => p.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim())).find((lines) => lines.includes(`Anexo ${annex}`));

export function parseModelo3(pages: string[]): Modelo3 {
  const all = pages.join("\n");
  if (!/MODELO 3/.test(all) || !/DECLARAÇÃO DE RENDIMENTOS - IRS/i.test(all)) {
    throw new NotAModelo3Error("O PDF não parece ser uma declaração Modelo 3 de IRS.");
  }
  const yearMatch = all.match(/Mod\.3 IRS: \d+ \/ (\d{4}) \//) ?? all.match(/ANO DOS RENDIMENTOS[\s\S]{0,200}?\b01 (\d{4})\b/);

  let employment: Modelo3["employment"] = null;
  const a = annexPage(pages, "A");
  const soma = a?.find((l) => l.startsWith("SOMA DE CONTROLO"));
  if (soma) {
    // Columns: rendimentos, retenções, contribuições, sobretaxa, quotizações.
    const [income = 0, withholding = 0, contributions = 0] = amounts(soma);
    employment = { income, withholding, contributions };
  }

  const selfEmployed: Modelo3["selfEmployed"] = [];
  const b = annexPage(pages, "B");
  if (b) {
    const start = b.findIndex((l) => /^A RENDIMENTOS PROFISSIONAIS, COMERCIAIS E INDUSTRIAIS/.test(l));
    for (const line of start >= 0 ? b.slice(start + 1) : []) {
      if (line.startsWith("SOMA")) break;
      const m = line.match(new RegExp(String.raw`\b(4\d\d) (${AMOUNT})$`));
      if (m && ptNumber(m[2]) > 0) selfEmployed.push({ code: m[1], amount: ptNumber(m[2]) });
    }
  }

  if (!employment && selfEmployed.length === 0) {
    throw new NotAModelo3Error("Não foram encontrados rendimentos das categorias A ou B nesta declaração.");
  }
  return { year: yearMatch ? Number(yearMatch[1]) : null, employment, selfEmployed };
}

export interface Modelo3Patch {
  employment: number;
  /** Contributions / income, when contributions were declared. */
  employeeSsRate: number | null;
  selfEmployed: number;
  /** Weighted coefficient of the known codes; null when none were found. */
  selfEmployedCoefficient: number | null;
  /** Anexo B codes the calculator has no coefficient for (left out). */
  skippedCodes: string[];
}

export function patchFromModelo3(m: Modelo3): Modelo3Patch {
  const known = m.selfEmployed.filter((r) => r.code in ANEXO_B_COEFFICIENTS);
  const bGross = known.reduce((s, r) => s + r.amount, 0);
  const bTaxable = known.reduce((s, r) => s + r.amount * ANEXO_B_COEFFICIENTS[r.code], 0);
  const e = m.employment;
  return {
    employment: e?.income ?? 0,
    employeeSsRate: e && e.income > 0 && e.contributions > 0 ? Math.round((e.contributions / e.income) * 1e6) / 1e6 : null,
    selfEmployed: Math.round(bGross * 100) / 100,
    selfEmployedCoefficient: bGross > 0 ? Math.round((bTaxable / bGross) * 10000) / 10000 : null,
    skippedCodes: m.selfEmployed.filter((r) => !(r.code in ANEXO_B_COEFFICIENTS)).map((r) => r.code),
  };
}
