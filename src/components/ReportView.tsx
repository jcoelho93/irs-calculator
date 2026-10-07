import type { CalculationResult } from "../domain/calculations/types";
import { categoryLabel, STATUS_LABEL } from "../domain/parcels/types";
import { getSource } from "../domain/rules";
import type { Scenario } from "../domain/scenario/types";
import { fmtEur, fmtPct } from "../lib/format";
import { Button, Card } from "./ui";
import { Disclaimer } from "./ResultsPanel";

export function ReportView({ scenario: s, result: r }: { scenario: Scenario; result: CalculationResult }) {
  const srcIds = [...new Set(r.parcels.flatMap((p) => p.sourceIds).concat(["irs-brackets-2026", "specific-deduction-2026"]))];
  return (
    <Card title="Printable report" actions={<Button variant="primary" onClick={() => window.print()}>Print / save as PDF</Button>} className="print:border-0">
      <article className="flex flex-col gap-5 text-sm">
        <header>
          <h1 className="text-xl font-semibold">{s.name}: settlement estimate</h1>
          <p className="text-stone-500">Tax year {r.taxYear} · generated {new Date().toLocaleDateString("en-GB")} · estimate only</p>
        </header>
        <section>
          <h3 className="mb-1 font-semibold">Assumptions</h3>
          <ul className="list-disc pl-5">{r.assumptions.map((a) => <li key={a.id}>{a.text}</li>)}</ul>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Parcel breakdown and tax treatment</h3>
          <table className="num w-full text-left">
            <thead><tr className="border-b"><th>Parcel</th><th>Category</th><th className="text-right">Amount</th><th className="text-right">Excluded</th><th className="text-right">Taxable</th><th>Treatment</th></tr></thead>
            <tbody>
              {r.parcels.map((t) => {
                const p = s.parcels.find((x) => x.id === t.parcelId)!;
                return (
                  <tr key={t.parcelId} className="border-b align-top">
                    <td>{p.name}</td><td>{categoryLabel(p.category)}</td>
                    <td className="text-right">{fmtEur(t.grossAmount, true)}</td><td className="text-right">{fmtEur(t.excludedAmount, true)}</td><td className="text-right">{fmtEur(t.taxableAmount, true)}</td>
                    <td>{STATUS_LABEL[t.status]} ({t.confidence} confidence)<div className="text-xs text-stone-500">{t.explanation}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Calculation</h3>
          <dl className="num grid max-w-md grid-cols-2 gap-y-0.5">
            <dt>Gross settlement</dt><dd className="text-right">{fmtEur(r.grossSettlement, true)}</dd>
            <dt>Potentially excluded</dt><dd className="text-right">{fmtEur(r.excludedSettlement, true)}</dd>
            <dt>Taxable</dt><dd className="text-right">{fmtEur(r.taxableSettlement, true)}</dd>
            <dt>Estimated final IRS</dt><dd className="text-right">{fmtEur(r.estimatedIRS, true)}</dd>
            <dt>Withholding on settlement</dt><dd className="text-right">{fmtEur(r.withholdingOnSettlement, true)}</dd>
            <dt>Lawyer: base / VAT / total</dt><dd className="text-right">{fmtEur(r.lawyer.baseFee, true)} / {fmtEur(r.lawyer.vat, true)} / {fmtEur(r.lawyer.total, true)}</dd>
            <dt>Other costs</dt><dd className="text-right">{fmtEur(r.otherCosts, true)}</dd>
            <dt className="font-semibold">Estimated net cash</dt><dd className="text-right font-semibold">{fmtEur(r.netCash, true)}</dd>
            <dt>Effective tax rate</dt><dd className="text-right">{fmtPct(r.effectiveTaxRate)}</dd>
          </dl>
          <p className="mt-1 text-xs text-stone-500">Lawyer fees are modeled as a cash cost. Their deductibility/tax treatment is a separate legal question and is not automatically assumed.</p>
          <p className="mt-1 text-xs">Scenario risk: <b>{r.risk.level.toUpperCase()}</b>. {r.risk.reasons.join(" ")}</p>
        </section>
        <section>
          <h3 className="mb-1 font-semibold">Sources</h3>
          <ul className="list-disc pl-5 text-xs">
            {srcIds.map((id) => getSource(id)).filter(Boolean).map((src) => <li key={src!.id}>{src!.title}: {src!.legalReference} ({src!.verification.replace(/-/g, " ")}, accessed {src!.accessed})</li>)}
          </ul>
        </section>
        <Disclaimer />
      </article>
    </Card>
  );
}
