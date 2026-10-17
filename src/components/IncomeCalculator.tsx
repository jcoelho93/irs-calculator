import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_INPUT, calculateIncome } from "../domain/income";
import type { IncomeInput, PayPeriod } from "../domain/income";
import { getTaxRules, supportedTaxYears } from "../domain/rules";
import type { Bracket } from "../domain/rules/types";
import { InvalidFileError, parseSavedFile, sanitizeInput, serializeInput } from "../domain/file";
import { NotALiquidacaoError, parseLiquidacao, patchFromLiquidacao } from "../domain/liquidacao";
import { download, fmtEur, fmtPct } from "../lib/format";
import { NotAModelo3Error, parseModelo3, patchFromModelo3 } from "../domain/modelo3";
import { pdfToPages } from "../lib/pdfText";
import { SourcesPanel } from "./SourcesPanel";
import { Card, Disclaimer, Field, NumberInput, Select } from "./ui";

const KEY = "irs-income-inputs";

function load(): IncomeInput {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitizeInput(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt: start blank */
  }
  return DEFAULT_INPUT;
}

const PERIODS: { id: PayPeriod; label: string }[] = [
  { id: "monthly14", label: "Mensal × 14" },
  { id: "monthly12", label: "Mensal × 12" },
  { id: "annual", label: "Anual" },
];

const ADVANCED_KEYS = [
  "irsJovemYear",
  "municipalBenefit",
  "disabilityPct",
  "selfEmployedCoefficient",
  "employeeSsRate",
  "selfEmployedSsRate",
  "selfEmployedSsBase",
  "specificDeduction",
  "brackets",
  "solidarity",
  "withholding",
] as const;

const btnCls = "rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50";

/** Percent helpers: the engine works in fractions, the inputs in %. */
const toPct = (f: number) => Math.round(f * 10000) / 100;
const fromPct = (p: number) => Math.min(100, Math.max(0, p)) / 100;

