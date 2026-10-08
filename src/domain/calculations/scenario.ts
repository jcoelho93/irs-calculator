import { D, ZERO, cents, num, ratio, sum } from "../money";
import type { Parcel, ParcelTreatment } from "../parcels/types";
import { categoryLabel } from "../parcels/types";
import { getTaxRules } from "../rules";
import type { TaxYearRules } from "../rules/types";
import type { Scenario } from "../scenario/types";
import { calculateIrs, hasFiscalDisability } from "../tax/irs";
import { terminationThreshold } from "../tax/termination";
import { computeSeniority } from "./duration";
import { calculateLawyerFee } from "./lawyerFees";
import { isUncertain, treatParcel } from "./treatments";
import type { Assumption, CalculationResult, RiskLevel } from "./types";
import { validateScenario } from "./validation";

const REIMBURSED = new Set(["lawyer_fee_reimbursed", "other_legal_costs_reimbursed"]);

export const effectiveAvgMonthly = (s: Scenario): number =>
  s.employment.avgFromAnnual ? num(D(s.employment.annualGrossSalary).div(12)) : s.employment.avgMonthlyRemuneration;

function assessRisk(treatments: ParcelTreatment[]): CalculationResult["risk"] {
  const live = treatments.filter((t) => t.grossAmount > 0);
  const reasons: string[] = [];
  let level: RiskLevel = "green";
  const bump = (l: RiskLevel) => {
    if (l === "red" || (l === "yellow" && level === "green")) level = l;
  };
  for (const t of live) {
    const name = categoryLabel(t.classification);
    if (t.status === "requires_validation" || t.status === "unknown" || t.confidence === "low") {
      bump("red");
      reasons.push(`${t.grossAmount.toFixed(2)} classified as "${name}": treatment requires professional/legal confirmation.`);
    } else if (t.status === "potentially_excluded" || t.confidence === "medium" || t.overridden) {
      bump("yellow");
      reasons.push(
        t.excludedAmount > 0
          ? `${t.excludedAmount.toFixed(2)} of "${name}" is treated as potentially excluded; this depends on facts and wording.`
          : `"${name}" depends on facts or interpretation.`,
      );
    }
  }
  if (!reasons.length) reasons.push("Treatment is relatively straightforward for the modelled parcels.");
  return { level, reasons };
}

function buildAssumptions(
  s: Scenario,
  rules: TaxYearRules,
  treatments: ParcelTreatment[],
  thresholdKnown: boolean,
): { assumptions: Assumption[]; notModelled: string[] } {
  const a: Assumption[] = [];
  const nm: string[] = [];
  const eur = (n: number) => n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  a.push({ id: "resident", level: "ok", text: "Residente fiscal em Portugal (tabela de taxas do continente)" });
  a.push({ id: "year", level: "ok", text: `Ano fiscal: ${rules.taxYear}` });
  a.push({ id: "termination", level: "ok", text: "Cessação do contrato de trabalho com direito à regra de exclusão do art. 2.º, n.º 4, al. b) do CIRS" });
  a.push({ id: "avg", level: thresholdKnown ? "ok" : "warning", text: thresholdKnown ? `Remuneração média mensal dos últimos 12 meses: ${eur(effectiveAvgMonthly(s))}` : "Faltam as datas ou a remuneração média mensal: o limite isento não foi calculado" });
  a.push({ id: "lawyer", level: "ok", text: `Honorários do advogado: ${s.lawyer.percentage}% do montante, IVA a ${s.lawyer.vatRate}% ${s.lawyer.vatIncluded ? "incluído" : "acrescido"}` });
  a.push({ id: "lawyer-deduct", level: "warning", text: "Os honorários são tratados apenas como custo; não se assume que sejam dedutíveis em IRS" });
  if (hasFiscalDisability(s.tax.disabilityPct, rules))
    a.push({ id: "disability", level: "warning", text: `Incapacidade de ${s.tax.disabilityPct}% considerada fiscalmente relevante (art. 56.º-A: 85% do rendimento, com exclusão máxima de ${eur(rules.disability.maxExcludedPerCategory)}; art. 87.º: dedução de ${rules.disability.taxpayerCreditIasMultiple} × IAS). Exige atestado médico de incapacidade multiuso válido.` });
  else if (s.tax.disabilityPct > 0)
    a.push({ id: "disability", level: "ok", text: `Incapacidade de ${s.tax.disabilityPct}% inferior a ${rules.disability.minIncapacityPct}%: sem tratamento especial` });
  if (rules.terminationIndemnity.excessInclusionRate === 1)
    a.push({ id: "excess", level: "warning", text: "A parte da indemnização acima do limite isento é tributada a 100% (a confirmar)" });
  if (!s.employment.rehiredWithin24Months)
    a.push({ id: "rehire", level: "ok", text: "Sem novo vínculo com a mesma entidade nos 24 meses seguintes" });
  a.push({ id: "gestor", level: "ok", text: "O trabalhador não é gestor, administrador ou gerente (art. 2.º, n.º 4, al. a) não modelado)" });
  if (treatments.some((t) => t.classification === "moral_damages" || t.classification === "material_damages" || t.classification === "litigation_settlement"))
    a.push({ id: "damages", level: "warning", text: "O tratamento fiscal de indemnizações por danos exige validação" });
  a.push({ id: "income", level: "ok", text: `Outros rendimentos de trabalho dependente no ano: ${eur(s.tax.otherAnnualIncome)}` });

  nm.push("Deduções por dependentes, saúde, educação e despesas gerais, e outros créditos de imposto");
  nm.push("Mínimo de existência (art. 70.º do CIRS)");
  nm.push("Contribuições para a Segurança Social sobre salários em atraso, férias e subsídios");
  nm.push("Despesas de acompanhamento e de reabilitação por incapacidade (art. 87.º)");
  if (s.tax.maritalStatus === "married_joint") nm.push("Tributação conjunta (quociente conjugal): estimado como sujeito passivo singular");
  if (s.tax.dependents > 0) nm.push(`${s.tax.dependents} dependente(s): sem deduções por dependentes`);
  for (const n of nm) a.push({ id: `nm-${n.slice(0, 12)}`, level: "not_modelled", text: `Não modelado: ${n}` });
  return { assumptions: a, notModelled: nm };
}

