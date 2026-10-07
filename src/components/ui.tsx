import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import type { ValidationIssue } from "../domain/calculations/types";

export const issueFor = (issues: ValidationIssue[], field: string) => issues.find((i) => i.field === field);

export function Card({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-stone-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, issue, children }: { label: string; hint?: string; issue?: ValidationIssue; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-600">{label}</label>
      {children(id, issue || hint ? msgId : undefined)}
      {(issue || hint) && (
        <p id={msgId} className={`text-xs ${issue ? (issue.severity === "error" ? "text-red-700" : "text-amber-700") : "text-stone-500"}`}>
          {issue ? `${issue.severity === "error" ? "Error: " : "Check: "}${issue.message}` : hint}
        </p>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-600";

export function TextInput({ id, describedBy, value, onChange, type = "text", placeholder }: { id?: string; describedBy?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input id={id} aria-describedby={describedBy} className={inputCls} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** Numeric input that keeps its own text while typing and commits parsed numbers. */
export function NumberInput({ id, describedBy, value, onChange, step = 1, suffix, invalid, min }: { id?: string; describedBy?: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; invalid?: boolean; min?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value ? t : String(value)));
  }, [value]);
  return (
    <div className="relative">
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={`${inputCls} num text-right ${suffix ? "pr-7" : ""} ${invalid ? "border-red-500" : ""}`}
        type="number"
        inputMode="decimal"
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

export function Select<T extends string>({ id, describedBy, value, onChange, options }: { id?: string; describedBy?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select id={id} aria-describedby={describedBy} className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Button({ children, onClick, variant = "default", disabled, title, ...rest }: { children: ReactNode; onClick?: () => void; variant?: "default" | "primary" | "ghost" | "danger"; disabled?: boolean; title?: string } & Record<string, unknown>) {
  const v = {
    default: "border border-stone-300 bg-white hover:bg-stone-50",
    primary: "bg-stone-900 text-white hover:bg-stone-700",
    ghost: "hover:bg-stone-100",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${v}`} {...rest}>
      {children}
    </button>
  );
}

export const Badge = ({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "green" | "amber" | "red" | "blue" }) => {
  const t = { stone: "bg-stone-100 text-stone-700", green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", red: "bg-red-50 text-red-800", blue: "bg-blue-50 text-blue-800" }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
};

export const Disclosure = ({ summary, children }: { summary: ReactNode; children: ReactNode }) => (
  <details className="group rounded-md border border-stone-200 bg-stone-50/50">
    <summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-stone-700">{summary}</summary>
    <div className="border-t border-stone-200 px-3 py-2 text-sm">{children}</div>
  </details>
);