export default function IncomeCalculator() {
  const [i, setI] = useState<IncomeInput>(load);
  const [fileMsg, setFileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof IncomeInput>(k: K, v: IncomeInput[K]) => setI((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(i));
    } catch {
      /* ignore */
    }
  }, [i]);

  const base = getTaxRules(i.taxYear);
  const exportFile = () => {
    download(`irs-calculadora-${new Date().toISOString().slice(0, 10)}.json`, serializeInput(i));
    setFileMsg(null);
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pages = await pdfToPages(await file.arrayBuffer());
        if (/Demonstra[çc][ãa]o de Liquida[çc][ãa]o de IRS/i.test(pages.join("\n"))) importLiquidacao(pages);
        else importModelo3(pages);
      } else {
        setI(parseSavedFile(await file.text()));
        setFileMsg({ ok: true, text: `Dados importados de ${file.name}.` });
      }
    } catch (e) {
      if (!(e instanceof Error) || e.constructor === Error) console.error(e);
      const known = e instanceof InvalidFileError || e instanceof NotALiquidacaoError || e instanceof NotAModelo3Error;
      setFileMsg({ ok: false, text: known ? e.message : "Não foi possível ler o ficheiro." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  /** Fills deductions, disability, benefício municipal and IRS Jovem from last year's assessment. */
  const importLiquidacao = (pages: string[]) => {
    const liq = parseLiquidacao(pages.join("\n"));
    const p = patchFromLiquidacao(liq, i.taxYear);
    setI((x) => ({
      ...x,
      taxDeductions: p.taxDeductions,
      municipalBenefit: p.municipalBenefit,
      irsJovemYear: p.irsJovemYear,
      disabilityPct: p.hasDisability ? Math.max(x.disabilityPct, 60) : x.disabilityPct,
    }));
    const parts = [
      `deduções à coleta ${fmtEur(p.taxDeductions, true)}${p.hasDisability ? " (sem a dedução por deficiência, que a calculadora aplica)" : ""}`,
      `benefício municipal ${toPct(p.municipalBenefit)}%`,
      p.irsJovemYear ? `IRS Jovem ${p.irsJovemYear}.º ano em ${i.taxYear}` : "sem IRS Jovem",
      ...(p.hasDisability ? ["incapacidade de 60% ou mais"] : []),
    ];
    setFileMsg({ ok: true, text: `Da nota de liquidação${liq.year ? ` de ${liq.year}` : ""}: ${parts.join(", ")}. Para os rendimentos, importe a declaração Modelo 3.` });
  };
  /** Fills last year's Category A and B income from the Modelo 3 declaration. */
  const importModelo3 = (pages: string[]) => {
    const m = parseModelo3(pages);
    const p = patchFromModelo3(m);
    setI((x) => ({
      ...x,
      employment: p.employment,
      employmentPeriod: "annual",
      employeeSsRate: p.employeeSsRate,
      selfEmployed: p.selfEmployed,
      selfEmployedCoefficient: p.selfEmployedCoefficient === base.categoryBCoefficients[0].coefficient ? null : p.selfEmployedCoefficient,
    }));
    const parts = [
      `categoria A ${fmtEur(p.employment, true)} por ano`,
      ...(p.employeeSsRate !== null ? [`Segurança Social de ${toPct(p.employeeSsRate)}% (contribuições declaradas)`] : []),
      `categoria B ${fmtEur(p.selfEmployed, true)}`,
      ...(p.selfEmployedCoefficient !== null ? [`coeficiente ${toPct(p.selfEmployedCoefficient)}%`] : []),
    ];
    const skipped = p.skippedCodes.length ? ` Códigos do anexo B não importados: ${p.skippedCodes.join(", ")}.` : "";
    setFileMsg({ ok: true, text: `Da declaração Modelo 3${m.year ? ` de ${m.year}` : ""}: ${parts.join(", ")}. Ajuste se este ano for diferente.${skipped}` });
  };

  const r = useMemo(() => calculateIncome(i), [i]);
  const ready = r.grossTotal > 0;
  const hasOther = r.grossOtherTaxable > 0 || r.grossOtherExempt > 0;
  const changed = ADVANCED_KEYS.filter((k) => JSON.stringify(i[k]) !== JSON.stringify(DEFAULT_INPUT[k])).length;
  const resetAdvanced = () => setI((x) => ({ ...x, ...Object.fromEntries(ADVANCED_KEYS.map((k) => [k, DEFAULT_INPUT[k]])) }));
  const coefPreset = base.categoryBCoefficients.find((c) => c.coefficient === r.selfEmployedCoefficient)?.id ?? "custom";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3 py-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Calculadora de rendimento líquido e IRS</h1>
          <p className="text-xs text-stone-500">Portugal, IRS {i.taxYear} · apenas estimativas · nenhum dado sai do seu navegador</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportFile} className={btnCls} title="Guardar os dados num ficheiro">Exportar</button>
          <button type="button" onClick={() => fileRef.current?.click()} className={btnCls} title="Carregar um ficheiro exportado, a declaração Modelo 3 ou a nota de liquidação do ano passado (PDF)">Importar</button>
          <input ref={fileRef} type="file" accept="application/json,.json,application/pdf,.pdf" className="hidden" aria-label="Ficheiro a importar" onChange={(e) => importFile(e.target.files?.[0])} />
        </div>
      </header>
      {fileMsg && (
        <p role={fileMsg.ok ? "status" : "alert"} className={`mb-4 rounded-md px-3 py-2 text-xs ${fileMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {fileMsg.text}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <Card title="Os seus rendimentos">
            <div className="flex flex-col gap-3">
              <Field label="Trabalho por conta de outrem (categoria A), bruto" hint="Salário bruto antes de impostos e descontos. Pode importar a declaração Modelo 3 do ano passado (botão Importar).">
                {(id, d) => (
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1"><NumberInput id={id} describedBy={d} value={i.employment} suffix="€" onChange={(v) => set("employment", Math.max(0, v))} /></div>
                    <Select ariaLabel="Período" value={i.employmentPeriod} onChange={(v) => set("employmentPeriod", v as PayPeriod)} options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />
                  </div>
                )}
              </Field>
              <Field label="Trabalho independente (categoria B), bruto anual" hint="Total faturado no ano em recibos verdes, regime simplificado.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.selfEmployed} suffix="€" onChange={(v) => set("selfEmployed", Math.max(0, v))} />}
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Outros rendimentos tributáveis" hint="Valor pontual no ano que paga IRS mas não Segurança Social. É somado à categoria A.">
                  {(id, d) => <NumberInput id={id} describedBy={d} value={i.otherTaxable} suffix="€" onChange={(v) => set("otherTaxable", Math.max(0, v))} />}
                </Field>
                <Field label="Rendimentos não tributáveis" hint="Valor no ano que não paga IRS nem Segurança Social.">
                  {(id, d) => <NumberInput id={id} describedBy={d} value={i.otherExempt} suffix="€" onChange={(v) => set("otherExempt", Math.max(0, v))} />}
                </Field>
              </div>
              <Field label="Deduções à coleta" hint="Despesas gerais, saúde, educação, habitação, dependentes, IVA de faturas. Se ainda não sabe, importe a nota de liquidação do ano passado (botão Importar).">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.taxDeductions} suffix="€" onChange={(v) => set("taxDeductions", Math.max(0, v))} />}
              </Field>
            </div>
          </Card>

          <details className="min-w-0 rounded-lg border border-stone-200 bg-white">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold tracking-tight text-stone-800">
              Opções avançadas {changed > 0 && <span className="ml-1 text-xs font-normal text-blue-700">({changed} alterada{changed > 1 ? "s" : ""})</span>}
            </summary>
            <div className="flex flex-col gap-3 border-t border-stone-100 p-4">
              {changed > 0 && (
                <button type="button" onClick={resetAdvanced} className="self-start text-xs text-blue-700 underline">Repor valores predefinidos</button>
              )}
              {supportedTaxYears().length > 1 && (
                <Field label="Ano fiscal">
                  {(id) => <Select id={id} value={String(i.taxYear)} onChange={(v) => set("taxYear", Number(v))} options={supportedTaxYears().map((y) => ({ value: String(y), label: String(y) }))} />}
                </Field>
              )}
              <Field label="IRS Jovem: ano do benefício" hint="Conte desde o primeiro ano com rendimentos após os estudos (até aos 35 anos). Isenta 100% no 1.º ano, 75% do 2.º ao 4.º, 50% do 5.º ao 7.º e 25% do 8.º ao 10.º.">
                {(id, d) => (
                  <Select
                    id={id}
                    describedBy={d}
                    value={String(i.irsJovemYear)}
                    onChange={(v) => set("irsJovemYear", Number(v))}
                    options={[{ value: "0", label: "Não se aplica" }, ...base.irsJovem.exemptShareByYear.map((sh, k) => ({ value: String(k + 1), label: `${k + 1}.º ano (${toPct(sh)}% isento)` }))]}
                  />
                )}
              </Field>
              <Field label="Benefício municipal" hint={`Parte do IRS que o seu município devolve, de 0% a ${toPct(base.maxMunicipalBenefit)}%. Está na linha 20 da nota de liquidação.`}>
                {(id, d) => <NumberInput id={id} describedBy={d} step={0.5} value={toPct(i.municipalBenefit)} suffix="%" onChange={(v) => set("municipalBenefit", Math.min(fromPct(v), base.maxMunicipalBenefit))} />}
              </Field>
              <Field label="IRS retido na fonte durante o ano" hint="Para ver se recebe reembolso ou tem de pagar na declaração.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.withholding} suffix="€" onChange={(v) => set("withholding", Math.max(0, v))} />}
              </Field>
              <Field label="Grau de incapacidade" hint="60% ou mais reduz o rendimento considerado (art. 56.º-A) e dá uma dedução à coleta (art. 87.º).">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.disabilityPct} suffix="%" onChange={(v) => set("disabilityPct", Math.min(100, Math.max(0, v)))} />}
              </Field>

              <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Trabalho independente</h3>
              <Field label="Atividade (coeficiente do regime simplificado)">
                {(id) => (
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        id={id}
                        value={coefPreset}
                        onChange={(v) => {
                          const p = base.categoryBCoefficients.find((c) => c.id === v);
                          if (p) set("selfEmployedCoefficient", p === base.categoryBCoefficients[0] ? null : p.coefficient);
                        }}
                        options={[
                          ...base.categoryBCoefficients.map((c) => ({ value: c.id, label: `${c.label} (${toPct(c.coefficient)}%)` })),
                          ...(coefPreset === "custom" ? [{ value: "custom", label: "Personalizado" }] : []),
                        ]}
                      />
                    </div>
                    <div className="w-24"><NumberInput ariaLabel="Coeficiente" value={toPct(r.selfEmployedCoefficient)} suffix="%" onChange={(v) => set("selfEmployedCoefficient", fromPct(v))} /></div>
                  </div>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Taxa de Segurança Social" hint="0% no primeiro ano de atividade.">
                  {(id, d) => <NumberInput id={id} describedBy={d} step={0.1} value={toPct(i.selfEmployedSsRate ?? base.socialSecurity.selfEmployedRate)} suffix="%" onChange={(v) => set("selfEmployedSsRate", fromPct(v))} />}
                </Field>
                <Field label="Base de incidência" hint="70% em serviços, 20% em vendas.">
                  {(id, d) => <NumberInput id={id} describedBy={d} value={toPct(i.selfEmployedSsBase ?? base.socialSecurity.selfEmployedBase)} suffix="%" onChange={(v) => set("selfEmployedSsBase", fromPct(v))} />}
                </Field>
              </div>

              <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Trabalho por conta de outrem</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Taxa de Segurança Social">
                  {(id) => <NumberInput id={id} step={0.1} value={toPct(i.employeeSsRate ?? base.socialSecurity.employeeRate)} suffix="%" onChange={(v) => set("employeeSsRate", fromPct(v))} />}
                </Field>
                <Field label="Dedução específica">
                  {(id) => <NumberInput id={id} value={i.specificDeduction ?? base.specificDeductionCatA} suffix="€" onChange={(v) => set("specificDeduction", Math.max(0, v))} />}
                </Field>
              </div>

              <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Tabela de IRS</h3>
              <BracketsEditor value={i.brackets ?? base.brackets} onChange={(b) => set("brackets", b)} />
              <label className="flex items-start gap-2 text-xs text-stone-700">
                <input type="checkbox" className="mt-0.5" checked={i.solidarity} onChange={(e) => set("solidarity", e.target.checked)} />
                <span>Aplicar a taxa adicional de solidariedade (acima de 80 000 € coletáveis)</span>
              </label>
            </div>
          </details>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Estimativa anual">
            {!ready ? (
              <p className="text-sm text-stone-500">Indique os seus rendimentos para ver a estimativa.</p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <Stat label="Líquido por ano" value={fmtEur(r.netAnnual)} />
                  <Stat label={`Líquido por mês (× ${r.monthsPerYear})${hasOther ? ", sem outros rendimentos" : ""}`} value={fmtEur(r.netPerMonth)} />
                </div>
                <dl aria-label="Estimativa anual" className="num text-sm">
                  {r.grossEmployment > 0 && <Line label="Bruto, categoria A" value={fmtEur(r.grossEmployment)} />}
                  {r.grossSelfEmployed > 0 && <Line label="Bruto, categoria B" value={fmtEur(r.grossSelfEmployed)} />}
                  {r.grossOtherTaxable > 0 && <Line label="Outros rendimentos tributáveis" value={fmtEur(r.grossOtherTaxable)} />}
                  {r.grossOtherExempt > 0 && <Line label="Rendimentos não tributáveis" value={fmtEur(r.grossOtherExempt)} />}
                  <Line label="Rendimento bruto" value={fmtEur(r.grossTotal)} strong />
                  <Line label="Segurança Social" value={`− ${fmtEur(r.socialSecurity)}`} />
                  <Line label="IRS" value={`− ${fmtEur(r.irs.finalIrs)}`} />
                  <Line label="Rendimento líquido" value={fmtEur(r.netAnnual)} strong />
                  {hasOther && <Line label="dos quais outros rendimentos, após IRS" value={fmtEur(r.otherNet)} />}
                  <div className="my-2 border-t border-stone-200" />
                  <Line label="Taxa efetiva de IRS, sobre o bruto" value={fmtPct(r.effectiveIrsRate)} />
                  <Line label="Taxa efetiva de tributação, como na nota de liquidação" value={fmtPct(r.assessmentRate)} />
                  <Line label="Taxa efetiva total (IRS + SS)" value={fmtPct(r.effectiveTotalRate)} />
                  <Line label="Taxa marginal de IRS" value={fmtPct(r.irs.marginalRate)} />
                  {i.withholding > 0 && (
                    <Line label={r.withholdingBalance >= 0 ? "A pagar na declaração" : "Reembolso estimado"} value={fmtEur(Math.abs(r.withholdingBalance))} strong />
                  )}
                </dl>
              </>
            )}
          </Card>

          {ready && (
            <details className="rounded-lg border border-stone-200 bg-white text-sm">
              <summary className="cursor-pointer px-4 py-2.5 font-semibold tracking-tight text-stone-800">Como foi calculado o IRS</summary>
              <dl className="num border-t border-stone-100 p-4">
                {r.grossEmployment > 0 && <Line label="Categoria A" value={fmtEur(r.grossEmployment, true)} />}
                {r.grossOtherTaxable > 0 && <Line label="Outros rendimentos tributáveis (com a categoria A)" value={`+ ${fmtEur(r.grossOtherTaxable, true)}`} />}
                {r.irs.disabilityExclusionA > 0 && <Line label="Exclusão por incapacidade (A)" value={`− ${fmtEur(r.irs.disabilityExclusionA, true)}`} />}
                {r.irs.irsJovemExemptA > 0 && <Line label="Isento por IRS Jovem (A)" value={`− ${fmtEur(r.irs.irsJovemExemptA, true)}`} />}
                {r.irs.grossCategoryA > 0 && <Line label="Dedução específica" value={`− ${fmtEur(r.irs.specificDeduction, true)}`} />}
                {r.irs.disabilityExclusionB > 0 && <Line label="Exclusão por incapacidade (B)" value={`− ${fmtEur(r.irs.disabilityExclusionB, true)}`} />}
                {r.irs.irsJovemExemptB > 0 && <Line label="Isento por IRS Jovem (B)" value={`− ${fmtEur(r.irs.irsJovemExemptB, true)}`} />}
                {r.grossSelfEmployed > 0 && <Line label={`Categoria B tributável (${toPct(r.selfEmployedCoefficient)}%)`} value={fmtEur(r.irs.taxableCategoryB, true)} />}
                <Line label="Rendimento coletável" value={fmtEur(r.irs.taxableIncome, true)} strong />
                {r.irs.irsJovemExempt > 0 && <Line label="Taxa determinada sobre coletável + isento" value={fmtEur(r.irs.taxableIncome + r.irs.irsJovemExempt, true)} />}
                <Line label="Coleta (aplicação da tabela)" value={fmtEur(r.irs.bracketTax, true)} />
                {r.irs.solidaritySurcharge > 0 && <Line label="Taxa adicional de solidariedade" value={`+ ${fmtEur(r.irs.solidaritySurcharge, true)}`} />}
                {r.irs.disabilityCredit > 0 && <Line label="Dedução por incapacidade" value={`− ${fmtEur(r.irs.disabilityCredit, true)}`} />}
                {r.irs.otherDeductions > 0 && <Line label="Deduções à coleta" value={`− ${fmtEur(r.irs.otherDeductions, true)}`} />}
                {r.irs.municipalBenefit > 0 && <Line label="Benefício municipal" value={`− ${fmtEur(r.irs.municipalBenefit, true)}`} />}
                <Line label="IRS final" value={fmtEur(r.irs.finalIrs, true)} strong />
              </dl>
              {i.taxDeductions > r.irs.otherDeductions && (
                <p className="px-4 pb-4 text-xs text-stone-500">Parte das deduções à coleta não foi usada porque excede o imposto.</p>
              )}
            </details>
          )}
        </div>
      </div>

      <details className="mt-6 rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">Pressupostos, o que não está modelado e fontes</summary>
        <ul className="mt-3 list-disc pl-4 text-stone-700">
          <li>Sujeito passivo único, tributação separada, residente no Continente.</li>
          <li>A taxa efetiva sobre o bruto divide o IRS por todo o rendimento indicado. A da nota de liquidação divide-o pelo rendimento coletável mais o rendimento isento pelo IRS Jovem, ou seja, depois da dedução específica e do coeficiente da categoria B, por isso é mais alta.</li>
          <li>O IRS é o imposto final estimado na declaração anual. A retenção na fonte mensal pode ser diferente.</li>
          <li>As deduções à coleta são aplicadas como um total, sem os limites globais do art. 78.º para rendimentos mais altos.</li>
          <li>A Segurança Social do trabalhador independente é calculada sobre o ano, sem base mínima nem limite máximo.</li>
          <li>IRS Jovem: as condições de elegibilidade (idade, estudos concluídos) não são verificadas.</li>
          <li>Não modelado: mínimo de existência, tributação conjunta, contabilidade organizada, outras categorias de rendimento, regiões autónomas.</li>
        </ul>
        <div className="mt-4"><SourcesPanel /></div>
      </details>
      <footer className="mt-6"><Disclaimer /></footer>
    </div>
  );
}

function BracketsEditor({ value, onChange }: { value: Bracket[]; onChange: (b: Bracket[]) => void }) {
  const update = (idx: number, patch: Partial<Bracket>) => onChange(value.map((b, j) => (j === idx ? { ...b, ...patch } : b)));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[1fr_6rem_1.5rem] gap-2 text-xs text-stone-500">
        <span>Rendimento coletável até</span>
        <span>Taxa</span>
        <span />
      </div>
      {value.map((b, idx) => {
        const last = idx === value.length - 1;
        return (
          <div key={idx} className="grid grid-cols-[1fr_6rem_1.5rem] items-center gap-2">
            {last ? (
              <span className="px-2.5 text-sm text-stone-500">sem limite</span>
            ) : (
              <NumberInput ariaLabel={`Limite do escalão ${idx + 1}`} value={b.upTo ?? 0} suffix="€" onChange={(v) => update(idx, { upTo: Math.max(0, v) })} />
            )}
            <NumberInput ariaLabel={`Taxa do escalão ${idx + 1}`} step={0.1} value={toPct(b.rate)} suffix="%" onChange={(v) => update(idx, { rate: fromPct(v) })} />
            {value.length > 1 ? (
              <button
                type="button"
                aria-label={`Remover escalão ${idx + 1}`}
                className="text-stone-400 hover:text-red-700"
                onClick={() => {
                  const next = value.filter((_, j) => j !== idx);
                  next[next.length - 1] = { ...next[next.length - 1], upTo: null };
                  onChange(next);
                }}
              >
                ×
              </button>
            ) : <span />}
          </div>
        );
      })}
      <button
        type="button"
        className="self-start text-xs text-blue-700 underline"
        onClick={() => {
          const prev = value.length > 1 ? value[value.length - 2].upTo ?? 0 : 0;
          const lastRate = value[value.length - 1].rate;
          onChange([...value.slice(0, -1), { upTo: prev + 10000, rate: lastRate }, { upTo: null, rate: lastRate }]);
        }}
      >
        Adicionar escalão
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 px-3 py-2">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="num text-xl font-semibold">{value}</div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-stone-600"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
