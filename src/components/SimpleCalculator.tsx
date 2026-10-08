import { useEffect, useMemo, useState } from "react";
import { EMPTY_INPUT, calculateSimple, spreadAcrossYears } from "../domain/simple";
import type { SimpleInput } from "../domain/simple";
import { fmtEur, fmtPct } from "../lib/format";
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
  const [otherNext, setOtherNext] = useState(0);
  const set = <K extends keyof SimpleInput>(k: K, v: SimpleInput[K]) => setI((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(i));
    } catch {
      /* ignore */
    }
  }, [i]);

  const r = useMemo(() => calculateSimple(i), [i]);
  const spread = useMemo(() => [0, 0.25, 0.5].map((s) => spreadAcrossYears(i, s, otherNext)), [i, otherNext]);
  const th = r.threshold;
  const ready = i.total > 0;
  const accruedTooHigh = i.accrued > i.total;
  const missingFacts = !th;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="py-5">
        <h1 className="text-lg font-semibold tracking-tight">Termination compensation: tax estimate</h1>
        <p className="text-xs text-stone-500">Portugal, IRS 2026 · estimates only, nothing leaves your browser</p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title="Your numbers">
          <div className="flex flex-col gap-3">
            <Field label="Total compensation you will receive">
              {(id) => <NumberInput id={id} value={i.total} suffix="€" onChange={(v) => set("total", v)} />}
            </Field>
            <Field label="…of which accrued pay you are owed anyway" hint="Unpaid salary, holiday pay, holiday/Christmas allowances: always taxed as normal income. Enter only what you are genuinely owed.">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.accrued} suffix="€" onChange={(v) => set("accrued", v)} />}
            </Field>
            {accruedTooHigh && <p role="alert" className="text-xs text-red-700">Accrued pay cannot exceed the total.</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employment start">{(id) => <TextInput id={id} type="date" value={i.startDate} onChange={(v) => set("startDate", v)} />}</Field>
              <Field label="Last day of work">{(id) => <TextInput id={id} type="date" value={i.endDate} onChange={(v) => set("endDate", v)} />}</Field>
            </div>
            <Field label="Average monthly gross pay (last 12 months)" hint="Include holiday and Christmas allowances, divided by 12.">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.avgMonthlyPay} suffix="€" onChange={(v) => set("avgMonthlyPay", v)} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Disability degree" hint="60% or more has special treatment.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.disabilityPct} suffix="%" min={0} onChange={(v) => set("disabilityPct", Math.min(100, Math.max(0, v)))} />}
              </Field>
              <Field label="Lawyer fee (VAT incl.)">
                {(id) => <NumberInput id={id} value={i.lawyerPct} suffix="%" step={0.5} min={0} onChange={(v) => set("lawyerPct", Math.min(100, Math.max(0, v)))} />}
              </Field>
            </div>
            <Field label="Other taxable income this year" hint="Salary already earned this year, before the payment.">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.otherIncome} suffix="€" onChange={(v) => set("otherIncome", v)} />}
            </Field>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Estimate">
            {!ready ? (
              <p className="text-sm text-stone-500">Enter the total compensation to see the estimate.</p>
            ) : (
              <>
                <dl aria-label="Summary" className="num text-sm">
                  <Line label="Total received" value={fmtEur(r.grossSettlement)} />
                  <Line label="Tax-free part" value={fmtEur(r.excludedSettlement)} />
                  <Line label="Taxed part" value={fmtEur(r.taxableSettlement)} />
                  <Line label="Estimated IRS" value={`− ${fmtEur(r.estimatedIRS)}`} />
                  <Line label="Lawyer" value={`− ${fmtEur(r.lawyerFee)}`} />
                  <Line label="You keep" value={fmtEur(r.netCash)} strong />
                </dl>
                <p className="num mt-2 text-xs text-stone-500">{fmtPct(r.effectiveTaxRate)} of the total goes to IRS · you keep {fmtPct(r.effectiveNetPercentage)}</p>
                {missingFacts && (
                  <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Add your dates and average monthly pay to compute the tax-free amount. Until then nothing is treated as tax-free.
                  </p>
                )}
                {th && (
                  <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700">
                    Tax-free limit for termination compensation: <b className="num">{fmtEur(th.threshold)}</b> ({fmtEur(th.avgMonthlyRemuneration)} × {th.years} year{th.years === 1 ? "" : "s"} or fraction of service). Anything above it is taxed as income.
                  </p>
                )}
                {r.risk.level !== "green" && r.parcels.length > 0 && (
                  <p className="mt-2 text-xs text-stone-500">Confidence: {r.risk.level === "yellow" ? "medium" : "low"}. {r.risk.reasons[0]}</p>
                )}
              </>
            )}
          </Card>

          {ready && (
            <Card title="Does the timing of payment matter?">
              <p className="text-xs text-stone-600">
                IRS rates rise with income, so receiving the taxed part in two tax years can lower the total. This only applies if the agreement genuinely pays in instalments across years; it assumes the same rules apply next year.
              </p>
              <div className="mt-3 w-56"><Field label="Other taxable income next year">{(id) => <NumberInput id={id} value={otherNext} suffix="€" onChange={setOtherNext} />}</Field></div>
              <table className="num mt-3 w-full text-sm">
                <thead><tr className="border-b border-stone-200 text-right text-stone-500"><th className="py-1 text-left font-medium">Taxed part paid</th><th className="font-medium">IRS</th><th className="font-medium">You keep</th></tr></thead>
                <tbody>
                  {spread.map((s) => (
                    <tr key={s.shareNextYear} className="border-b border-stone-100 text-right">
                      <td className="py-1.5 text-left">{s.shareNextYear === 0 ? "All this year" : `${s.shareNextYear * 100}% next year`}</td>
                      <td>{fmtEur(s.estimatedIRS)}</td>
                      <td className="font-semibold">{fmtEur(s.netCash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card title="What drives the tax">
            <ul className="list-disc pl-4 text-sm text-stone-700">
              <li>Genuine termination compensation is tax-free up to the limit above; the excess is taxed.</li>
              <li>Accrued pay (arrears, holiday pay, allowances) is always taxed. While the termination part stays above the limit, the split between the two does not change your tax: only the total above the limit is taxed.</li>
              <li>The split must match what the agreement and the law actually say. Re-labelling payments is not an option, and a lawyer should confirm the wording, especially for any damages.</li>
              <li>Lawyer fees are treated as a cost only, not as tax deductible.</li>
            </ul>
          </Card>
        </div>
      </div>

      <details className="mt-6 rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">Assumptions, what is not modelled, and sources</summary>
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
    <div className={`flex justify-between gap-3 py-1 ${strong ? "mt-1 border-t border-stone-300 pt-2 text-lg font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-stone-600"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
