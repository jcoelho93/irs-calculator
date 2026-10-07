import { useMemo, useState } from "react";
import { OPTIMIZE_WARNING, applyVariable, optimize, sensitivity } from "../domain/calculations/analysis";
import type { SensitivityVariable } from "../domain/calculations/analysis";
import { getTaxRules, supportedTaxYears } from "../domain/rules";
import type { Scenario } from "../domain/scenario/types";
import { fmtEur } from "../lib/format";
import { Button, Card, Field, NumberInput, Select } from "./ui";

interface Props {
  scenario: Scenario;
  update: (fn: (s: Scenario) => Scenario) => void;
}

const rulesFor = (s: Scenario) => getTaxRules(supportedTaxYears().includes(s.tax.taxYear) ? s.tax.taxYear : supportedTaxYears()[0]);

export function AnalysisPanel({ scenario: s, update }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <WhatIf scenario={s} update={update} />
      <Sensitivity scenario={s} />
      <Optimize scenario={s} update={update} />
    </div>
  );
}

function WhatIf({ scenario: s, update }: Props) {
  const sliders = s.parcels.filter((p) => p.enabled).map((p) => ({ key: p.id, label: p.name, value: p.amount, max: Math.max(p.amount * 2, 30000), set: (v: number) => update((x) => (applyVariable(x, { kind: "parcel", parcelId: p.id }, v))) }));
  return (
    <Card title="What-if controls">
      <ul className="flex flex-col gap-3">
        {sliders.map((c) => (
          <li key={c.key} className="grid grid-cols-[1fr_8rem] items-center gap-3">
            <div>
              <label className="text-xs font-medium text-stone-600" htmlFor={`wi-${c.key}`}>{c.label}</label>
              <input id={`wi-${c.key}`} className="w-full" type="range" min={0} max={c.max} step={500} value={c.value} onChange={(e) => c.set(Number(e.target.value))} />
            </div>
            <NumberInput value={c.value} suffix="€" onChange={c.set} />
          </li>
        ))}
        <li className="grid grid-cols-[1fr_8rem] items-center gap-3">
          <div>
            <label className="text-xs font-medium text-stone-600" htmlFor="wi-lawyer">Lawyer fee %</label>
            <input id="wi-lawyer" className="w-full" type="range" min={0} max={30} step={0.5} value={s.lawyer.percentage} onChange={(e) => update((x) => ((x.lawyer.percentage = Number(e.target.value)), x))} />
          </div>
          <NumberInput value={s.lawyer.percentage} suffix="%" step={0.5} onChange={(v) => update((x) => ((x.lawyer.percentage = v), x))} />
        </li>
      </ul>
      <p className="mt-2 text-xs text-stone-500">Changes edit the active scenario directly. Duplicate it first to keep a baseline.</p>
    </Card>
  );
}

function Sensitivity({ scenario: s }: { scenario: Scenario }) {
  const [varKey, setVarKey] = useState<string>(s.parcels[0]?.id ?? "lawyer");
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(() => Math.max(10000, (s.parcels[0]?.amount ?? 0) * 2));
  const [steps, setSteps] = useState(7);
  const variable: SensitivityVariable = varKey === "lawyer" ? { kind: "lawyerPercentage" } : varKey === "income" ? { kind: "otherIncome" } : { kind: "parcel", parcelId: varKey };
  const rows = useMemo(() => {
    try {
      return sensitivity(s, variable, from, to, steps, rulesFor(s));
    } catch {
      return [];
    }
  }, [s, varKey, from, to, steps]); // eslint-disable-line react-hooks/exhaustive-deps
  const isPct = varKey === "lawyer";
  return (
    <Card title="Sensitivity analysis">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <Field label="Variable">
            {(id) => <Select id={id} value={varKey} onChange={setVarKey} options={[...s.parcels.map((p) => ({ value: p.id, label: `Parcel: ${p.name}` })), { value: "lawyer", label: "Lawyer fee %" }, { value: "income", label: "Other annual income" }]} />}
          </Field>
        </div>
        <Field label="From">{(id) => <NumberInput id={id} value={from} onChange={setFrom} />}</Field>
        <Field label="To">{(id) => <NumberInput id={id} value={to} onChange={setTo} />}</Field>
        <Field label="Steps">{(id) => <NumberInput id={id} value={steps} onChange={(v) => setSteps(Math.round(v))} />}</Field>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="num w-full text-sm">
          <caption className="sr-only">Sensitivity of estimated IRS, lawyer cost and net cash</caption>
          <thead><tr className="border-b border-stone-200 text-right text-stone-500"><th className="py-1.5 text-left font-medium">{isPct ? "Fee %" : "Value"}</th><th className="font-medium">Taxable</th><th className="font-medium">Estimated IRS</th><th className="font-medium">Lawyer</th><th className="font-medium">Net</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.value} className="border-b border-stone-100 text-right"><td className="py-1.5 text-left">{isPct ? `${r.value}%` : fmtEur(r.value)}</td><td>{fmtEur(r.taxable)}</td><td>{fmtEur(r.estimatedIRS)}</td><td>{fmtEur(r.lawyerFee)}</td><td className="font-semibold">{fmtEur(r.netCash)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">Other parcels are held constant, so the gross settlement changes with the varied parcel.</p>
    </Card>
  );
}

