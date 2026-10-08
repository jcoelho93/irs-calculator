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
    id: "termination-indemnity-2026",
    jurisdiction: "PT",
    taxYear: 2026,
    title: "Tributação das indemnizações por cessação do contrato de trabalho",
    legalReference: "CIRS art. 2.º, n.º 4, al. b)",
    description:
      "As importâncias pagas pela cessação do contrato de trabalho só são tributadas na parte que exceda o valor médio das remunerações regulares com carácter de retribuição, sujeitas a imposto, auferidas nos últimos 12 meses, multiplicado pelo número de anos ou fração de antiguidade na entidade devedora. A exclusão perde-se se, nos 24 meses seguintes, for criado novo vínculo com a mesma entidade. Os créditos já vencidos (salários em atraso, férias, subsídios) não beneficiam da exclusão. Está por confirmar se o excedente é tributado a 100%, como aqui modelado.",
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
    title: "Rendimento considerado para sujeitos passivos com deficiência",
    legalReference: "CIRS art. 56.º-A",
    description:
      "Para sujeitos passivos com incapacidade permanente igual ou superior a 60%, os rendimentos brutos das categorias A e B são considerados apenas por 85% (categoria H por 90%); a parte excluída não pode exceder 2 500 € por categoria.",
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
    id: "damages-treatment",
    jurisdiction: "PT",
    taxYear: null,
    title: "Indemnizações por danos e acordos judiciais",
    legalReference: "CIRS arts. 2.º, 9.º, 10.º, 12.º (a confirmar)",
    description:
      "A tributação depende do que a indemnização repara (perda de rendimentos ou dano não patrimonial) e da redação e fundamento legal do acordo. Não foi verificado nenhum artigo concreto: o resultado é tratado como pressuposto explícito.",
    accessed: "2026-10-07",
    verification: "needs-verification",
    effectiveFrom: "1989-01-01",
    effectiveTo: null,
  },
  {
    id: "accrued-rights",
    jurisdiction: "PT",
    taxYear: null,
    title: "Créditos vencidos são rendimento normal da categoria A",
    legalReference: "CIRS art. 2.º, n.º 1",
    description:
      "Salários em atraso, férias e subsídios de férias e de Natal são remuneração, não indemnização por cessação, e são tributados como rendimentos normais de trabalho dependente. As contribuições para a Segurança Social sobre estes valores não estão modeladas.",
    accessed: "2026-10-07",
    verification: "secondary-source",
    effectiveFrom: "1989-01-01",
    effectiveTo: null,
  },
  {
    id: "lawyer-fees",
    jurisdiction: "PT",
    taxYear: null,
    title: "Honorários de advogado",
    legalReference: "n/a",
    description:
      "Tratados apenas como custo de caixa. Não se afirma que sejam dedutíveis em IRS; essa é uma questão jurídica distinta.",
    accessed: "2026-10-07",
    verification: "needs-verification",
    effectiveFrom: "1989-01-01",
    effectiveTo: null,
  },
];

export const getSource = (id: string): RuleSource | undefined => SOURCES.find((s) => s.id === id);
