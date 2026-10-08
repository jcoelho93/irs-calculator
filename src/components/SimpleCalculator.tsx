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
  const datesInverted = !!i.startDate && !!i.endDate && i.endDate < i.startDate;
  const pct = (v: number) => Math.min(100, Math.max(0, v));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="py-5">
        <h1 className="text-lg font-semibold tracking-tight">Termination compensation: tax estimate</h1>
        <p className="text-xs text-stone-500">Portugal, IRS 2026 · estimates only · nothing leaves your browser</p>
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title="Your numbers">
          <div className="flex flex-col gap-3">
            <Field label="Settlement amount (gross)">
              {(id) => <NumberInput id={id} value={i.total} suffix="€" onChange={(v) => set("total", Math.max(0, v))} />}
            </Field>
            <Field label="Average monthly gross income, last 12 months" hint="Include holiday and Christmas allowances if they are paid separately (total of the last 12 months ÷ 12). Sets the tax-free limit.">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.avgMonthlyPay} suffix="€" onChange={(v) => set("avgMonthlyPay", Math.max(0, v))} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Employment start">{(id) => <TextInput id={id} type="date" value={i.startDate} onChange={(v) => set("startDate", v)} />}</Field>
              <Field label="Employment end">{(id) => <TextInput id={id} type="date" value={i.endDate} onChange={(v) => set("endDate", v)} />}</Field>
            </div>
            {datesInverted && <p role="alert" className="text-xs text-red-700">The end date is before the start date.</p>}
            <Field label="Expected taxable income this year (excl. settlement)" hint="Gross salary earned this year before and after the termination, plus any other employment income. The settlement is taxed on top of it, so this sets the IRS brackets that apply.">
              {(id, d) => <NumberInput id={id} describedBy={d} value={i.otherIncome} suffix="€" onChange={(v) => set("otherIncome", Math.max(0, v))} />}
            </Field>
            <Field label="Lawyer fee (% of settlement)">
              {(id) => <NumberInput id={id} value={i.lawyerPct} suffix="%" step={0.5} onChange={(v) => set("lawyerPct", pct(v))} />}
            </Field>
          </div>

          <details className="mt-4 rounded-md border border-stone-200 bg-stone-50/60 p-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-800">Refine the estimate (optional)</summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Disability degree" hint="60% or more gets special IRS treatment, which lowers the tax.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.disabilityPct} suffix="%" onChange={(v) => set("disabilityPct", pct(v))} />}
              </Field>
              <Field label="Part of the settlement that is accrued pay" hint="Unpaid salary, holiday pay, allowances: always taxed as normal income. Leave at 0 if all of it is termination compensation.">
                {(id, d) => <NumberInput id={id} describedBy={d} value={i.accrued} suffix="€" onChange={(v) => set("accrued", Math.max(0, Math.min(v, i.total)))} />}
              </Field>
              <label className="flex items-start gap-2 text-xs text-stone-700">
                <input type="checkbox" className="mt-0.5" checked={i.lawyerVatExcluded} onChange={(e) => set("lawyerVatExcluded", e.target.checked)} />
                <span>My lawyer’s % does not include VAT (23% is added on top)</span>
              </label>
            </div>
          </details>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Estimate">
            {!ready ? (
              <p className="text-sm text-stone-500">Enter the settlement amount to see the estimate.</p>
            ) : (
              <>
                <dl aria-label="Settlement estimate" className="num text-sm">
                  <Line label="Total settlement" value={fmtEur(r.grossSettlement)} strong />
                  <Line label="Tax-free part" value={fmtEur(r.excludedSettlement)} />
                  <Line label="Taxable part" value={fmtEur(r.taxableSettlement)} />
                  <div className="my-2 border-t border-stone-200" />
                  <Line label="Estimated IRS on the settlement" value={`− ${fmtEur(r.estimatedIRS)}`} />
                  <Line label="Estimated net settlement" value={fmtEur(r.grossSettlement - r.estimatedIRS)} strong />
                  <Line label={`Lawyer fee${i.lawyerVatExcluded ? " (incl. 23% VAT)" : ""}`} value={`− ${fmtEur(r.lawyerFee)}`} />
                  <Line label="Net settlement after lawyer fee" value={fmtEur(r.netCash)} strong />
                </dl>
                {!th && (
                  <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Enter the dates and average monthly income to compute the tax-free part. Until then nothing is treated as tax-free.
                  </p>
                )}
                {th && (
                  <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700">
                    Tax-free limit: <b className="num">{fmtEur(th.threshold)}</b> = {fmtEur(th.avgMonthlyRemuneration)} × {th.years} year{th.years === 1 ? "" : "s"} (a started year counts as a full year). Compensation above it is taxed as income.
                  </p>
                )}
                <p className="mt-2 text-xs text-stone-500">
                  IRS is the estimated final liability from your annual return. The amount withheld when you are paid can differ. Assumes the whole settlement is termination compensation unless you enter accrued pay.
                </p>
              </>
            )}
          </Card>

          <Card title="How to read this">
            <ul className="list-disc pl-4 text-sm text-stone-700">
              <li>The tax-free limit applies to genuine termination compensation, based on your average pay and years of service.</li>
              <li>The split must reflect what the agreement and the law actually say. Re-labelling payments is not a way to change the tax.</li>
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
    <div className={`flex justify-between gap-3 py-1 ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-stone-600"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
