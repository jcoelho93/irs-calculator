import { useCallback, useEffect, useMemo, useState } from "react";
import { duplicateScenario, newScenario } from "../domain/scenario/defaults";
import { scenarioSchema } from "../domain/scenario/schema";
import { SCHEMA_VERSION } from "../domain/scenario/types";
import type { Scenario } from "../domain/scenario/types";
import { calculateScenario } from "../domain/calculations/scenario";
import { getTaxRules, supportedTaxYears } from "../domain/rules";
import type { CalculationResult } from "../domain/calculations/types";

const KEY = "irs-settlement-workbench";

interface Persisted {
  version: number;
  scenarios: Scenario[];
  activeId: string;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.version <= SCHEMA_VERSION && Array.isArray(p.scenarios)) {
        const scenarios = p.scenarios.map((s: unknown) => scenarioSchema.parse(s) as Scenario);
        if (scenarios.length) return { version: SCHEMA_VERSION, scenarios, activeId: scenarios.some((s: Scenario) => s.id === p.activeId) ? p.activeId : scenarios[0].id };
      }
    }
  } catch {
    /* corrupt or unavailable storage: fall back to the seed */
  }
  const s = newScenario("Scenario A");
  return { version: SCHEMA_VERSION, scenarios: [s], activeId: s.id };
}

/** Calculation with graceful fallback when the tax year has no rules (validation shows the error). */
export function safeCalculate(s: Scenario): CalculationResult {
  const year = supportedTaxYears().includes(s.tax.taxYear) ? s.tax.taxYear : supportedTaxYears()[0];
  return calculateScenario(s, getTaxRules(year));
}

export function useScenarios() {
  const [state, setState] = useState<Persisted>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full/unavailable: keep working in memory */
    }
  }, [state]);

  const active = state.scenarios.find((s) => s.id === state.activeId) ?? state.scenarios[0];
  const results = useMemo(() => new Map(state.scenarios.map((s) => [s.id, safeCalculate(s)])), [state.scenarios]);

  const update = useCallback((fn: (s: Scenario) => Scenario, id?: string) => {
    setState((st) => ({
      ...st,
      scenarios: st.scenarios.map((s) => (s.id === (id ?? st.activeId) ? { ...fn(structuredClone(s)), updatedAt: new Date().toISOString() } : s)),
    }));
  }, []);

  const add = useCallback(() => {
    setState((st) => {
      const s = newScenario(`Scenario ${String.fromCharCode(65 + (st.scenarios.length % 26))}`);
      return { ...st, scenarios: [...st.scenarios, s], activeId: s.id };
    });
  }, []);

  const duplicate = useCallback((id?: string) => {
    setState((st) => {
      const src = st.scenarios.find((s) => s.id === (id ?? st.activeId))!;
      const copy = duplicateScenario(src);
      return { ...st, scenarios: [...st.scenarios, copy], activeId: copy.id };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setState((st) => {
      if (st.scenarios.length <= 1) return st;
      const scenarios = st.scenarios.filter((s) => s.id !== id);
      return { ...st, scenarios, activeId: st.activeId === id ? scenarios[0].id : st.activeId };
    });
  }, []);

  const select = useCallback((id: string) => setState((st) => ({ ...st, activeId: id })), []);

  const importScenario = useCallback((s: Scenario) => {
    setState((st) => {
      const copy = duplicateScenario(s, s.name);
      return { ...st, scenarios: [...st.scenarios, copy], activeId: copy.id };
    });
  }, []);

  return { scenarios: state.scenarios, active, activeResult: results.get(active.id)!, results, update, add, duplicate, remove, select, importScenario };
}
