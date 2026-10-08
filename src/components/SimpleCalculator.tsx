import { useEffect, useMemo, useState } from "react";
import { EMPTY_INPUT, calculateSimple } from "../domain/simple";
import type { SimpleInput } from "../domain/simple";
import { fmtEur } from "../lib/format";
import { SourcesPanel } from "./SourcesPanel";
import { Card, Disclaimer, Field, NumberInput, TextInput } from "./ui";

const KEY = "irs-simple-inputs";

function load(): SimpleInput {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY_INPUT, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable or corrupt: start blank */
  }
  return EMPTY_INPUT;
}

export default function SimpleCalculator() {
  const [i, setI] = useState<SimpleInput>(load);
  const [refineOpen] = useState(() => i.disabilityPct > 0 || i.catBGross > 0 || i.accrued > 0 || i.lawyerVatExcluded);
  const set = <K extends keyof SimpleInput>(k: K, v: SimpleInput[K]) => setI((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(i));
    } catch {
      /* ignore */
    }
  }, [i]);

  const r = useMemo(() => calculateSimple(i), [i]);
  const th = r.threshold;
  const ready = i.total > 0;
  const bInvalid = i.catBTaxable > i.catBGross;
  const datesInverted = !!i.startDate && !!i.endDate && i.endDate < i.startDate;
  const pct = (v: number) => Math.min(100, Math.max(0, v));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="py-5">
        <h1 className="text-lg font-semibold tracking-tight">Indemnização por cessação do contrato: estimativa de IRS</h1>
        <p className="text-xs text-stone-500">Portugal, IRS 2026 · apenas estimativas · nenhum dado sai do seu navegador</p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title="Os seus dados">
          <div className="flex flex-col gap-3">
            <Field label="Valor da indemnização (bruto)">
              {(id) => <NumberInput id={id} value={i.total} suffix="€" onChange={(v) => set("total", Math.max(0, v))} />}
            </Field>
            <Field label="Rendimento mensal bruto médio, últimos 12 meses" hint="Inclua os subsídios de férias e de Natal se forem pagos à parte (total dos últimos 12 meses ÷ 12). Define o limite isento de imposto.">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.avgMonthlyPay} suffix="€" onChange={(v) => set("avgMonthlyPay", Math.max(0, v))} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início do contrato">{(id) => <TextInput id={id} type="date" value={i.startDate} onChange={(v) => set("startDate", v)} />}</Field>
              <Field label="Fim do contrato">{(id) => <TextInput id={id} type="date" value={i.endDate} onChange={(v) => set("endDate", v)} />}</Field>
            </div>
            {datesInverted && <p role="alert" className="text-xs text-red-700">A data de fim é anterior à data de início.</p>}
            <Field label="Rendimento de trabalho dependente previsto este ano, categoria A (sem a indemnização)" hint="Salário bruto auferido este ano antes e depois da cessação. A indemnização é tributada por cima deste valor, por isso determina os escalões de IRS aplicáveis. Os rendimentos de trabalhador independente indicam-se em «Refinar a estimativa».">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.otherIncome} suffix="€" onChange={(v) => set("otherIncome", Math.max(0, v))} />}
            </Field>
            <Field label="Honorários do advogado (% da indemnização)">
              {(id) => <NumberInput id={id} value={i.lawyerPct} suffix="%" step={0.5} onChange={(v) => set("lawyerPct", pct(v))} />}
            </Field>
          </div>

          <details open={refineOpen} className="mt-4 rounded-md border border-stone-200 bg-stone-50/60 p-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-800">Refinar a estimativa (opcional)</summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Grau de incapacidade" hint="60% ou mais tem tratamento especial em IRS, que reduz o imposto. A exclusão aplica-se separadamente às categorias A e B.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.disabilityPct} suffix="%" onChange={(v) => set("disabilityPct", pct(v))} />}
              </Field>
              <Field label="Rendimento bruto de trabalhador independente este ano (categoria B)" hint="Total faturado no ano. Tem o seu próprio limite de exclusão por incapacidade.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.catBGross} suffix="€" onChange={(v) => set("catBGross", Math.max(0, v))} />}
              </Field>
              {i.catBGross > 0 && (
                <Field label="Desse rendimento, o valor tributável após o regime" hint="Rendimento de categoria B depois do coeficiente do regime simplificado (ou o lucro, em contabilidade organizada), antes da exclusão por incapacidade. Consulte a sua declaração anterior ou o contabilista. A categoria B não tem a dedução específica de 4 587,09 €.">
                  {(id, d) => <NumberInput id={id} describedBy={d} value={i.catBTaxable} suffix="€" onChange={(v) => set("catBTaxable", Math.max(0, v))} />}
                </Field>
              )}
              {bInvalid && <p role="alert" className="text-xs text-red-700">O valor tributável não pode exceder o rendimento bruto.</p>}
              <Field label="Parte da indemnização que são créditos vencidos" hint="Salários em atraso, férias, subsídios: são sempre tributados como rendimento normal. Deixe a 0 se tudo for indemnização por cessação.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.accrued} suffix="€" onChange={(v) => set("accrued", Math.max(0, Math.min(v, i.total)))} />}
              </Field>
              <label className="flex items-start gap-2 text-xs text-stone-700">
                <input type="checkbox" className="mt-0.5" checked={i.lawyerVatExcluded} onChange={(e) => set("lawyerVatExcluded", e.target.checked)} />
                <span>A percentagem do meu advogado não inclui IVA (acresce 23%)</span>
              </label>
            </div>
          </details>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Estimativa">
            {!ready ? (
              <p className="text-sm text-stone-500">Indique o valor da indemnização para ver a estimativa.</p>
            ) : (
              <>
                <dl aria-label="Estimativa da indemnização" className="num text-sm">
                  <Line label="Indemnização total" value={fmtEur(r.grossSettlement)} strong />
                  <Line label="Parte isenta de imposto" value={fmtEur(r.excludedSettlement)} />
                  <Line label="Parte tributável" value={fmtEur(r.taxableSettlement)} />
                  <div className="my-2 border-t border-stone-200" />
                  <Line label="IRS estimado sobre a indemnização" value={`− ${fmtEur(r.estimatedIRS)}`} />
                  <Line label="Indemnização líquida estimada" value={fmtEur(r.grossSettlement - r.estimatedIRS)} strong />
                  <Line label={`Honorários do advogado${i.lawyerVatExcluded ? " (com 23% de IVA)" : ""}`} value={`− ${fmtEur(r.lawyerFee)}`} />
                  <Line label="Líquido após honorários do advogado" value={fmtEur(r.netCash)} strong />
                </dl>
                {!th && (
                  <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Indique as datas e o rendimento mensal médio para calcular a parte isenta. Até lá, nada é tratado como isento.
                  </p>
                )}
                {th && (
                  <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700">
                    Limite isento: <b className="num">{fmtEur(th.threshold)}</b> = {fmtEur(th.avgMonthlyRemuneration)} × {th.years} {th.years === 1 ? "ano" : "anos"} (um ano iniciado conta como ano completo). A indemnização acima deste limite é tributada como rendimento.
                  </p>
                )}
                <p className="mt-2 text-xs text-stone-500">
                  O IRS é o imposto final estimado na declaração anual. A retenção na fonte feita no pagamento pode ser diferente. Assume que toda a indemnização é por cessação do contrato, a menos que indique créditos vencidos.
                </p>
              </>
            )}
          </Card>

          <Card title="Como interpretar">
            <ul className="list-disc pl-4 text-sm text-stone-700">
              <li>O limite isento aplica-se à indemnização genuína por cessação, com base na sua remuneração média e nos anos de antiguidade.</li>
              <li>A repartição tem de refletir o que o acordo e a lei realmente dizem. Mudar a designação dos pagamentos não é forma de alterar o imposto.</li>
              <li>Os honorários do advogado são tratados apenas como custo, não como dedutíveis em IRS.</li>
            </ul>
          </Card>
        </div>
      </div>

      <details className="mt-6 rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">Pressupostos, o que não está modelado e fontes</summary>
        <ul className="mt-3 list-disc pl-4 text-stone-700">
          {r.assumptions.map((a) => <li key={a.id}>{a.text}</li>)}
        </ul>
        <div className="mt-4"><SourcesPanel /></div>
      </details>
      <footer className="mt-6"><Disclaimer /></footer>
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
