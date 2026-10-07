import type { CalculationResult } from "../domain/calculations/types";
import { categoryLabel } from "../domain/parcels/types";
import type { Scenario } from "../domain/scenario/types";
import { fmtEur, fmtPct } from "../lib/format";
import { Badge, Card } from "./ui";

export const Disclaimer = () => (
  <p className="text-xs leading-relaxed text-stone-500">
    This calculator provides estimates for scenario analysis and does not constitute tax, legal, or financial advice. Portuguese tax treatment depends on the facts, legal wording and applicable legislation. Verify material conclusions with a qualified Portuguese tax professional or lawyer.
  </p>
);

const RISK = {
  green: { label: "GREEN", tone: "green" as const },
  yellow: { label: "YELLOW", tone: "amber" as const },
  red: { label: "RED", tone: "red" as const },
};

function Row({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? "border-t border-stone-300 pt-2 text-lg font-semibold" : "text-sm"}`}>
      <dt className={strong ? "" : "text-stone-600"}>
        {label}
        {sub && <span className="ml-1.5 text-xs text-stone-400">{sub}</span>}
      </dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

export function ResultsPanel({ scenario: s, result: r }: { scenario: Scenario; result: CalculationResult }) {
  const risk = RISK[r.risk.level];
  const hasErrors = r.issues.some((i) => i.severity === "error");
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{s.name}: estimate</h2>
          <Badge tone="amber">Estimate only</Badge>
        </div>
        {hasErrors && <p role="alert" className="mb-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">Some inputs are invalid; figures may be unreliable. See the highlighted fields.</p>}
        <dl aria-label="Settlement financial summary">
          <Row label="Gross settlement" value={fmtEur(r.grossSettlement)} />
          <Row label="Potentially non-taxable" value={fmtEur(r.excludedSettlement)} />
          <Row label="Taxable" value={fmtEur(r.taxableSettlement)} />
          <Row label="Estimated IRS" sub="final, attributable to settlement" value={`− ${fmtEur(r.estimatedIRS)}`} />
          <Row label="Lawyer cost" value={`− ${fmtEur(r.lawyerFee)}`} />
          {r.otherCosts > 0 && <Row label="Other costs" value={`− ${fmtEur(r.otherCosts)}`} />}
          <Row label="Estimated net cash" value={fmtEur(r.netCash)} strong />
        </dl>
        <dl className="num mt-3 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-center">
          <div><dt className="text-[11px] text-stone-500">Effective tax rate</dt><dd className="text-base font-semibold">{fmtPct(r.effectiveTaxRate)}</dd></div>
          <div><dt className="text-[11px] text-stone-500">Lawyer share</dt><dd className="text-base font-semibold">{fmtPct(r.effectiveLawyerCost)}</dd></div>
          <div><dt className="text-[11px] text-stone-500">Net of gross</dt><dd className="text-base font-semibold">{fmtPct(r.effectiveNetPercentage)}</dd></div>
        </dl>
        {r.conservative && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            If every uncertain parcel were fully taxable: IRS <b className="num">{fmtEur(r.conservative.estimatedIRS)}</b>, net cash <b className="num">{fmtEur(r.conservative.netCash)}</b>.
          </p>
        )}
      </Card>

      <Card title="Gross → tax → lawyer → net">
        <MoneyFlow r={r} />
      </Card>

      <Card title="IRS detail">
        <dl>
          <Row label="IRS without settlement" value={fmtEur(r.baselineIRS, true)} />
          <Row label="IRS with settlement" value={fmtEur(r.totalIRSWithSettlement, true)} />
          <Row label="Estimated final IRS on settlement" value={fmtEur(r.estimatedIRS, true)} />
          <Row label="Withholding already paid on settlement" value={fmtEur(r.withholdingOnSettlement, true)} />
          <Row label={r.withholdingBalance >= 0 ? "Still to pay (estimate)" : "Refund (estimate)"} value={fmtEur(Math.abs(r.withholdingBalance), true)} />
        </dl>
        <details className="mt-2 text-xs text-stone-600">
          <summary className="cursor-pointer font-medium">How the final IRS was computed</summary>
          <table className="num mt-2 w-full">
            <thead><tr className="text-left text-stone-500"><th className="font-medium"> </th><th className="text-right font-medium">Without</th><th className="text-right font-medium">With</th></tr></thead>
            <tbody>
              {(
                [
                  ["Gross Category A", "grossCategoryA"],
                  ["Disability exclusion (art. 56-A)", "disabilityExclusion"],
                  ["Specific deduction", "specificDeduction"],
                  ["Taxable income", "taxableIncome"],
                  ["Tax on brackets", "bracketTax"],
                  ["Disability credit (art. 87)", "disabilityCredit"],
                  ["Solidarity surcharge", "solidaritySurcharge"],
                  ["Final IRS", "finalIrs"],
                ] as const
              ).map(([l, k]) => (
                <tr key={k} className="border-t border-stone-100"><td className="py-0.5">{l}</td><td className="text-right">{fmtEur(r.irsDetail.baseline[k], true)}</td><td className="text-right">{fmtEur(r.irsDetail.withSettlement[k], true)}</td></tr>
              ))}
            </tbody>
          </table>
          {r.threshold && (
            <ul className="mt-2 list-disc pl-4">{r.threshold.steps.map((st) => <li key={st}>{st}</li>)}</ul>
          )}
        </details>
      </Card>

      <Card title="Allocation by category">
        <Allocation r={r} />
      </Card>

      <Card title={<span>Scenario risk: <Badge tone={risk.tone}>{risk.label}</Badge></span>}>
        <ul className="list-disc pl-4 text-sm text-stone-700">{r.risk.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-2 text-xs text-stone-500">A modelling confidence indicator, not a legal opinion.</p>
      </Card>

      <Card title="Assumptions">
        <ul className="flex flex-col gap-1 text-sm">
          {r.assumptions.map((a) => (
            <li key={a.id} className="flex gap-2">
              <span aria-hidden className="w-4 shrink-0">{a.level === "ok" ? "✓" : a.level === "warning" ? "⚠" : "○"}</span>
              <span><span className="sr-only">{a.level === "ok" ? "Assumed: " : a.level === "warning" ? "Warning: " : "Not modelled: "}</span>{a.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-stone-500">Change assumptions in the inputs on the left; every figure above recalculates instantly.</p>
      </Card>
      <Disclaimer />
    </div>
  );
}

function MoneyFlow({ r }: { r: CalculationResult }) {
  const g = r.grossSettlement || 1;
  const parts = [
    { label: "IRS", v: r.estimatedIRS, cls: "bg-stone-700" },
    { label: "Lawyer", v: r.lawyerFee, cls: "bg-stone-400" },
    { label: "Other costs", v: r.otherCosts, cls: "bg-stone-300" },
    { label: "Net", v: Math.max(0, r.netCash), cls: "bg-emerald-600" },
  ];
  return (
    <div>
      <div className="flex h-7 overflow-hidden rounded-md" role="img" aria-label={`Of ${fmtEur(r.grossSettlement)} gross: IRS ${fmtEur(r.estimatedIRS)}, lawyer ${fmtEur(r.lawyerFee)}, net ${fmtEur(r.netCash)}`}>
        {parts.map((p) => p.v > 0 && <div key={p.label} className={p.cls} style={{ width: `${(p.v / g) * 100}%` }} title={`${p.label}: ${fmtEur(p.v)}`} />)}
      </div>
      <ul className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li className="text-stone-500">Gross {fmtEur(r.grossSettlement)}</li>
        {parts.map((p) => p.v > 0 && <li key={p.label}><span className={`mr-1 inline-block size-2 rounded-sm ${p.cls}`} />{p.label} {fmtEur(p.v)}</li>)}
      </ul>
    </div>
  );
}

function Allocation({ r }: { r: CalculationResult }) {
  const by = new Map<string, number>();
  for (const t of r.parcels) by.set(t.classification, (by.get(t.classification) ?? 0) + t.grossAmount);
  const rows = [...by.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = r.grossSettlement || 1;
  if (!rows.length) return <p className="text-sm text-stone-500">No amounts allocated.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map(([c, v]) => (
        <li key={c} className="text-sm">
          <div className="flex justify-between"><span>{categoryLabel(c as never)}</span><span className="num">{fmtEur(v)} · {fmtPct(v / total, 0)}</span></div>
          <div className="mt-0.5 h-1.5 rounded bg-stone-100"><div className="h-full rounded bg-stone-600" style={{ width: `${(v / total) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
