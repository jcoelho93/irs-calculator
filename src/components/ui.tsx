import { useId } from "react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export const Disclaimer = () => (
  <p className="text-xs leading-relaxed text-stone-500">
    This calculator provides estimates for scenario analysis and does not constitute tax, legal, or financial advice. Portuguese tax treatment depends on the facts, legal wording and applicable legislation. Verify material conclusions with a qualified Portuguese tax professional or lawyer.
  </p>
);

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white ${className}`}>
      {title && (
        <header className="border-b border-stone-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-stone-800">{title}</h2>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const inputCls = "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-600";

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-700">{label}</label>
      {children(id, hint ? hintId : undefined)}
      {hint && <p id={hintId} className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function TextInput({ id, describedBy, value, onChange, type = "text" }: { id?: string; describedBy?: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <input id={id} aria-describedby={describedBy} className={inputCls} type={type} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Numeric input that keeps its own text while typing and commits parsed numbers. */
export function NumberInput({ id, describedBy, value, onChange, step = 1, suffix, min }: { id?: string; describedBy?: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; min?: number }) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value ? t : value === 0 ? "" : String(value)));
  }, [value]);
  return (
    <div className="relative">
      <input
        id={id}
        aria-describedby={describedBy}
        className={`${inputCls} num text-right ${suffix ? "pr-7" : ""}`}
        type="number"
        inputMode="decimal"
        placeholder="0"
        step={step}
        min={min}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = e.target.value === "" ? 0 : Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-stone-500">{suffix}</span>}
    </div>
  );
}

export const Badge = ({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "green" | "amber" | "red" }) => {
  const t = { stone: "bg-stone-100 text-stone-700", green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-800" }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
};
