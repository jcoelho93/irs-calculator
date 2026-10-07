# Settlement IRS Workbench

Scenario playground for Portuguese employment-termination settlements: split a settlement into parcels,
configure lawyer fees, and compare estimated IRS and net cash across scenarios. **Estimates only, not advice.**

```
npm install
npm run dev        # app
npm test           # engine unit tests (vitest)
npm run build
```

## Architecture
- `src/domain/` is framework-free: `rules/` (per-year data + sources registry), `tax/` (IRS brackets, termination threshold),
  `calculations/` (`calculateScenario(scenario, rules) => CalculationResult`, lawyer fees, validation, sensitivity, optimisation),
  `scenario/` (types, zod schema, defaults, migration), `io/` (JSON/CSV).
- `src/components/`, `src/hooks/` are UI only. Persistence is localStorage; exports carry `{ version, scenario }`.
- Money uses `decimal.js`; values are rounded half-up to cents at each reported stage (see `domain/money.ts`).

## Rules coverage (tax year 2026 only)
Modelled: Category A brackets, specific deduction, termination-compensation threshold (art. 2(4)(b) CIRS),
disability >= 60% (art. 56-A 85% rule capped at €2,500; art. 87 credit of 4 x IAS), solidarity surcharge,
final IRS vs withholding, IRS attributable to the settlement (with minus without).

Not modelled (shown as such in the app): dependent/expense deductions, mínimo de existência, joint taxation,
social security on arrears, art. 2(4)(a) managers, disability companion/rehabilitation deductions.

## Must be verified against official text before relying on the numbers
The build sandbox could not reach Portal das Finanças/DRE; figures came from secondary sources (see the Sources tab):
1. 2026 bracket limits and rates; IAS €537.13; specific deduction €4,587.09.
2. That the excess over the termination threshold is taxed at 100% (`excessInclusionRate` in `rules/pt2026.ts`).
3. Art. 56-A / art. 87 disability amounts, and that the 56-A exclusion applies to the settlement's taxable part.
4. Tax treatment of damages and reimbursed legal costs (no article verified; modelled as explicit, overridable assumptions).
