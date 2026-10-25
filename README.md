# Calculadora de rendimento e IRS

Single-screen estimator of Portuguese net income and IRS. Enter employment (Category A) and self-employed
(Category B) income plus your deductions from tax, and see social security, IRS, net yearly and monthly
income, and effective and marginal rates. Everything else (Category B coefficient, social security rates,
specific deduction, the IRS bracket table, solidarity surcharge, disability, withholding) sits under
"Opções avançadas" with sensible defaults. **Estimates only, not advice.**

```
npm install
npm run dev        # app
npm test           # engine unit tests (vitest)
npm run build
```

## Architecture
- `src/domain/` is framework-free: `rules/` (per-year data + sources registry), `tax/irs.ts` (brackets,
  art. 56-A/87 disability, solidarity, deductions from tax), `income.ts` (`calculateIncome(input) => IncomeResult`,
  applies the user's overrides on top of the year's rules).
- `src/components/` is UI only. Inputs are kept in localStorage in the browser and never sent anywhere.
  "Exportar" downloads a simulation as a JSON file and "Importar" loads one back (`domain/file.ts` validates it).
  A separate "Documentos oficiais" form (`OfficialDocumentsForm.tsx`) takes last year's PDFs from Portal das
  Finanças, one input per document and a single button: `lib/pdfText.ts` extracts their text
  with pdf.js (legacy build, loaded on demand). `domain/modelo3.ts` reads Category A and B income from the
  Modelo 3 comprovativo; `domain/liquidacao.ts` reads deductions from tax, disability, benefício municipal
  and the IRS Jovem year from the "Demonstração de Liquidação de IRS".
- Money uses `decimal.js`; values are rounded half-up to cents at each reported stage (see `domain/money.ts`).

## Rules coverage (tax year 2026 only)
Modelled: Category A brackets, specific deduction (or contributions if higher), Category B simplified regime
coefficients, employee and self-employed social security, deductions from tax as one total, IRS Jovem
(art. 12-B exemption, exempt income counted to set the rate), benefício municipal, disability >= 60%
(art. 56-A 85% rule capped at €2,500 per category; art. 87 credit of 4 x IAS), solidarity surcharge,
withholding balance, other taxable income (taxed with Category A, no social security) and non-taxable income.

Not modelled (shown as such in the app): IRS Jovem eligibility checks, mínimo de existência, art. 78 caps on deductions,
joint taxation, organised accounting, other income categories, autonomous regions.

## Verification status
Read against the official text on 2026-10-25: 2026 bracket limits and rates (art. 68), solidarity surcharge
(art. 68-A), specific deduction and IAS €537.13 (art. 25, Portaria 480-A/2025/1), art. 87 credit, Category B
coefficients (art. 31).

Still from secondary sources or inferred: art. 56-A amounts and the order of its calculation; social security
rates (employee 11%, self-employed 21.4% on 70%); IRS Jovem shares and cap (art. 12-B) and that the Category B
exemption applies to gross income before the coefficient (inferred from a real assessment).
