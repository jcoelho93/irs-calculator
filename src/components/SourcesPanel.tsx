import { SOURCES } from "../domain/rules";
import { Badge, Card } from "./ui";

export function SourcesPanel() {
  return (
    <Card title="Rules, sources and verification status">
      <p className="mb-3 text-sm text-stone-600">
        Every encoded rule, its legal reference and how well it was verified. Rules marked <i>secondary source</i> or <i>needs verification</i> should be confirmed against the official text before relying on the numbers.
      </p>
      <ul className="flex flex-col gap-3">
        {SOURCES.map((s) => (
          <li key={s.id} className="rounded-md border border-stone-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.title}</span>
              <Badge tone={s.verification === "primary-text-read" ? "green" : s.verification === "secondary-source" ? "amber" : "red"}>{s.verification.replace(/-/g, " ")}</Badge>
              <Badge>{s.taxYear ?? "all years"}</Badge>
            </div>
            <div className="mt-1 text-xs text-stone-500">{s.legalReference} · from {s.effectiveFrom}{s.effectiveTo ? ` to ${s.effectiveTo}` : ""} · accessed {s.accessed}</div>
            <p className="mt-1.5 text-stone-700">{s.description}</p>
            {s.url && <a className="mt-1 inline-block break-all text-xs text-blue-700 underline" href={s.url} target="_blank" rel="noreferrer noopener">{s.url}</a>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
