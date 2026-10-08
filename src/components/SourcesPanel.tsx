import { SOURCES } from "../domain/rules";
import { Badge, Card } from "./ui";

const VERIFICATION = {
  "primary-text-read": "texto oficial lido",
  "secondary-source": "fonte secundária",
  "needs-verification": "a verificar",
} as const;

export function SourcesPanel() {
  return (
    <Card title="Regras, fontes e estado de verificação">
      <p className="mb-3 text-sm text-stone-600">
        Cada regra aplicada, a sua referência legal e o grau de verificação. As regras marcadas como <i>fonte secundária</i> ou <i>a verificar</i> devem ser confirmadas no texto oficial antes de confiar nos valores.
      </p>
      <ul className="flex flex-col gap-3">
        {SOURCES.map((s) => (
          <li key={s.id} className="rounded-md border border-stone-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.title}</span>
              <Badge tone={s.verification === "primary-text-read" ? "green" : s.verification === "secondary-source" ? "amber" : "red"}>{VERIFICATION[s.verification]}</Badge>
              <Badge>{s.taxYear ?? "todos os anos"}</Badge>
            </div>
            <div className="mt-1 text-xs text-stone-500">{s.legalReference} · desde {s.effectiveFrom}{s.effectiveTo ? ` até ${s.effectiveTo}` : ""} · consultado em {s.accessed}</div>
            <p className="mt-1.5 text-stone-700">{s.description}</p>
            {s.url && <a className="mt-1 inline-block break-all text-xs text-blue-700 underline" href={s.url} target="_blank" rel="noreferrer noopener">{s.url}</a>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
