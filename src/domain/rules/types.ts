/** A cited legal/administrative source. Lives in the registry, never in React components. */
export interface RuleSource {
  id: string;
  jurisdiction: "PT";
  /** Tax year the rule is valid for. `null` = not year specific. */
  taxYear: number | null;
  title: string;
  /** Article / reference, e.g. "CIRS art. 2(4)(b)". */
  legalReference: string;
  description: string;
  /** Where the rule was read. Official URLs only appear here. */
  url?: string;
  /** Date (ISO) this source was last consulted. */
  accessed: string;
  /** How well verified the encoded rule is. */
  verification: "primary-text-read" | "secondary-source" | "needs-verification";
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface Bracket {
  /** Upper bound of the bracket (inclusive), null = open ended. */
  upTo: number | null;
  rate: number; // 0.125 = 12.5%
}

/** Everything the engine needs for one tax year. Pure data. */
export interface TaxYearRules {
  taxYear: number;
  /** Indexante dos Apoios Sociais (EUR). */
  ias: number;
  brackets: Bracket[];
  /** Category A specific deduction (art. 25 CIRS) in EUR. */
  specificDeductionCatA: number;
  disability: {
    /** Minimum permanent incapacity (%) to be "fiscally relevant" (art. 2 EBF / 56-A / 87). */
    minIncapacityPct: number;
    /** art. 56-A: share of gross category A income that is still considered (0.85). */
    categoryAConsideredShare: number;
    /** art. 56-A: cap on the excluded part, per category (EUR). */
    maxExcludedPerCategory: number;
    /** art. 87: tax-credit expressed as multiples of IAS for the taxpayer. */
    taxpayerCreditIasMultiple: number;
  };
  solidarity: { from: number; to: number | null; rate: number }[];
  /** IRS Jovem (art. 12-B CIRS): exempt share of Category A and B gross income by benefit year. */
  irsJovem: {
    /** Index 0 = 1st year of income after studies. */
    exemptShareByYear: number[];
    /** Yearly cap on the exempt amount, in multiples of IAS. */
    capIasMultiple: number;
  };
  /** Highest share of the tax a municipality may hand back (benefício municipal, Lei 73/2013 art. 26). */
  maxMunicipalBenefit: number;
  socialSecurity: {
    /** Employee contribution rate on Category A gross pay (0.11 = 11%). */
    employeeRate: number;
    /** Self-employed contribution rate (applied to the relevant income). */
    selfEmployedRate: number;
    /** Share of Category B gross that is "relevant income" for contributions (services). */
    selfEmployedBase: number;
  };
  /** Simplified-regime coefficients for Category B (art. 31 CIRS), share of gross that is taxable. */
  categoryBCoefficients: { id: string; label: string; coefficient: number }[];
  sourceIds: string[];
}
