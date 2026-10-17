import type { RuleSource } from "./types";

/**
 * Registo central de fontes. Os componentes React referem as fontes apenas por id.
 * `accessed` é a data em que foram consultadas durante o desenvolvimento.
 * As páginas oficiais do Portal das Finanças e do DRE não estavam acessíveis a partir do
 * ambiente de desenvolvimento; onde um valor foi confirmado apenas por fontes secundárias,
 * fica assinalado em `verification`.
 */
export const SOURCES: RuleSource[] = [
  {
    id: "irs-brackets-2026",
    jurisdiction: "PT",
    taxYear: 2026,
    title: "Tabela de taxas de IRS, Continente (OE 2026)",
    legalReference: "CIRS art. 68.º; Lei n.º 73-A/2025 (OE 2026)",
    description:
      "Nove escalões progressivos, de 12,5% a 48%, com os limites dos escalões atualizados em 3,51%. Aplicada por fatias do rendimento coletável (equivalente ao método oficial da parcela a abater).",
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
    title: "Dedução específica da categoria A",
    legalReference: "CIRS art. 25.º (8,54 × IAS)",
    description:
      "4 587,09 € em 2026 (8,54 × IAS de 537,13 €), ou o valor das contribuições obrigatórias para regimes de proteção social, se superior.",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
  },
  {
    id: "disability-56a",
    jurisdiction: "PT",
    taxYear: null,
    title: "Rendimento considerado para sujeitos passivos com deficiência",
    legalReference: "CIRS art. 56.º-A",
    description:
      "Para sujeitos passivos com incapacidade permanente igual ou superior a 60%, os rendimentos brutos das categorias A e B são considerados apenas por 85% (categoria H por 90%); a parte excluída não pode exceder 2 500 € por categoria (o limite aplica-se separadamente a A e a B). Não foi confirmada, em fonte oficial, a ordem do cálculo face ao coeficiente do regime simplificado.",
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
    title: "Dedução à coleta para sujeitos passivos com deficiência",
    legalReference: "CIRS art. 87.º",
    description:
      "Dedução à coleta de 4 × IAS por sujeito passivo com incapacidade igual ou superior a 60% (2,5 × IAS por dependente com deficiência). As deduções adicionais de despesas de acompanhamento (grau igual ou superior a 90%) e de reabilitação ou seguros não estão modeladas.",
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
    title: "Taxa adicional de solidariedade",
    legalReference: "CIRS art. 68.º-A",
    description: "2,5% sobre o rendimento coletável entre 80 000 € e 250 000 €, e 5% acima de 250 000 €.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68a.aspx",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "2013-01-01",
    effectiveTo: null,
  },
  {
    id: "category-b-coefficients",
    jurisdiction: "PT",
    taxYear: null,
    title: "Regime simplificado da categoria B",
    legalReference: "CIRS art. 31.º",
    description:
      "No regime simplificado, o rendimento tributável obtém-se aplicando um coeficiente ao rendimento bruto: 0,75 para as atividades profissionais da tabela do art. 151.º, 0,35 para outras prestações de serviços e 0,15 para vendas. A exigência de justificar despesas (15% dos rendimentos a 0,75) não está modelada; o coeficiente pode ser ajustado nas opções avançadas.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs31.aspx",
    accessed: "2026-10-17",
    verification: "secondary-source",
    effectiveFrom: "2015-01-01",
    effectiveTo: null,
  },
  {
    id: "social-security",
    jurisdiction: "PT",
    taxYear: null,
    title: "Contribuições para a Segurança Social",
    legalReference: "Código dos Regimes Contributivos, arts. 53.º, 162.º e 168.º",
    description:
      "Trabalhador por conta de outrem: 11% da remuneração. Trabalhador independente: 21,4% do rendimento relevante, que é 70% dos rendimentos de prestação de serviços (20% nas vendas). A isenção no primeiro ano de atividade e a base mínima não estão modeladas; as taxas podem ser ajustadas nas opções avançadas.",
    accessed: "2026-10-17",
    verification: "secondary-source",
    effectiveFrom: "2019-01-01",
    effectiveTo: null,
  },
  {
    id: "irs-jovem",
    jurisdiction: "PT",
    taxYear: null,
    title: "IRS Jovem",
    legalReference: "CIRS art. 12.º-B",
    description:
      "Durante 10 anos a partir do primeiro ano de rendimentos após os estudos (até aos 35 anos), fica isenta uma parte dos rendimentos brutos das categorias A e B: 100% no 1.º ano, 75% do 2.º ao 4.º, 50% do 5.º ao 7.º e 25% do 8.º ao 10.º, com o limite anual de 55 × IAS. O rendimento isento é englobado para determinar a taxa. A ordem do cálculo (primeiro a exclusão do art. 56.º-A, depois a isenção, depois o coeficiente da categoria B) foi deduzida reconciliando uma declaração e a respetiva nota de liquidação, não de texto oficial; as condições de elegibilidade não são verificadas.",
    url: "https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs12b.aspx",
    accessed: "2026-10-17",
    verification: "secondary-source",
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
  },
  {
    id: "municipal-benefit",
    jurisdiction: "PT",
    taxYear: null,
    title: "Benefício municipal (participação variável no IRS)",
    legalReference: "Lei n.º 73/2013, art. 26.º",
    description:
      "Cada município pode devolver aos residentes até 5% do IRS. Na nota de liquidação, é calculado sobre a coleta depois das deduções à coleta. A percentagem depende do município de residência em 31 de dezembro.",
    accessed: "2026-10-17",
    verification: "secondary-source",
    effectiveFrom: "2014-01-01",
    effectiveTo: null,
  },
];

export const getSource = (id: string): RuleSource | undefined => SOURCES.find((s) => s.id === id);
