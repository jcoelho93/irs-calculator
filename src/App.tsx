import { useRef, useState } from "react";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { ComparePanel } from "./components/ComparePanel";
import { ParcelEditor } from "./components/ParcelEditor";
import { ReportView } from "./components/ReportView";
import { Disclaimer, ResultsPanel } from "./components/ResultsPanel";
import { EmploymentForm, LawyerForm, TaxForm } from "./components/ScenarioForms";
import { SourcesPanel } from "./components/SourcesPanel";
import { Button } from "./components/ui";
import { exportScenarioJson, importScenarioJson, parcelsToCsv } from "./domain/io/exchange";
import { useScenarios } from "./hooks/useScenarios";
import { download } from "./lib/format";

type Tab = "workbench" | "compare" | "analysis" | "report" | "sources";
const TABS: { id: Tab; label: string }[] = [
  { id: "workbench", label: "Workbench" },
  { id: "compare", label: "Compare" },
  { id: "analysis", label: "Analysis" },
  { id: "report", label: "Report" },
  { id: "sources", label: "Sources" },
];

export default function App() {
  const st = useScenarios();
  const [tab, setTab] = useState<Tab>("workbench");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { active: s, activeResult: r } = st;
  const upd = (fn: Parameters<typeof st.update>[0]) => st.update(fn);
  const slug = s.name.replace(/[^\w-]+/g, "_");

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      st.importScenario(importScenarioJson(await f.text()));
      setMsg(`Imported ${f.name}`);
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message.slice(0, 200) : "invalid file"}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Settlement IRS Workbench</h1>
          <p className="text-xs text-stone-500">Portuguese employment-termination scenarios · estimates, not advice</p>
        </div>
        <nav aria-label="Sections" className="flex gap-1 rounded-lg bg-stone-200/60 p-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-white shadow-sm" : "text-stone-600 hover:text-stone-900"}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white p-2">
        <div role="tablist" aria-label="Scenarios" className="flex flex-wrap gap-1">
          {st.scenarios.map((x) => (
            <button key={x.id} role="tab" type="button" aria-selected={x.id === s.id} onClick={() => st.select(x.id)} className={`rounded-md px-3 py-1.5 text-sm ${x.id === s.id ? "bg-stone-900 text-white" : "bg-stone-100 hover:bg-stone-200"}`}>
              {x.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <input aria-label="Scenario name" className="w-40 rounded-md border border-stone-300 px-2 py-1 text-sm" value={s.name} onChange={(e) => upd((x) => ((x.name = e.target.value), x))} />
          <Button variant="primary" onClick={() => st.duplicate()} title="Create an independent copy to tweak and compare">Duplicate scenario</Button>
          <Button onClick={st.add}>New</Button>
          <Button variant="danger" disabled={st.scenarios.length <= 1} onClick={() => confirm(`Delete "${s.name}"?`) && st.remove(s.id)}>Delete</Button>
          <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden />
          <Button onClick={() => download(`${slug}.json`, exportScenarioJson(s))}>Export JSON</Button>
          <Button onClick={() => download(`${slug}-parcels.csv`, parcelsToCsv(s, r), "text/csv")}>Export CSV</Button>
          <Button onClick={() => fileRef.current?.click()}>Import</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import scenario JSON" onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
        {msg && <p role="status" className="w-full text-xs text-stone-600">{msg} <button className="underline" onClick={() => setMsg(null)}>dismiss</button></p>}
      </div>

      {tab === "workbench" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <EmploymentForm scenario={s} result={r} update={upd} />
            <TaxForm scenario={s} result={r} update={upd} />
            <ParcelEditor scenario={s} result={r} update={upd} />
            <LawyerForm scenario={s} result={r} update={upd} />
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <ResultsPanel scenario={s} result={r} />
          </div>
        </div>
      )}
      {tab === "compare" && <ComparePanel scenarios={st.scenarios} results={st.results} onOpen={(id) => { st.select(id); setTab("workbench"); }} onDuplicate={(id) => st.duplicate(id)} />}
      {tab === "analysis" && <AnalysisPanel scenario={s} update={upd} />}
      {tab === "report" && <ReportView scenario={s} result={r} />}
      {tab === "sources" && <SourcesPanel />}

      <footer className="no-print mt-8"><Disclaimer /></footer>
    </div>
  );
}