function Optimize({ scenario: s, update }: Props) {
  const [ack, setAck] = useState(false);
  const [sel, setSel] = useState<Record<string, { on: boolean; min: number; max: number }>>({});
  const [step, setStep] = useState(1000);
  const total = s.parcels.filter((p) => p.enabled).reduce((a, p) => a + p.amount, 0);
  const cfg = (id: string) => sel[id] ?? { on: false, min: 0, max: total };
  const chosen = s.parcels.filter((p) => p.enabled && cfg(p.id).on);
  const res = useMemo(() => {
    if (!ack || chosen.length < 2) return null;
    const fixed = s.parcels.filter((p) => p.enabled && !cfg(p.id).on).reduce((a, p) => a + p.amount, 0);
    try {
      return optimize(s, chosen.map((p) => ({ parcelId: p.id, min: cfg(p.id).min, max: cfg(p.id).max })), total - fixed, step, rulesFor(s));
    } catch {
      return null;
    }
  }, [ack, sel, step, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id: string) => s.parcels.find((p) => p.id === id)?.name ?? id;
  const apply = (alloc: Record<string, number>) => update((x) => ((x.parcels = x.parcels.map((p) => (p.id in alloc ? { ...p, amount: alloc[p.id] } : p))), x));
  return (
    <Card title="Optimization (explore plausible allocations)">
      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">{OPTIMIZE_WARNING}</p>
      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        I understand: I will only set ranges that reflect what the settlement genuinely consists of.
      </label>
      {ack && (
        <>
          <p className="mt-3 text-xs text-stone-600">Select the parcels whose split is genuinely open, and set the range you consider legally plausible for each. Other parcels stay fixed. The total of the selected parcels is kept constant.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {s.parcels.filter((p) => p.enabled).map((p) => (
              <li key={p.id} className="grid grid-cols-[1.5rem_1fr_6rem_6rem] items-center gap-2 text-sm">
                <input type="checkbox" aria-label={`Vary ${p.name}`} checked={cfg(p.id).on} onChange={(e) => setSel({ ...sel, [p.id]: { ...cfg(p.id), on: e.target.checked } })} />
                <span>{p.name}</span>
                <NumberInput value={cfg(p.id).min} suffix="min" onChange={(v) => setSel({ ...sel, [p.id]: { ...cfg(p.id), min: v } })} />
                <NumberInput value={cfg(p.id).max} suffix="max" onChange={(v) => setSel({ ...sel, [p.id]: { ...cfg(p.id), max: v } })} />
              </li>
            ))}
          </ul>
          <div className="mt-3 w-40"><Field label="Search step">{(id) => <NumberInput id={id} value={step} suffix="€" onChange={(v) => setStep(Math.max(100, v))} />}</Field></div>
          {chosen.length < 2 && <p className="mt-2 text-sm text-stone-500">Select at least two parcels to compare allocations.</p>}
          {res && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([["Maximum estimated net cash", res.maxNet], ["Minimum estimated IRS", res.minIRS]] as const).map(([label, c]) => (
                <div key={label} className="rounded-md border border-stone-200 p-3 text-sm">
                  <div className="text-xs font-medium text-stone-500">{label}</div>
                  {c ? (
                    <>
                      <ul className="num mt-1">{Object.entries(c.allocation).map(([id, v]) => <li key={id} className="flex justify-between"><span>{name(id)}</span><span>{fmtEur(v)}</span></li>)}</ul>
                      <div className="num mt-1 border-t border-stone-100 pt-1">IRS {fmtEur(c.estimatedIRS)} · net <b>{fmtEur(c.netCash)}</b></div>
                      <div className="mt-2"><Button onClick={() => apply(c.allocation)}>Apply to this scenario</Button></div>
                    </>
                  ) : <p className="text-stone-500">No feasible allocation in these ranges.</p>}
                </div>
              ))}
              <p className="col-span-full text-xs text-stone-500">{res.evaluated} allocations evaluated{res.truncated ? " (search truncated: increase the step)" : ""}. Results are only as valid as the plausible ranges you defined, and the risk indicator still applies.</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
