import { useState } from "react";
import type { CalculationResult } from "../domain/calculations/types";
import { PARCEL_CATEGORIES, STATUS_LABEL } from "../domain/parcels/types";
import type { Parcel, ParcelCategory, ParcelTreatment } from "../domain/parcels/types";
import { newId, newParcel } from "../domain/scenario/defaults";
import type { Scenario } from "../domain/scenario/types";
import { getSource } from "../domain/rules";
import { fmtEur } from "../lib/format";
import { Badge, Button, Card, Disclosure, Field, NumberInput, Select, TextInput, issueFor } from "./ui";

const statusTone = (t: ParcelTreatment) =>
  t.status === "fully_taxable" ? "stone" : t.status === "requires_validation" || t.status === "unknown" ? "red" : t.status === "partially_taxable" ? "blue" : "amber";

interface Props {
  scenario: Scenario;
  result: CalculationResult;
  update: (fn: (s: Scenario) => Scenario) => void;
}

export function ParcelEditor({ scenario: s, result, update }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const patch = (id: string, ch: Partial<Parcel>) => update((x) => ((x.parcels = x.parcels.map((p) => (p.id === id ? { ...p, ...ch } : p))), x));
  const move = (id: string, to: number) =>
    update((x) => {
      const i = x.parcels.findIndex((p) => p.id === id);
      if (i < 0 || to < 0 || to >= x.parcels.length) return x;
      const [p] = x.parcels.splice(i, 1);
      x.parcels.splice(to, 0, p);
      return x;
    });
  const dup = (id: string) =>
    update((x) => {
      const i = x.parcels.findIndex((p) => p.id === id);
      x.parcels.splice(i + 1, 0, { ...x.parcels[i], id: newId(), name: `${x.parcels[i].name} (copy)` });
      return x;
    });

  const diff = result.unallocated;
  return (
    <Card
      title="Settlement parcels"
      actions={<Button variant="primary" onClick={() => update((x) => ((x.parcels = [...x.parcels, newParcel({ name: "New parcel" })]), x))}>+ Add parcel</Button>}
    >
      <div className="num mb-3 grid grid-cols-3 gap-3 rounded-md bg-stone-50 p-3 text-sm">
        <div>
          <Field label="Settlement total" issue={issueFor(result.issues, "settlementTotal")}>
            {(id, d) => <NumberInput id={id} describedBy={d} value={s.settlementTotal} suffix="€" onChange={(v) => update((x) => ((x.settlementTotal = v), x))} />}
          </Field>
        </div>
        <div>
          <div className="text-xs font-medium text-stone-600">Allocated</div>
          <div className="mt-2 text-base font-semibold">{fmtEur(result.allocated, true)}</div>
        </div>
        <div role="status" aria-live="polite">
          <div className="text-xs font-medium text-stone-600">Remaining</div>
          <div className={`mt-2 text-base font-semibold ${diff === 0 ? "" : "text-amber-700"}`}>
            {fmtEur(diff, true)}
            {diff !== 0 && <span className="ml-1 text-xs font-normal">{diff > 0 ? "unallocated" : "over-allocated"}</span>}
          </div>
          {diff !== 0 && (
            <button type="button" className="mt-1 text-xs text-blue-700 underline-offset-2 hover:underline" onClick={() => update((x) => ((x.settlementTotal = result.allocated), x))}>
              Set total to allocated
            </button>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {s.parcels.map((p, i) => {
          const t = result.parcels.find((x) => x.parcelId === p.id);
          const amountIssue = issueFor(result.issues, `parcels.${p.id}.amount`);
          return (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) move(dragId, i);
                setDragId(null);
              }}
              className={`rounded-lg border bg-white p-3 ${p.enabled ? "border-stone-200" : "border-dashed border-stone-300 opacity-60"} ${dragId === p.id ? "ring-2 ring-blue-300" : ""}`}
            >
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Field label="Name">{(id) => <TextInput id={id} value={p.name} onChange={(v) => patch(p.id, { name: v })} />}</Field>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Field label="Amount" issue={amountIssue}>
                    {(id, d) => <NumberInput id={id} describedBy={d} invalid={!!amountIssue} value={p.amount} suffix="€" onChange={(v) => patch(p.id, { amount: v })} />}
                  </Field>
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <Field label="Category">
                    {(id) => (
                      <select id={id} className="w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm" value={p.category} onChange={(e) => patch(p.id, { category: e.target.value as ParcelCategory })}>
                        {["Employment-related", "Damages", "Costs", "Other"].map((g) => (
                          <optgroup key={g} label={g}>
                            {PARCEL_CATEGORIES.filter((c) => c.group === g).map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              </div>

              {t && p.enabled && (
                <div className="num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <Badge tone={statusTone(t)}>{STATUS_LABEL[t.status]}{t.overridden ? " (override)" : ""}</Badge>
                  <span><span className="text-stone-500">Excluded </span>{fmtEur(t.excludedAmount, true)}</span>
                  <span><span className="text-stone-500">Taxable </span>{fmtEur(t.taxableAmount, true)}</span>
                  <span className="text-stone-500">Confidence: {t.confidence}</span>
                </div>
              )}

              {t && p.enabled && (
                <div className="mt-2">
                  <Disclosure summary="Why is this taxed this way?">
                    <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                      <dt className="text-stone-500">Treatment</dt><dd>{STATUS_LABEL[t.status]}</dd>
                      <dt className="text-stone-500">Amount</dt><dd className="num">{fmtEur(t.grossAmount, true)}</dd>
                      <dt className="text-stone-500">Potentially excluded</dt><dd className="num">{fmtEur(t.excludedAmount, true)}</dd>
                      <dt className="text-stone-500">Potentially taxable</dt><dd className="num">{fmtEur(t.taxableAmount, true)}</dd>
                      <dt className="text-stone-500">Why?</dt><dd>{t.explanation}</dd>
                      <dt className="text-stone-500">Legal basis</dt><dd>{t.legalBasis}{t.sourceIds.map((sid) => getSource(sid)).filter(Boolean).map((src) => <span key={src!.id} className="ml-1 text-xs text-stone-500">[{src!.legalReference}, {src!.verification.replace(/-/g, " ")}]</span>)}</dd>
                      <dt className="text-stone-500">Confidence</dt><dd className="capitalize">{t.confidence}</dd>
                    </dl>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-stone-200 pt-3">
                      <Field label="Manual tax treatment override" hint="Only where the real nature of the payment supports it.">
                        {(id) => (
                          <Select id={id} value={p.override ?? "none"} onChange={(v) => patch(p.id, { override: v === "none" ? null : (v as Parcel["override"]) })} options={[{ value: "none", label: "Use engine treatment" }, { value: "fully_taxable", label: "Override: fully taxable" }, { value: "fully_excluded", label: "Override: fully excluded" }]} />
                        )}
                      </Field>
                      <Field label="Your confidence in classification">
                        {(id) => <Select id={id} value={p.userConfidence} onChange={(v) => patch(p.id, { userConfidence: v })} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />}
                      </Field>
                      <div className="col-span-2">
                        <Field label="Legal basis / contract clause">{(id) => <TextInput id={id} value={p.legalBasis} onChange={(v) => patch(p.id, { legalBasis: v })} />}</Field>
                      </div>
                      <div className="col-span-2">
                        <Field label="Notes">{(id) => <TextInput id={id} value={p.notes} onChange={(v) => patch(p.id, { notes: v })} />}</Field>
                      </div>
                    </div>
                  </Disclosure>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span aria-hidden className="cursor-grab select-none px-1 text-stone-400" title="Drag to reorder">⠿</span>
                <Button variant="ghost" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(p.id, i - 1)}>↑</Button>
                <Button variant="ghost" aria-label={`Move ${p.name} down`} disabled={i === s.parcels.length - 1} onClick={() => move(p.id, i + 1)}>↓</Button>
                <Button onClick={() => dup(p.id)}>Duplicate</Button>
                <Button onClick={() => patch(p.id, { enabled: !p.enabled })}>{p.enabled ? "Disable" : "Enable"}</Button>
                <Button variant="danger" onClick={() => update((x) => ((x.parcels = x.parcels.filter((q) => q.id !== p.id)), x))}>Delete</Button>
              </div>
            </li>
          );
        })}
        {s.parcels.length === 0 && <li className="rounded-md border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">No parcels yet. Add one to start.</li>}
      </ul>
    </Card>
  );
}
