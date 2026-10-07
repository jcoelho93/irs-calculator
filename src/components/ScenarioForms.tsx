import { useState } from "react";
import type { CalculationResult } from "../domain/calculations/types";
import { supportedTaxYears } from "../domain/rules";
import type { Scenario } from "../domain/scenario/types";
import { TERMINATION_REASONS } from "../domain/scenario/types";
import { effectiveAvgMonthly } from "../domain/calculations/scenario";
import { fmtEur } from "../lib/format";
import { Card, Field, NumberInput, Select, TextInput, issueFor } from "./ui";

interface Props {
  scenario: Scenario;
  result: CalculationResult;
  update: (fn: (s: Scenario) => Scenario) => void;
}

export function EmploymentForm({ scenario: s, result, update }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const iss = (f: string) => issueFor(result.issues, f);
  const e = s.employment;
  return (
    <Card title="Employment & termination">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employment start" issue={iss("employment.startDate")}>
          {(id, d) => <TextInput id={id} describedBy={d} type="date" value={e.startDate} onChange={(v) => update((x) => ((x.employment.startDate = v), x))} />}
        </Field>
        <Field label="Termination date" issue={iss("employment.terminationDate")}>
          {(id, d) => <TextInput id={id} describedBy={d} type="date" value={e.terminationDate} onChange={(v) => update((x) => ((x.employment.terminationDate = v), x))} />}
        </Field>
        <Field label="Monthly gross salary" issue={iss("employment.monthlyGrossSalary")}>
          {(id, d) => <NumberInput id={id} describedBy={d} value={e.monthlyGrossSalary} suffix="€" onChange={(v) => update((x) => ((x.employment.monthlyGrossSalary = v), x))} />}
        </Field>
        <Field label="Annual gross salary" issue={iss("employment.annualGrossSalary")}>
          {(id, d) => <NumberInput id={id} describedBy={d} value={e.annualGrossSalary} suffix="€" onChange={(v) => update((x) => ((x.employment.annualGrossSalary = v), x))} />}
        </Field>
        <div className="col-span-2">
          <Field
            label="Average monthly remuneration (last 12 months)"
            hint="Regular remuneration subject to tax, including holiday and Christmas allowances, divided by 12. Drives the termination-compensation threshold."
            issue={iss("employment.avgMonthlyRemuneration")}
          >
            {(id, d) => (
              <div className="flex items-center gap-3">
                <div className="w-40">
                  <NumberInput id={id} describedBy={d} value={e.avgFromAnnual ? effectiveAvgMonthly(s) : e.avgMonthlyRemuneration} suffix="€" onChange={(v) => update((x) => ((x.employment.avgMonthlyRemuneration = v), x))} />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-stone-600">
                  <input type="checkbox" checked={e.avgFromAnnual} onChange={(ev) => update((x) => ((x.employment.avgFromAnnual = ev.target.checked), x))} />
                  Use annual gross ÷ 12
                </label>
              </div>
            )}
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Reason for termination">
            {(id) => <Select id={id} value={e.terminationReason} onChange={(v) => update((x) => ((x.employment.terminationReason = v), x))} options={TERMINATION_REASONS.map((r) => ({ value: r, label: r }))} />}
          </Field>
        </div>
      </div>
      <button type="button" className="mt-3 text-xs font-medium text-blue-700 underline-offset-2 hover:underline" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
        {advanced ? "Hide" : "Show"} advanced details
      </button>
      {advanced && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Employer">{(id) => <TextInput id={id} value={e.employer} onChange={(v) => update((x) => ((x.employment.employer = v), x))} />}</Field>
          <Field label="Position">{(id) => <TextInput id={id} value={e.position} onChange={(v) => update((x) => ((x.employment.position = v), x))} />}</Field>
          <div className="col-span-2">
            <Field label="Collective agreement / other relevant information">{(id) => <TextInput id={id} value={e.collectiveAgreement} onChange={(v) => update((x) => ((x.employment.collectiveAgreement = v), x))} />}</Field>
          </div>
          <label className="col-span-2 flex items-start gap-2 text-xs text-stone-700">
            <input type="checkbox" className="mt-0.5" checked={e.rehiredWithin24Months} onChange={(ev) => update((x) => ((x.employment.rehiredWithin24Months = ev.target.checked), x))} />
            <span>A new link with the same employer is created within 24 months (voids the termination-compensation exclusion, art. 2(4) CIRS)</span>
          </label>
        </div>
      )}
    </Card>
  );
}

