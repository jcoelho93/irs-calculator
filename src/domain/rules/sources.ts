import type { RuleSource } from "./types";

/**
 * Centralised sources registry. React components reference sources by id only.
 * `accessed` is the date these were consulted in the build session.
 * The official Portal das Financas / DRE pages were NOT reachable from the build
 * sandbox; where a figure was confirmed only via secondary sources it is flagged.
 */
export const SOURCES: RuleSource[] = [
  {
    id: "irs-brackets-2026",
    jurisdiction: "PT",
    taxYear: 2026,
    title: "IRS rate table, mainland Portugal (OE 2026)",
    legalReference: "CIRS art. 68; Lei n.º 73-A/2025 (OE 2026)",
    description:
      "Nine progressive brackets, 12.5% to 48%, with bracket limits updated by 3.51%. Applied here by slicing taxable income (equivalent to the official 'parcela a abater' method).",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68.aspx",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
  },
  {
    id: "specific-deduction-2026",
    jurisdiction: "PT",
    taxYear: 2026,
    title: "Category A specific deduction",
    legalReference: "CIRS art. 25 (8.54 x IAS)",
    description:
      "€4,587.09 in 2026 (8.54 x IAS of €537.13), or the mandatory social-security contributions if higher.",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
  },
  {
    id: "termination-indemnity-2026",
    jurisdiction: "PT",
    taxYear: 2026,
    title: "Tax on termination compensation",
    legalReference: "CIRS art. 2(4)(b)",
    description:
      "Amounts paid on termination of an employment contract are taxed only on the part exceeding: average monthly regular remuneration (last 12 months, with retribution character, subject to tax) x years or fraction of seniority with the paying entity. The exclusion is lost if a new link with the same entity is created within 24 months. Accrued rights (arrears, holiday pay, allowances) do not benefit from it. Whether the excess is taxed at 100% (as modelled) must be validated.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs2.aspx",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
  },
  {
    id: "disability-56a",
    jurisdiction: "PT",
    taxYear: null,
    title: "Reduced taxable income for taxpayers with disability",
    legalReference: "CIRS art. 56-A",
    description:
      "For taxpayers with permanent incapacity >= 60%, gross category A and B income is considered at 85% (H at 90%); the excluded part cannot exceed €2,500 per category.",
    url: "https://informador.pt/legislacao/lexit/codigos/direito-fiscal/codigo-do-irs/capitulo-ii-determinacao-do-rendimento-coletavel/seccao-ix-abatimentos/artigo-56-o-a-sujeitos-passivos-com-deficiencia/",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2023-01-01",
    effectiveTo: null,
  },
  {
    id: "disability-87",
    jurisdiction: "PT",
    taxYear: null,
    title: "Tax credit for taxpayers with disability",
    legalReference: "CIRS art. 87",
    description:
      "A deduction from the computed tax of 4 x IAS per taxpayer with incapacity >= 60% (2.5 x IAS per disabled dependent; extra deductions for companionship at >= 90% and for rehabilitation/insurance expenses are not modelled).",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs87.aspx",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2015-01-01",
    effectiveTo: null,
  },
  {
    id: "solidarity-68a",
    jurisdiction: "PT",
    taxYear: null,
    title: "Additional solidarity rate",
    legalReference: "CIRS art. 68-A",
    description: "2.5% on taxable income between €80,000 and €250,000, 5% above €250,000.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68a.aspx",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2013-01-01",
    effectiveTo: null,
  },
  {
    id: "damages-treatment",
    jurisdiction: "PT",
    taxYear: null,
    title: "Damages and litigation settlements",
    legalReference: "CIRS arts. 2, 9, 10, 12 (to be confirmed)",
    description:
      "Whether damages are taxable depends on what they repair (loss of income vs. non-patrimonial harm) and on the wording and legal basis of the settlement. No exact article has been verified: the engine models the outcome as an explicit, user-overridable assumption.",
    accessed: "2026-10-07",
    verification: "needs-verification",
    effectiveFrom: "1989-01-01",
    effectiveTo: null,
  },
  {
    id: "accrued-rights",
    jurisdiction: "PT",
    taxYear: null,
    title: "Accrued remuneration is ordinary Category A income",
    legalReference: "CIRS art. 2(1)",
    description:
      "Salary arrears, holiday pay and holiday/Christmas allowances are remuneration, not termination compensation, and are taxed as ordinary employment income. Social-security contributions on these are not modelled.",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "1989-01-01",
    effectiveTo: null,
  },
  {
    id: "lawyer-fees",
    jurisdiction: "PT",
    taxYear: null,
    title: "Lawyer fees",
    legalReference: "n/a",
    description:
      "Modelled purely as a cash cost. No claim is made that they are deductible for IRS; that is a separate legal question.",
    accessed: "2026-10-07",
    verification: "needs-verification",
    effectiveFrom: "1989-01-01",
    effectiveTo: null,
  },
];

export const getSource = (id: string): RuleSource | undefined => SOURCES.find((s) => s.id === id);
