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
  "Exportar" downloads them as a JSON file and "Importar" loads one back (`domain/file.ts` validates it).
  "Importar" also accepts last year's "Demonstração de Liquidação de IRS" PDF: `lib/pdfText.ts` extracts its
  text with pdf.js (loaded on demand) and `domain/liquidacao.ts` reads deductions from tax, disability,
  benefício municipal and the IRS Jovem year from it. Income is not imported.
- Money uses `decimal.js`; values are rounded half-up to cents at each reported stage (see `domain/money.ts`).

## Rules coverage (tax year 2026 only)
Modelled: Category A brackets, specific deduction (or contributions if higher), Category B simplified regime
coefficients, employee and self-employed social security, deductions from tax as one total, IRS Jovem
(art. 12-B exemption, exempt income counted to set the rate), benefício municipal, disability >= 60%
(art. 56-A 85% rule capped at €2,500 per category; art. 87 credit of 4 x IAS), solidarity surcharge,
withholding balance.

Not modelled (shown as such in the app): IRS Jovem eligibility checks, mínimo de existência, art. 78 caps on deductions,
joint taxation, organised accounting, other income categories, autonomous regions.

## Must be verified against official text before relying on the numbers
Figures came from secondary sources (see the sources section in the app): 2026 bracket limits and rates;
IAS €537.13; specific deduction €4,587.09; art. 56-A / art. 87 disability amounts; social security rates;
IRS Jovem shares and cap, and that the Category B exemption applies to gross income before the coefficient
(inferred from a real assessment).
