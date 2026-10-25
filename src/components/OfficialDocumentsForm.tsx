import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { IncomeInput } from "../domain/income";
import { NotALiquidacaoError, parseLiquidacao, patchFromLiquidacao } from "../domain/liquidacao";
import { NotAModelo3Error, parseModelo3, patchFromModelo3 } from "../domain/modelo3";
import { fmtEur } from "../lib/format";
import { pdfToPages } from "../lib/pdfText";

const toPct = (f: number) => Math.round(f * 10000) / 100;

type Message = { ok: boolean; text: string };

interface Props {
  taxYear: number;
  /** Category B coefficient that `null` stands for in the input. */
  defaultCoefficient: number;
  onChange: (update: (x: IncomeInput) => IncomeInput) => void;
}

const fileCls =
  "block w-full text-xs text-stone-600 file:mr-3 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-stone-700 hover:file:bg-stone-50";

/** Reads last year's PDFs from Portal das Finanças: one input per document, one button to import both. */
export function OfficialDocumentsForm({ taxYear, defaultCoefficient, onChange }: Props) {
  const modelo3Ref = useRef<HTMLInputElement>(null);
  const liquidacaoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const importModelo3 = async (file: File): Promise<Message> => {
    const m = parseModelo3(await pdfToPages(await file.arrayBuffer()));
    const p = patchFromModelo3(m);
    onChange((x) => ({
      ...x,
      employment: p.employment,
      employmentPeriod: "annual",
      employeeSsRate: p.employeeSsRate,
      selfEmployed: p.selfEmployed,
      selfEmployedCoefficient: p.selfEmployedCoefficient === defaultCoefficient ? null : p.selfEmployedCoefficient,
    }));
    const parts = [
      `categoria A ${fmtEur(p.employment, true)} por ano`,
      ...(p.employeeSsRate !== null ? [`Segurança Social de ${toPct(p.employeeSsRate)}% (contribuições declaradas)`] : []),
      `categoria B ${fmtEur(p.selfEmployed, true)}`,
      ...(p.selfEmployedCoefficient !== null ? [`coeficiente ${toPct(p.selfEmployedCoefficient)}%`] : []),
    ];
    const skipped = p.skippedCodes.length ? ` Códigos do anexo B não importados: ${p.skippedCodes.join(", ")}.` : "";
    return { ok: true, text: `Da declaração Modelo 3${m.year ? ` de ${m.year}` : ""}: ${parts.join(", ")}. Ajuste se este ano for diferente.${skipped}` };
  };

  const importLiquidacao = async (file: File): Promise<Message> => {
    const liq = parseLiquidacao((await pdfToPages(await file.arrayBuffer())).join("\n"));
    const p = patchFromLiquidacao(liq, taxYear);
    onChange((x) => ({
      ...x,
      taxDeductions: p.taxDeductions,
      municipalBenefit: p.municipalBenefit,
      irsJovemYear: p.irsJovemYear,
      disabilityPct: p.hasDisability ? Math.max(x.disabilityPct, 60) : x.disabilityPct,
    }));
    const parts = [
      `deduções à coleta ${fmtEur(p.taxDeductions, true)}${p.hasDisability ? " (sem a dedução por deficiência, que a calculadora aplica)" : ""}`,
      `benefício municipal ${toPct(p.municipalBenefit)}%`,
      p.irsJovemYear ? `IRS Jovem ${p.irsJovemYear}.º ano em ${taxYear}` : "sem IRS Jovem",
      ...(p.hasDisability ? ["incapacidade de 60% ou mais"] : []),
    ];
    return { ok: true, text: `Da nota de liquidação${liq.year ? ` de ${liq.year}` : ""}: ${parts.join(", ")}.` };
  };

  const run = async (file: File, importer: (f: File) => Promise<Message>, wrong: unknown): Promise<Message> => {
    try {
      return await importer(file);
    } catch (e) {
      if (!(e instanceof Error) || e.constructor === Error) console.error(e);
      const known = typeof wrong === "function" && e instanceof (wrong as new () => Error);
      return { ok: false, text: `${file.name}: ${known ? (e as Error).message : "não foi possível ler o ficheiro."}` };
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const modelo3 = modelo3Ref.current?.files?.[0];
    const liquidacao = liquidacaoRef.current?.files?.[0];
    if (!modelo3 && !liquidacao) {
      setMessages([{ ok: false, text: "Escolha pelo menos um documento." }]);
      return;
    }
    setBusy(true);
    const out: Message[] = [];
    if (modelo3) out.push(await run(modelo3, importModelo3, NotAModelo3Error));
    if (liquidacao) out.push(await run(liquidacao, importLiquidacao, NotALiquidacaoError));
    setMessages(out);
    setBusy(false);
    for (const ref of [modelo3Ref, liquidacaoRef]) if (ref.current) ref.current.value = "";
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-stone-500">
        PDFs do Portal das Finanças do ano passado. Preenchem os campos abaixo; ambos são opcionais e ficam no seu navegador.
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
        Declaração Modelo 3 (rendimentos)
        <input ref={modelo3Ref} type="file" accept="application/pdf,.pdf" className={fileCls} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
        Nota de liquidação de IRS (deduções, deficiência, IRS Jovem, benefício municipal)
        <input ref={liquidacaoRef} type="file" accept="application/pdf,.pdf" className={fileCls} />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
      >
        {busy ? "A importar…" : "Importar documentos"}
      </button>
      {messages.map((m, k) => (
        <p key={k} role={m.ok ? "status" : "alert"} className={`rounded-md px-3 py-2 text-xs ${m.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {m.text}
        </p>
      ))}
    </form>
  );
}