/** Normalise parcels: enabled only, amounts rounded to cents. */
const live = (parcels: Parcel[]): Parcel[] => parcels.filter((p) => p.enabled).map((p) => ({ ...p, amount: num(p.amount) }));

interface Pass {
  treatments: ParcelTreatment[];
  taxable: number;
  excluded: number;
  irsWith: ReturnType<typeof calculateIrs>;
  irsBase: ReturnType<typeof calculateIrs>;
}

function runPass(s: Scenario, rules: TaxYearRules, conservative: boolean, threshold: ReturnType<typeof terminationThreshold>): Pass {
  let remaining = threshold?.threshold ?? 0;
  const treatments: ParcelTreatment[] = [];
  for (const p of live(s.parcels)) {
    const r = treatParcel(p, { rules, threshold, remainingThreshold: remaining, conservative });
    remaining = r.remainingThreshold;
    treatments.push(r.treatment);
  }
  const taxable = num(sum(treatments.map((t) => t.taxableAmount)));
  const excluded = num(sum(treatments.map((t) => t.excludedAmount)));
  const common = { disabilityPct: s.tax.disabilityPct, socialSecurityContributions: s.tax.socialSecurityContributions };
  const irsBase = calculateIrs({ ...common, grossCategoryA: s.tax.otherAnnualIncome }, rules);
  const irsWith = calculateIrs({ ...common, grossCategoryA: num(D(s.tax.otherAnnualIncome).plus(taxable)) }, rules);
  return { treatments, taxable, excluded, irsWith, irsBase };
}

/**
 * Pure, deterministic engine entry point: scenario + rules in, complete result out.
 * `rules` defaults to the registry entry for the scenario's tax year; throws if none exists.
 */
export function calculateScenario(
  scenario: Scenario,
  rules: TaxYearRules = getTaxRules(scenario.tax.taxYear),
  opts: { skipConservative?: boolean } = {},
): CalculationResult {
  const s = scenario;
  const seniority = computeSeniority(s.employment.startDate, s.employment.terminationDate);
  const threshold = terminationThreshold(effectiveAvgMonthly(s), seniority, s.employment.rehiredWithin24Months);

  const main = runPass(s, rules, false, threshold);
  const parcels = live(s.parcels);
  const gross = num(sum(parcels.map((p) => p.amount)));
  const reimbursed = num(sum(parcels.filter((p) => REIMBURSED.has(p.category)).map((p) => p.amount)));
  const lawyerBase = num(D(gross).minus(reimbursed));
  const lawyer = calculateLawyerFee(s.lawyer, lawyerBase);

  const incremental = num(D(main.irsWith.finalIrs).minus(main.irsBase.finalIrs));
  const net = (irs: number) => num(D(gross).minus(irs).minus(lawyer.total).minus(s.otherCosts));
  const netCash = net(incremental);

  let conservative: CalculationResult["conservative"] = null;
  if (!opts.skipConservative && main.treatments.some(isUncertain)) {
    const c = runPass(s, rules, true, threshold);
    const inc = num(D(c.irsWith.finalIrs).minus(c.irsBase.finalIrs));
    conservative = { estimatedIRS: inc, netCash: net(inc) };
  }

  const { assumptions, notModelled } = buildAssumptions(s, rules, main.treatments, threshold !== null);
  const allocated = gross;

  return {
    taxYear: rules.taxYear,
    grossSettlement: gross,
    taxableSettlement: main.taxable,
    excludedSettlement: main.excluded,
    taxableEmploymentIncome: num(D(s.tax.otherAnnualIncome).plus(main.taxable)),
    otherTaxableIncome: s.tax.otherAnnualIncome,
    estimatedIRS: incremental,
    totalIRSWithSettlement: main.irsWith.finalIrs,
    baselineIRS: main.irsBase.finalIrs,
    lawyerFee: lawyer.total,
    lawyer,
    otherCosts: s.otherCosts,
    netCash,
    effectiveTaxRate: ratio(incremental, gross),
    effectiveLawyerCost: ratio(lawyer.total, gross),
    effectiveNetPercentage: ratio(netCash, gross),
    withholdingOnSettlement: s.tax.withholdingOnSettlement,
    withholdingBalance: num(D(incremental).minus(s.tax.withholdingOnSettlement)),
    employerReimbursedLegalCosts: reimbursed,
    allocated,
    unallocated: num(D(s.settlementTotal).minus(allocated)),
    threshold,
    irsDetail: { withSettlement: main.irsWith, baseline: main.irsBase },
    parcels: main.treatments,
    risk: assessRisk(main.treatments),
    assumptions,
    issues: validateScenario(s),
    conservative,
    notModelled,
  };
}

export { ZERO, cents };