export function TaxForm({ scenario: s, result, update }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const iss = (f: string) => issueFor(result.issues, f);
  return (
    <Card title="Tax details">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tax year" issue={iss("tax.taxYear")}>
          {(id, d) => <Select id={id} describedBy={d} value={String(s.tax.taxYear)} onChange={(v) => update((x) => ((x.tax.taxYear = Number(v)), x))} options={[...new Set([...supportedTaxYears(), s.tax.taxYear])].sort().map((y) => ({ value: String(y), label: supportedTaxYears().includes(y) ? String(y) : `${y} (no rules)` }))} />}
        </Field>
        <Field label="Disability / incapacity" hint="≥ 60% with a valid multiuse certificate triggers the art. 56-A and art. 87 treatment." issue={iss("tax.disabilityPct")}>
          {(id, d) => <NumberInput id={id} describedBy={d} value={s.tax.disabilityPct} suffix="%" min={0} onChange={(v) => update((x) => ((x.tax.disabilityPct = v), x))} />}
        </Field>
        <div className="col-span-2">
          <Field label="Other annual Category A income (same tax year, excl. settlement)" hint="Salary earned this year before termination, or other employment income." issue={iss("tax.otherAnnualIncome")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={s.tax.otherAnnualIncome} suffix="€" onChange={(v) => update((x) => ((x.tax.otherAnnualIncome = v), x))} />}
          </Field>
        </div>
      </div>
      <button type="button" className="mt-3 text-xs font-medium text-blue-700 underline-offset-2 hover:underline" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
        {advanced ? "Hide" : "Show"} advanced tax inputs
      </button>
      {advanced && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Marital status" hint={s.tax.maritalStatus === "married_joint" ? "Joint taxation is not modelled; estimated as single." : undefined}>
            {(id, d) => <Select id={id} describedBy={d} value={s.tax.maritalStatus} onChange={(v) => update((x) => ((x.tax.maritalStatus = v), x))} options={[{ value: "single", label: "Single" }, { value: "married_joint", label: "Married, joint" }, { value: "married_separate", label: "Married, separate" }, { value: "other", label: "Other" }]} />}
          </Field>
          <Field label="Dependents" hint={s.tax.dependents > 0 ? "No dependent deductions are applied." : undefined}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={s.tax.dependents} min={0} onChange={(v) => update((x) => ((x.tax.dependents = Math.max(0, Math.round(v))), x))} />}
          </Field>
          <Field label="Mandatory social-security contributions" hint="Used only if higher than the fixed specific deduction." issue={iss("tax.socialSecurityContributions")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={s.tax.socialSecurityContributions} suffix="€" onChange={(v) => update((x) => ((x.tax.socialSecurityContributions = v), x))} />}
          </Field>
          <Field label="Withholding on settlement" hint="Withholding is not the final liability." issue={iss("tax.withholdingOnSettlement")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={s.tax.withholdingOnSettlement} suffix="€" onChange={(v) => update((x) => ((x.tax.withholdingOnSettlement = v), x))} />}
          </Field>
          <Field label="Other costs" issue={iss("otherCosts")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={s.otherCosts} suffix="€" onChange={(v) => update((x) => ((x.otherCosts = v), x))} />}
          </Field>
        </div>
      )}
    </Card>
  );
}

export function LawyerForm({ scenario: s, result, update }: Props) {
  const iss = (f: string) => issueFor(result.issues, f);
  const l = s.lawyer;
  const L = result.lawyer;
  return (
    <Card title="Lawyer fees">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Fee structure">
            {(id) => <Select id={id} value={l.mode} onChange={(v) => update((x) => ((x.lawyer.mode = v), x))} options={[{ value: "percentage", label: "Percentage of recovery" }, { value: "fixed", label: "Fixed fee" }, { value: "hybrid", label: "Hybrid: fixed + percentage" }]} />}
          </Field>
        </div>
        {l.mode !== "fixed" && (
          <Field label="Percentage" issue={iss("lawyer.percentage")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={l.percentage} suffix="%" step={0.5} onChange={(v) => update((x) => ((x.lawyer.percentage = v), x))} />}
          </Field>
        )}
        {l.mode !== "percentage" && (
          <Field label="Fixed amount" issue={iss("lawyer.fixedAmount")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={l.fixedAmount} suffix="€" onChange={(v) => update((x) => ((x.lawyer.fixedAmount = v), x))} />}
          </Field>
        )}
        <Field label="VAT" issue={iss("lawyer.vatRate")}>
          {(id, d) => <NumberInput id={id} describedBy={d} value={l.vatRate} suffix="%" onChange={(v) => update((x) => ((x.lawyer.vatRate = v), x))} />}
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={l.vatIncluded} onChange={(ev) => update((x) => ((x.lawyer.vatIncluded = ev.target.checked), x))} />
          Quoted fee already includes VAT
        </label>
      </div>
      <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-sm">
        <dt className="text-stone-500">Base fee</dt><dd className="text-right">{fmtEur(L.baseFee, true)}</dd>
        <dt className="text-stone-500">VAT</dt><dd className="text-right">{fmtEur(L.vat, true)}</dd>
        <dt className="font-medium">Total lawyer cost</dt><dd className="text-right font-medium">{fmtEur(L.total, true)}</dd>
        <dt className="text-stone-500">% of settlement</dt><dd className="text-right">{(L.percentOfSettlement * 100).toFixed(1)}%</dd>
      </dl>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Lawyer fees are modeled as a cash cost. Their deductibility/tax treatment is a separate legal question and is not automatically assumed.
      </p>
    </Card>
  );
}
