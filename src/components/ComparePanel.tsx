import { METRIC_GOAL, rankMetric } from "../domain/calculations/analysis";
import type { Metric } from "../domain/calculations/analysis";
import type { CalculationResult } from "../domain/calculations/types";
import type { Scenario } from "../domain/scenario/types";
import { fmtEur, fmtPct } from "../lib/format";
import { Badge, Button, Card } from "./ui";

interface Props {
  scenarios: Scenario[];
  results: Map<string, CalculationResult>;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const ROWS: { label: string; get: (r: CalculationResult) => number; fmt: (n: number) => string; metric?: Metric }[] = [
  { label: "Gross settlement", get: (r) => r.grossSettlement, fmt: (n) => fmtEur(n) },
  { label: "Potentially excluded", get: (r) => r.excludedSettlement, fmt: (n) => fmtEur(n) },
  { label: "Taxable", get: (r) => r.taxableSettlement, fmt: (n) => fmtEur(n), metric: "taxableSettlement" },
  { label: "Estimated IRS", get: (r) => r.estimatedIRS, fmt: (n) => fmtEur(n), metric: "estimatedIRS" },
  { label: "Lawyer cost", get: (r) => r.lawyerFee, fmt: (n) => fmtEur(n), metric: "lawyerFee" },
  { label: "Net cash", get: (r) => r.netCash, fmt: (n) => fmtEur(n), metric: "netCash" },
  { label: "Effective tax rate", get: (r) => r.effectiveTaxRate, fmt: (n) => fmtPct(n) },
  { label: "Net of gross", get: (r) => r.effectiveNetPercentage, fmt: (n) => fmtPct(n) },
];

export function ComparePanel({ scenarios, results, onOpen, onDuplicate }: Props) {
  const rs = scenarios.map((s) => results.get(s.id)!);
  const max = Math.max(1, ...rs.map((r) => Math.max(0, r.netCash)));
  return (
    <div className="flex flex-col gap-4">
      <Card title="Scenario comparison">
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left">
                <th className="py-2 pr-3 font-medium text-stone-500">Metric</th>
                {scenarios.map((s) => (
                  <th key={s.id} className="px-2 py-2 text-right font-semibold">
                    {s.name}
                    <div className="mt-1 flex justify-end gap-1"><Button onClick={() => onOpen(s.id)}>Edit</Button><Button onClick={() => onDuplicate(s.id)}>Duplicate</Button></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const vals = rs.map(row.get);
                const rank = row.metric ? rankMetric(vals, METRIC_GOAL[row.metric].better) : { best: [], worst: [] };
                return (
                  <tr key={row.label} className="border-b border-stone-100">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-stone-600">
                      {row.label}
                      {row.metric && <div className="text-[11px] text-stone-400">best = {METRIC_GOAL[row.metric].label}</div>}
                    </th>
                    {vals.map((v, i) => (
                      <td key={scenarios[i].id} className={`px-2 py-2 text-right ${rank.best.includes(i) ? "font-semibold" : ""}`}>
                        {row.fmt(v)}
                        {rank.best.includes(i) && <Badge tone="green">best</Badge>}
                        {rank.worst.includes(i) && <Badge tone="red">worst</Badge>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <th scope="row" className="py-2 pr-3 text-left font-normal text-stone-600">Scenario risk</th>
                {rs.map((r, i) => <td key={scenarios[i].id} className="px-2 py-2 text-right"><Badge tone={r.risk.level === "green" ? "green" : r.risk.level === "yellow" ? "amber" : "red"}>{r.risk.level.toUpperCase()}</Badge></td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-500">“Best” and “worst” are only marked per metric, as labelled; no scenario is ranked overall. A scenario with a higher net cash may carry a higher legal risk: check the risk row.</p>
      </Card>
      <Card title="Net cash by scenario">
        <ul className="flex flex-col gap-2">
          {scenarios.map((s, i) => (
            <li key={s.id} className="text-sm">
              <div className="flex justify-between"><span>{s.name}</span><span className="num">{fmtEur(rs[i].netCash)}</span></div>
              <div className="mt-0.5 h-3 rounded bg-stone-100"><div className="h-full rounded bg-emerald-600" style={{ width: `${(Math.max(0, rs[i].netCash) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
