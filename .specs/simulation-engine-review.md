# Simulation Engine Code Review

Read-only review performed 2026-11-14 against commit `08d8d5b` (branch `variable-social-security`).

Scope: `src/engine/simulationEngine.ts`, `src/engine/taxRates.ts`, `src/engine/stateTaxRegistry.ts`
(Maryland in detail), `src/engine/monteCarloEngine.ts`, `src/engine/taxEquilibriumEngine.ts`,
`src/engine/optimizer.ts`, and the default inputs in `src/App.tsx`. The Expenser app was excluded.
`bucketEngine.ts` and `rebalancingEngine.ts` were not reviewed because the simulation engine does not
import them.

Ranking weights each item by how much it can move the numbers a decision rests on, times how likely it
is to trigger with the current configuration (MD resident, MFJ, husband born 1960 with longevity 85,
wife born 1964 with longevity 95). Several items only fire in survivor mode when the wife predeceases,
which the defaults do not do, so they rank below things that bias every run.

Line numbers refer to the files as of the commit above and will drift as fixes land.

## Status tracker

Use this table to track what has been debated and fixed.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Year-end tax settlement income never taxed | High | Fixed |
| 2 | MC mean reversion / regime vol narrows distribution | High | Fixed |
| 3 | Historical bootstrap arithmetic vs geometric calibration | Medium-High | Fixed |
| 4 | Survivor (wife first): husband's cash wiped out | High (latent) | Fixed |
| 5 | Survivor (wife first): Roth conversions stop | Medium-High (latent) | Fixed |
| 6 | No federal basis step-up unless FL | Medium | Fixed |
| 7 | TE optimizer nominal income vs un-inflated brackets | Medium-High | Fixed |
| 8 | OBBBA 2025 federal changes not modeled | Medium | Fixed |
| 9 | Maryland state tax errors and stale values | Medium | Fixed |
| 10 | 2026 LTCG thresholds look overstated | Low-Medium | Fixed |
| 11 | IRMAA thresholds inflated to lookback year | Low-Medium | Fixed |
| 12 | Survivor filing-status inconsistencies | Low | Fixed |
| 13 | Spousal benefit formula | Low-Medium | Fixed |
| 14 | Survivor benefit 100% from age 60 | Low | Fixed |
| 15 | SS earnings test not modeled | Low | Open |
| 16 | Stale 2025 statutory constants | Low | Fixed |
| 17 | MC sequences hard-capped at 35 years | Low-Medium | Fixed |
| 18 | Bear-market rule uses look-ahead | Low-Medium | Fixed |
| 19 | RMD counted when not distributed; cross-spouse QCD | Low | Fixed |
| 20 | Minor tax-base omissions | Low | Fixed |
| 21 | Modeling assumptions to make explicit | Info | Open |

---

## 1. Taxes paid at year-end from brokerage or IRA are never taxed themselves

**Severity: High (affects every run, compounds over time)**

**What I found.** Final taxes are computed at `simulationEngine.ts:1824-1892` using the year's realized
capital gains (`annualCapitalGainsTriggered`) and pre-tax draws (`annualYourTradDraw`). Then, at
`simulationEngine.ts:1898-1994`, the net tax settlement is funded by selling brokerage (Step 2) or
drawing from the pre-tax IRA (Step 3). Those draws append to `annualCapitalGainsTriggered` and
`annualYourTradDraw` *after* the tax was already calculated. The accumulators are then reset at the
next year's start, so the income is lost. It is written to the ledger row as `capitalGainsTriggered`,
so the row shows gains that were never taxed.

**Why it matters.** Every dollar of tax paid by selling appreciated brokerage shares (default basis
ratio 0.7, so 30 cents of gain per dollar) or by drawing from the IRA (100 cents of ordinary income per
dollar) creates income the engine never sees. Early in retirement the settlement is modest. In later
years, when brokerage and cash are depleted and large RMD-driven tax bills get paid from the IRA, the
leak can be tens of thousands of untaxed ordinary income per year. That understates lifetime taxes and
overstates ending estate, and it is worst precisely in the scenarios you would want to stress. It also
feeds the tax equilibrium engine, which reads `capitalGainsTriggered` from the ledger.

**Recommendation.** Carry settlement-step gains and IRA draws forward as "prior-year tax-funding
income" taxed in the following year (realistic, since the April settlement is a next-year event), or
iterate the settlement once: recompute tax including the funding income and re-settle the delta. The
carry-forward is simpler and matches how it actually works on a real return.

**Resolution.** Fixed with the carry-forward. Gains and pre-tax draws created by funding the year-end
settlement are carried into the next year's taxable-income accumulators as prior-year tax-funding
income. The ledger now separates cash flow (`drawdownPreTax`, `drawdownTaxable`) from income taxed in
the year (`otherTaxableIncome`, `capitalGainsTriggered`), and exposes the carried-in amounts as
`priorYearTaxFundingGains` and `priorYearTaxFundingPreTaxDraw`. Known limits: nothing is carried out
of an actual-record year (its simulated settlement is replaced by real balances and real tax), the
carry out of the final plan year is never taxed, and the carried income is not included in the
quarterly estimated-tax precompute, so its tax surfaces in that year's settlement.

---

## 2. Monte Carlo mean reversion and regime switching narrow the outcome distribution and bias the success rate upward

**Severity: High (modeling assumption that directly affects the headline success-rate metric)**

**What I found.** In `monteCarloEngine.ts:160-205`, when regime switching is on (the default), an
Ornstein-Uhlenbeck correction pulls each year's expected equity return toward the long-run geometric
target: 20% of the cumulative tracking gap, clamped to plus or minus 4%. After a 30% drawdown the gap is
large enough that every subsequent year gets the full +4% boost until the portfolio catches back up.
That is a strong self-correcting force, and it means bad early sequences systematically heal.

Separately, the regime mixture inflates effective volatility beyond what you entered: 80% of years at
0.85x vol, 20% at 1.5x vol, plus between-regime variance from the -8% crisis mean. With a 16% input,
the effective unconditional sigma is roughly 17-18%. The volatility-drag compensation on line 138 is
computed from the original 16%, so the median compound path lands a bit below the target CAGR, but the
mean reversion then masks that.

**Why it matters.** The entire reason to run Monte Carlo is sequence-of-returns risk. Mean reversion
at this strength dampens exactly that risk. Academic evidence for equity mean reversion is weak at
annual horizons and absent at the strength modeled here. The p10 line and the success rate will look
better than the input CMA justifies. If you are using the success rate to decide how much you can spend
or convert, it is optimistic.

**Recommendation.** Turn off the OU adjustment by default (or set kappa near 0.03-0.05 and drop the
clamp to 1%), and re-derive the per-regime vol multipliers so the unconditional variance matches the
entered volatility. Keep regime switching as an opt-in feature, but document that it is not a
CMA-faithful simulation. At minimum, let the UI show both "CMA-faithful" and "regime/mean-reversion"
success rates so you see the spread.

**Resolution.** Fixed by removal. The regime-switching generator and the Ornstein-Uhlenbeck correction
were deleted, along with the crisis-state stagflation CPI oversampling and the `enableRegimeSwitching`
setting (the field is still accepted when loading old plans but ignored). The synthetic mode is now
independent annual draws from a correlated normal distribution with the volatility-drag drift
(`geometricToArithmeticMean`). Findings that drove the decision, measured on 4,000 synthetic 30-year
paths (7% CAGR, 16% volatility):

- The regime model produced no bear-market clustering (average run of negative years 1.38 versus 1.42
  for independent draws) and no post-loss rebound (mean return after a negative year 8.2% in both).
  Long strong streaks were more common (5+ years above 10% in 31% of paths versus 25%).
- The mean reversion only affected long horizons. At 30 years the 10th percentile terminal multiple
  was 3.08 versus 2.51 and the 90th percentile 13.7 versus 21.3. At 10 years the regime model's
  downside was worse, not better (5th percentile CAGR -3.0% versus -1.3%).
- On the sample plan, regime-on versus regime-off success rates were within about one point in the
  80-95% range, and up to seven points lower with regimes on when the plan was already failing. The
  original claim that the success rate was biased upward was not supported in the realistic range.
- The regime parameters (20% crisis probability, -8% crisis mean, 0.85 and 1.5 volatility multipliers)
  were not estimated from data, so a "lower of two models" headline would have been noise.
- Annual stock returns in the table (1970-2025) have excess kurtosis 0.18 and skew -0.77: a fat
  downside tail, not symmetric fat tails, so a symmetric Student-t was not adopted.

Known limits: the parametric mode is symmetric and under-represents real crash years, and it has no
volatility clustering. The historical bootstrap mode is the real-history check, and the in-app help
says so.

---

## 3. Historical bootstrap calibrates the arithmetic mean to a geometric target

**Severity: Medium-High (the two Monte Carlo modes are not comparable)**

**What I found.** `equityReturnRate` is documented as a geometric CAGR ("Stated 30-year geometric
CAGR" in the CMA profile type). The synthetic generator correctly adds a drag term so the arithmetic
drift reproduces that CAGR (`monteCarloEngine.ts:137-139`). The historical generator instead shifts
each sampled year by `equityMean - HISTORICAL_STOCK_MEAN` (`monteCarloEngine.ts:286-291`), which sets
the *arithmetic* mean of the sample to the CAGR. With historical sigma around 16.5%, the realized
geometric mean will be about sigma-squared over 2, or ~1.3%, below your target.

**Why it matters.** Switching between modes changes the median outcome by over a percent per year of
compounding, which is a huge difference over 30 years, and the difference is a calibration artifact,
not a modeling insight.

**Recommendation.** Apply the same geometric-to-arithmetic drift conversion in
`generateHistoricalSequence` (shift to `equityMean + sigma^2/2`), using the historical sample's own
variance.

**Resolution.** Fixed. `generateHistoricalSequence` now centers the sample on the arithmetic mean
that corresponds to the configured geometric CAGR, using the historical sample's own volatility
(`HISTORICAL_STOCK_VOLATILITY`, `HISTORICAL_BOND_VOLATILITY`) and the same `geometricToArithmeticMean`
conversion the synthetic mode uses. The optional Student-t scaling uses the same baseline. The two
modes are now directly comparable. Expect historical-mode results to move up by roughly one percent
a year of compounding versus the previous calibration.

---

## 4. Survivor mode, wife predeceases: the husband's cash is wiped out

**Severity: High when triggered, latent with your defaults**

**What I found.** `simulationEngine.ts:537-538`:

```
yourCash += wifeCash;
yourCash = 0;
```

The second line should be `wifeCash = 0`. The combined cash is destroyed, and the wife's cash lingers
as a zombie balance that still counts in `totalPortfolioValue` but earns no interest and is excluded
from most draw logic (though Step 5 at line 1629 can still raid it).

**Why it matters.** It is an unambiguous bug. Any survivor scenario where the wife's longevity is
shorter than the husband's loses up to the full cash reserve in one year, then shows a misleading
portfolio total.

**Recommendation.** Change line 538 to `wifeCash = 0;`. Add a test for the wife-predeceases transition
that checks cash conservation.

**Resolution.** Fixed together with #5. The transition now zeroes `wifeCash`. The same block had a
second copy of the typo that the review missed: `yourRoth += wifeRoth; yourRoth = 0;` wiped the
husband's Roth balance and left the wife's behind, so it now zeroes `wifeRoth`. Tests cover the
wife-predeceases transition (her cash, Roth and pre-tax balances end at zero and the husband keeps
the combined Roth).

---

## 5. Survivor mode, wife predeceases: Roth conversions silently stop

**Severity: Medium-High when triggered, latent with your defaults**

**What I found.** The conversion code uses `isSurvivorActive || youDeceased ? wifePreTax : ...` at
`simulationEngine.ts:977`, `1040`, `1779` and `1788`. `isSurvivorActive` is true when *either* spouse
has died. When the wife dies first, her pre-tax balance has already been merged into `yourPreTax`, so
`wifePreTax` is zero, the available amount is zero, and every subsequent conversion is capped to
nothing. The flat, custom and fill-to-target strategies are all affected.

**Why it matters.** A survivor scenario where the husband outlives the wife and is now a single filer
is exactly when you would want to compare conversion strategies, and the engine quietly turns them off.

**Recommendation.** Branch on which spouse survives: if `youDeceased` use `wifePreTax`, else if
`wifeDeceased` use `yourPreTax`, else split. The same fix applies to the four sites listed.

**Resolution.** Fixed together with #4. Two per-year flags, `isSoleSurvivorWife` and
`isSoleSurvivorYou`, identify which spouse holds the merged pre-tax balance. The available-balance
caps and the conversion application (flat, custom and fill-to-target, in both the estimate and final
passes) use the survivor's own balance, and a husband survivor's conversion is credited to
`yourConverted`. Tests run all three strategies after a wife-first death.

---

## 6. No federal step-up in basis at death unless the state is Florida

**Severity: Medium (survivor scenarios)**

**What I found.** `simulationEngine.ts:508-515` and `528-535`: on death, the inherited brokerage
account gets a full step-up (basis = value) only if `isStateFL`; otherwise the old basis carries over
with no step-up at all.

**Why it matters.** The step-up is federal law (IRC 1014) and applies in every state. The
Florida/Maryland split looks like a community-property vs common-law distinction, but Florida is a
common-law state too, and in any case the accounts are modeled as separately owned ("your taxable" and
"wife taxable"), so the decedent's account should fully step up regardless. In Maryland the survivor is
being charged capital gains tax on gains that would be erased at death. For a $500k account at a 0.7
basis ratio that is $150k of phantom gain.

**Recommendation.** Apply a full step-up on the decedent's account in all states. If you want to model
joint accounts later, step up half.

**Resolution.** Fixed, with a corrected diagnosis. The finding's premise was wrong for non-FL states:
basis is tracked in dollars, so the old non-FL branch (`survivorBasis += decedentTaxable`) already gave
the decedent's account a full step-up and left the survivor's own basis alone, which is correct under
IRC 1014. The real defect was the FL branch, which also reset the survivor's own account to full basis
and erased its embedded gains. Both transitions now use the single state-independent rule and
`isStateFL` is gone. As part of making the engine state-agnostic:

- The Maryland-style pension exclusion was being computed in the engine and applied to every state. It is
  now data in the state registry (`pensionExclusionPolicy`) and read through `calculatePensionExclusion`,
  so states without a policy get none.
- `MD_PENSION_EXCLUSION_BASE_CAP`, `MD_PIGGYBACK_RATE` and the Maryland bracket tiers moved from
  `taxRates.ts` into the Maryland profile in `stateTaxRegistry.ts`.
- `resolveActiveJurisdiction` replaces the duplicated active-state logic, including the hard-coded
  MD/FL relocation toggle. A relocation whose target equals the current state now stays in that state.
- `calculateMDStateTax` became `calculateStateTax(stateCode, ...)`, and
  `applyBucketLiquidityConstraintToConversion` takes a plain `activeState` string.

Known limits: the UI components still default to `'MD'` and `'FL'` in places, and the `legacyMD`,
`legacyFL`, `costsMD` and `costsFL` expense data-model fields are a separate follow-up change.

---

## 7. Tax equilibrium optimizer compares nominal future taxable income to un-inflated bracket limits

**Severity: Medium-High (biases the Roth conversion recommendation toward over-converting)**

**What I found.** `calculateDynamicRMDHurdleRate` at `taxEquilibriumEngine.ts:117-126` finds the
marginal federal bracket with `taxableIncome <= b.limit` using the raw 2026 limits, while
`row.taxableIncome` is in nominal future dollars (cpiFactor can be 1.5-2.0 late in the plan). A $150k
nominal taxable income in 2050 is about $86k real, firmly in the 12% bracket, but the code reads it as
22%. The hurdle rate (the rate future RMDs are assumed to be taxed at) is therefore inflated, and the
optimizer keeps converting until today's marginal cost reaches that inflated hurdle.

Two smaller issues compound it: `row.taxableIncome` includes capital gains, which are not taxed at
ordinary rates, and the 1.85x SS torpedo multiplier at `taxEquilibriumEngine.ts:132-139` is applied to
the *entire* RMD whenever taxable SS is under 85%, even though most of a large RMD lands above the
point where SS is fully taxed.

**Recommendation.** Compare `taxableIncome` to `b.limit * row.cpiFactor`, subtract
`capitalGainsTriggered` plus qualified dividends from the ordinary base, and apply the torpedo
multiplier only to the portion of the RMD that sits inside the SS phase-in zone (or drop it to a
weighted average).

**Resolution.** Fixed in `calculateDynamicRMDHurdleRate`, all three parts:

- The bracket lookup now compares income to `b.limit * row.cpiFactor`, so nominal future income is
  measured against inflated limits, consistent with the existing `isSingle` check.
- The ordinary base is `taxableIncome - capitalGainsTriggered - qualifiedDividends`. The ledger row had
  only total dividends, so an optional `qualifiedDividends` field was added to `SimulationResultRow` and
  populated in `simulationEngine.ts` from the value already computed there.
- The torpedo multiplier is no longer all-or-nothing. Only the share of the RMD inside the SS phase-in
  zone (remaining taxable SS divided by `STATUTORY_MAX_TAXABLE_SS_PORTION`, over the RMD) gets the extra
  `STATUTORY_MAX_TAXABLE_SS_PORTION`, so the multiplier blends from 1.0 up to 1.85.

Tests in `taxEquilibriumEngine.test.ts` cover inflated brackets, the preferential-income exclusion and
the blended torpedo. Expect a lower hurdle rate and therefore less recommended conversion than before.

---

## 8. 2025 federal tax law changes (OBBBA) are not modeled

**Severity: Medium (affects 2026-2029, the years you are deciding conversions for now)**

**What I found.**

- **Senior deduction.** For 2025-2028, each taxpayer 65 or older gets an extra $6,000 deduction,
  phased out at 6% of MAGI above $150k MFJ / $75k single. Nowhere in the standard deduction logic
  (`simulationEngine.ts:1842-1851` and the two estimate copies at 1011-1020 and 1227-1236, plus
  1713-1722). Both of you are 65+ in 2026-2028, so that is $12,000/yr of missing deduction, worth
  $1,400-2,600/yr in tax and, more importantly, $12,000/yr of extra 12%-bracket room for conversions in
  2027-2028. The MAGI phase-out also interacts with conversions, so a fill-to-target conversion can claw
  it back.
- **SALT cap.** The cap is $40,000 for 2025, $40,400 for 2026, rising 1%/yr through 2029, then back to
  $10,000 in 2030 (phased down toward $10k above $500k MAGI). The engine uses a flat `10000 * cpiFactor`
  at `simulationEngine.ts:299`, `1261`, `1724` and `1876`. The $10k cap is also not inflation-indexed
  in law. Property tax is excluded from SALT entirely; for a Maryland homeowner that is several thousand
  more.
- **Charitable.** From 2026, itemized charitable deductions have a 0.5%-of-AGI floor, and non-itemizers
  get a $2,000 MFJ above-the-line deduction. Relevant because the tithing feature is counted as
  itemized at `simulationEngine.ts:1878`.

**Why it matters.** Whether you itemize depends on these numbers, and the near-term conversion room is
sensitive to them. With the senior deduction plus a $40k SALT cap plus tithing, you may itemize in
2026-2028 when the engine says you do not.

**Recommendation.** Add a year-keyed table of statutory values (SALT cap, senior deduction, charitable
floor) in `taxRates.ts`, named constants per the project rule, and look them up by simulation year.
Add property tax as an input (or let detailed expenses tag an item as SALT-eligible).

**Resolution.** Fixed. The five copies of the deduction logic in `simulationEngine.ts` (the liquidity
helper, the conversion estimate, the yearly estimate, the mid-year estimate and the final calculation)
now call one function, `calculateFederalDeduction`, in the new `federalDeduction.ts`. Statutory values
are named constants in `taxRates.ts`:

- Senior deduction: $6,000 per filer 65 or older for 2025-2028, phased out at 6% of MAGI above $150k MFJ
  / $75k single, applied on top of either the standard or itemized deduction.
- SALT cap: $40,000 in 2025, growing 1% a year through 2029, then $10,000 from 2030. It is not indexed
  by `cpiFactor`, and phases down by 30% of MAGI above a threshold that starts at $500,000, floored at
  $10,000.
- Charitable: from 2026 itemized gifts lose a 0.5%-of-AGI floor, and non-itemizers get the capped cash
  deduction ($2,000 MFJ / $1,000 single).
- The age-65 additional standard deduction amounts moved into constants as well.

Property tax uses the expense worksheet: a recurring item can be flagged "Counts toward SALT deduction"
(`isSALTEligible`, shown as a SALT badge in the list). The flagged annual total for the active state is
inflated by `cpiFactor` and added to state income tax under the SALT cap, so it also helps in states
with no income tax. Fill-to-bracket targeting now iterates the target AGI against a deduction that
depends on AGI, and the mid-year deduction estimate computes state tax at each candidate AGI. Ledger
rows gained `isSingleReturn`, because the tax equilibrium hurdle rate guessed filing status from the
deduction size, which no longer works once deductions are larger.

Known limits: property tax is not escalated separately from CPI, the non-itemizer charitable deduction
is assumed not to be indexed and all non-QCD tithing is assumed to be cash gifts, and the 35% itemized
deduction limitation for the 37% bracket is not modeled.

---

## 9. Maryland state tax has several errors and stale values

**Severity: Medium-Low individually, Medium combined for a MD resident**

**What I found.**

- **Pension exclusion applied to IRA distributions.** `simulationEngine.ts:1853-1858` (and copies at
  997-1002, 1238-1243, 1754-1759) applies the exclusion to RMDs and discretionary pre-tax draws.
  Maryland's pension exclusion covers employee retirement systems (401k, 403b, pensions, annuities);
  traditional IRA distributions are explicitly excluded. Your accounts are labeled IRA. If they are
  rollover IRAs, Maryland still denies it.
- **Stale cap.** `MD_PENSION_EXCLUSION_BASE_CAP = 34300` at `taxRates.ts:10` is the 2022 figure;
  it was $39,500 for 2024 (verify 2025/2026).
- **Missing personal exemptions.** Maryland allows $3,200 per person plus $1,000 per person 65+,
  phased out above $100k/$150k FAGI. The MD profile at `stateTaxRegistry.ts:309-348` models none. In a
  low-income conversion year that is $8,400 of missing subtraction.
- **Stale standard deduction.** The 15%-of-AGI with $3,450-$5,150 bounds is the 2023 structure.
  Maryland's 2025 budget act replaced it with a flat $3,350 single / $6,700 MFJ.
- **Missing 2025 brackets and surtax.** The same act added 6.25% and 6.5% brackets (over $500k/$600k
  and $1M/$1.2M) and a 2% surtax on capital gains for FAGI over $350k. The tiers at
  `taxRates.ts:298-318` top out at 5.75%. Probably not your income band, but a big conversion year
  could cross $350k.

**Recommendation.** Make the pension exclusion opt-in with a per-account "qualified employer plan"
flag (default off for IRA-labeled accounts); update the cap, deduction and brackets to current law; add
the exemptions with the phase-out.

**Resolution.** Fixed. Maryland moved into its own module, `states/md.ts`, with rules in a year-keyed
table (`MD_YEAR_RULES`) so a yearly update is a new entry and not a logic change. Shared helpers
(`applyBrackets`, `resolveYearRules`, `phaseOutFraction`) live in `states/stateTaxPrimitives.ts`; other
states can migrate to the same pattern one at a time. Values follow the Comptroller's December 2025 tax
alert:

- Pension exclusion removed for Maryland, with no opt-in flag. It does not cover traditional IRA
  distributions and this plan has no qualifying employer-plan income. The generic exclusion mechanism
  stays in the registry for other states.
- Standard deduction is the flat $3,350 single / $6,700 joint, indexed through `cpiFactor`.
- Personal exemption is $3,200 per filer plus $1,000 per filer 65 or older, phased out in steps
  (full, half, quarter, none) above $100k single / $150k joint.
- Brackets gained 6.25% (over $500k single / $600k joint) and 6.5% (over $1M / $1.2M), and the 2%
  surtax applies to capital gains when federal AGI exceeds $350k. `taxYear` and `agedFilerCount` are
  now passed to every state tax call.

Known limits: the exemption phase-out steps and the age-65 amount come from secondary sources and the
Form 502 table, not the alert, and the $1,000 age-65 amount is assumed to phase out the same way. The
2026 standard deduction is not confirmed (the alert says it is indexed), so 2025 amounts are indexed by
`cpiFactor`. The surtax uses the engine's capital gains figure, which includes qualified dividends, so
it slightly overstates the surtax at high income. County local rates were not updated: the alert lists
Dorchester 3.30%, Calvert 3.20%, Cecil 2.74%, St. Mary's 3.20%, Allegany 3.20% (2026) and Kent 3.30%
(2026), and Anne Arundel has a progressive local tax.

---

## 10. 2026 long-term capital gains thresholds look overstated

**Severity: Low-Medium (verify)**

**What I found.** `taxRates.ts:75-86` sets the 0% threshold at $50,200 single / $100,500 MFJ and
the 15% ceiling at $554,000 / $623,000. My recollection of Rev. Proc. 2025-32 is $49,450 / $98,900 and
$545,500 / $613,700. The ordinary brackets in the same file do match 2026, so this looks like a
one-off.

**Why it matters.** About $1,600 of extra 0% gain room for MFJ. Small, but it is a statutory constant
and it affects the fill-to-target logic for the 12%-bracket target, which keeps qualified dividends in
the 0% zone.

**Recommendation.** Verify against the IRS revenue procedure and correct.

**Resolution.** Fixed. Verified against Rev. Proc. 2025-32 section 4.03 in the IRS PDF: single
$49,450 / $545,500, MFJ $98,900 / $613,700. The four limits in `FED_LTCG_BRACKETS_SINGLE` and
`FED_LTCG_BRACKETS_MFJ` in `taxRates.ts` now use those values, and the `calculateFedTaxWithLTCG` test
expectation was updated to match (10,550 at 15% = 1,582.50).

**Yearly update procedure.** Federal brackets, LTCG brackets, standard deductions, the aged additional
deduction and IRMAA tiers now live in year-keyed tables in `federalTaxRules.ts` (`FED_YEAR_RULES`). When
the IRS publishes a new revenue procedure, add one entry for the new year. A simulated year uses the
latest entry at or before it, inflated by the plan CPI rate from that entry's year. No logic changes.

---

## 11. IRMAA thresholds are inflated to the lookback year, not the premium year

**Severity: Low-Medium (systematic slight overstatement of IRMAA)**

**What I found.** `simulationEngine.ts:1148-1151` scales the tier limits by
`ledger[lookbackIndex].cpiFactor`, i.e. the CPI of year minus 2. The 2026 thresholds ($218k MFJ) are
the thresholds for 2026 premiums and are applied to 2024 income; in the engine's terms, year-Y
thresholds should be scaled by year-Y CPI and compared to year-(Y-2) MAGI.

**Why it matters.** Thresholds are understated by two years of inflation, roughly 5%, so a MAGI near a
cliff gets pushed over a tier it would not actually cross. This slightly overstates surcharges and
makes the TE optimizer stop converting a little early at each cliff.

**Recommendation.** Use `cpiFactor` (the current year) for the tier limits.

**Resolution.** Fixed. `simulationEngine.ts` now scales the tier limits by the current year's `cpiFactor`
and the `lookbackCpi` variable is gone. MAGI is still the year minus 2 value. `RowInspectionDialog.tsx`
had the same lookback-CPI scaling and now uses the row's own `cpiFactor`, so the dialog matches the
engine. A new test steers 2026 MAGI between the unindexed and 2028-indexed Tier 0 limits and checks the
2028 row stays in Tier 0. It fails on the old code (Tier 1).

---

## 12. Survivor filing-status details are inconsistent

**Severity: Low**

- IRMAA switches to single tiers in the year of death (`simulationEngine.ts:1147`, `isSurvivorActive`)
  while the return is still MFJ that year (`isSingle` uses `>`, line 493). SSA actually keeps using the
  MFJ lookback return's status for two more years unless an SSA-44 is filed for the death.
- The 65+ standard-deduction addition for a single survivor uses `wifeAge` even when the husband is
  the survivor (`simulationEngine.ts:1845`, and copies at 1014, 1230, 1716).
- The 65+ single addition is $1,950 (2024); 2026 is $2,050. MFJ $1,650 is correct for 2026. Both are
  magic numbers.

**Recommendation.** Compute "survivor" once per year and derive age from that person; align the IRMAA
status switch with the filing-status switch; move the additions to named constants.

**Resolution.** Fixed together with #13 and #14.

- IRMAA status. The recommendation (switch tiers when the filing status switches) would have compared a
  joint MAGI from before the death against single tiers for two years. The engine now does what SSA
  does: the tier table follows the filing status of the year minus 2 return (`isSingleReturn` on the
  lookback ledger row), so MFJ tiers persist for the year of death and the two years after it. Each
  ledger row records the choice as `irmaaUsesSingleTiers`, and `RowInspectionDialog.tsx` and the IRMAA
  tier popup in `LookbackLedgerTable.tsx` read it. The cliff-warning scan in `LookbackLedgerTable.tsx`
  now judges a year's MAGI by that year's `isSingleReturn`.
- Aged-filer count. `countAgedFilers` takes `youDeceased` and judges a single survivor return by
  whichever spouse survived, so a surviving husband's age is used. The joint branch counts both spouses,
  including one who died that year, because the year-of-death return is still joint.
- Aged addition. The amounts were already in the `FED_YEAR_RULES` table, but the 2026 single amount was
  still $1,950. It is now $2,050 per Rev. Proc. 2025-32.

Known limits: an SSA-44 filed for the death of a spouse (which would move the survivor to a more recent
year's income and single tiers) is not modeled. A spouse who dies before turning 65 still counts by
year-end age on the year-of-death joint return. The conversion state-tax estimate in
`LookbackLedgerTable.tsx` still assumes the wife is the survivor when it derives filing status.

---

## 13. Spousal benefit is modeled as max(own, spousal) with the reduction based on the wife's own claiming age

**Severity: Low-Medium (depends on your claiming ages)**

**What I found.** `simulationEngine.ts:1307-1314` pays `max(ownReduced, spousalReduced)` where the
spousal reduction comes from `calculateSpousalBenefit(..., wife.targetSSClaimingAge)`. The actual rule
under deemed filing is own reduced benefit *plus* an excess spousal amount (50% of your PIA minus her
PIA), with the excess reduced by *her age when the spousal benefit becomes payable* (when you file),
not when she claimed her own.

**Why it matters.** When the wife claims early and you file later, the engine can understate her
combined benefit by several hundred dollars a month. Example: PIA_w $1,000 claimed at 62, PIA_h $3,000
filed when she is 66: real is about $1,158/mo vs $1,000 in the code. With PIA $1,500 vs $3,000 the two
methods coincide at FRA, so it may not affect you at the default ages, but the optimizer sweeps 62-70
for both of you and will misprice some of those combinations.

**Recommendation.** Implement the excess-spousal formula and use the month you file as the spousal
entitlement date.

**Resolution.** Fixed. `calculateSpousalBenefit` is replaced by `calculateExcessSpousalBenefit`. Once
both spouses have filed, the wife is paid her own reduced benefit plus the excess: 50% of the husband's
PIA minus her own PIA, reduced by the spousal schedule for her age (to the month) at the later of her
claim and his filing. The excess is measured against her own benefit when delayed credits lift it above
her PIA, so a wife who claims at 70 does not get an excess on top of a benefit that already exceeds
half his PIA. The IRMAA lookback estimate and the optimizer's `spousalAddOnAnnual` use the same
function. The Social Security percentages, ages and monthly reduction rates are named constants
(`SS_*`) in `simulationEngine.ts`. The review's example (PIA $1,000 claimed at 62, husband $3,000 filing
when she is 66) now pays $1,158.33 a month and is a test.

With the default PIAs ($3,000 and $1,500) the excess is zero, so default results do not change.

A follow-up made the calculation symmetric: the husband gets the same excess on the wife's record when
her PIA is the larger one, and the conversion tax estimate and the IRMAA lookback estimate use the same
amounts as the monthly loop. The lookback estimate only adds the excess once both have filed.

---

## 14. Survivor benefit is paid at 100% from age 60

**Severity: Low (only if widowed before FRA)**

`simulationEngine.ts:585` and `1304-1306` start the full survivor benefit at age 60. A survivor
claiming at 60 receives 71.5%, scaling linearly to 100% at survivor FRA (67). The 82.5% floor at line
598 is correct.

**Recommendation.** Apply the age-based survivor reduction, or at least expose a survivor claiming age.

**Resolution.** Fixed with the age-based reduction and no new input. `calculateSurvivorBenefit` takes
the husband's PIA plus any delayed credits and reduces it for the wife's age when the survivor benefit
starts: 71.5% at 60, rising linearly to 100% at 67. When he claimed early, the result is capped at the
larger of his actual benefit and 82.5% of his PIA; the age reduction is not stacked on top of that
limit. The survivor benefit starts at the later of his death and her 60th birthday, as before.

This also fixes a defect the review missed: the old survivor amount included her own benefit and paid it
from 60, before her own claiming age. Each month she is now paid the larger of the survivor benefit and
her own benefit, the latter only once she has claimed. The IRMAA lookback estimate and the optimizer's
`survivorBenefitAnnual` use the same logic.

A follow-up extended this in three ways:

- Either spouse can be the survivor. A surviving husband is paid the larger of his own benefit and a
  survivor benefit on the wife's record, with the same age reduction.
- `calculateSurvivorBenefit` takes the worker's age at death. A worker who dies before claiming earns
  delayed credits only up to the age at death (none before FRA), and the early-claim widow limit does
  not apply because no early claim was made.
- A survivor who is already collecting an own benefit larger than the age-reduced survivor benefit
  defers the survivor claim to FRA instead of locking in the early reduction.

Known limits: apart from that deferral, the survivor takes the survivor benefit as soon as it is
available, and the own claiming age is not re-optimized after a death (for example reduced survivor
benefit first, then own benefit at 70 is modeled only if 70 was already the own claiming age).

---

## 15. SS earnings test is not modeled

**Severity: Low (only if claiming before FRA while still working)**

`simulationEngine.ts:1299-1300` pays the full benefit regardless of salary. Benefits claimed before
FRA are withheld $1 per $2 of earnings over about $24,500 (2026). The optimizer's 62-66 claiming
candidates combined with a non-zero `activeSalary` past that age would overstate income.

**Recommendation.** Withhold benefits in working months before FRA when salary exceeds the limit (and
ideally credit them back at FRA, which SSA does).

---

## 16. Stale 2025 statutory constants

**Severity: Low**

- 401(k) base $23,500, catch-up $7,500 at `simulationEngine.ts:20-22`: 2026 is $24,500 / $8,000
  (enhanced $11,250 unchanged).
- OASDI wage base $176,100 at line 23: 2026 is $184,500.
- `BASE_QCD_LIMIT = 105000` at `types/index.ts:369` is 2024; 2026 is $111,000. Since cpiFactor starts
  at 1.0 in 2026, the base is two years low.
- Part D base premium $34.50 at `taxRates.ts:4`: 2026 base beneficiary premium is $38.99 (plan
  premiums vary; user-configurable).
- The additional Medicare tax threshold ($200k) is inflated at lines 649/691; it is not indexed in law.

**Recommendation.** Update to 2026 and consider a `simulationStartYear`-keyed constants table so a 2027
start does not silently use 2026 values.

**Resolution.** Fixed with year-keyed data. `FederalYearRules` in `federalTaxRules.ts` gained a `payroll`
group (401(k) limit $24,500, catch-up $8,000, enhanced catch-up $11,250, OASDI wage base $184,500, and the
Additional Medicare Tax thresholds of $200,000 single and $250,000 joint), plus `qcdAnnualLimit` ($111,000)
and `medicarePartDBasePremium` ($38.99), all in the 2026 entry. The engine reads them for the simulated year
through `getFederalIndexing`. A start year after 2026 uses the latest entry at or before each year, with
its dollar limits indexed from that entry's year by CPI, exactly like brackets and IRMAA tiers. The
Additional Medicare thresholds are not indexed. To update for a new year, add one entry to `FED_YEAR_RULES`.

The flat constants in `simulationEngine.ts` and `types/index.ts` are gone. The FICA rates are named
constants.

Medicare amounts have their own year table, `MEDICARE_STANDARD_AMOUNTS_BY_YEAR` ($202.90 Part B premium,
$38.99 Part D premium and $283 Part B deductible for 2026), because CMS publishes them on a different schedule from the tax rules. The lookup
`getMedicareStandardAmounts` returns a published year unscaled, estimates a later year by growing the latest
earlier entry at the healthcare inflation rate, and returns the first entry for an earlier year. The
engine, both healthcare dialogs, the detailed expenses dialog and the configuration PDF all use it, and the
flat Part B, Part D and deductible constants are gone. A user-entered premium override is still a start-year amount
that grows with healthcare inflation. Four existing tests had calibrated expectations that moved (the 401(k) cap, and
three balances affected by the higher Part D premium). New tests cover indexing from a 2028 start and a
later entry overriding the 2026 values.

Known limits: the Additional Medicare tax is modeled as employer withholding at the single threshold for
each employee. The joint $250,000 figure is stored in the table but the year-end settlement is not
modeled. The 2026 values were checked on 2026-11-16 against IRS Notice 2025-67 (401(k) limits and QCD limit),
the SSA Federal Register notice (wage base) and the CMS 2026 fact sheets (Part B premium and deductible,
Part D base premium). Several came from secondary sources that cite the notices, not the notices
themselves. The age-65 premiums and Part B deductible
shown in the healthcare dialogs are for the calendar year the person turns 65.

---

## 17. Monte Carlo sequences are hard-capped at 35 years

**Severity: Low-Medium (depends on horizon)**

Sequences are generated for 35 years (`monteCarloEngine.ts:166`, `303`, `327`, `408`, `635`). The
engine falls back to the deterministic rate when the index is out of range
(`simulationEngine.ts:442`). Your default horizon is 34 years (2026-2059), so it fits, but raising the
wife's longevity to 100 makes the last 4 years silently deterministic, and the percentile chart stops
at 35.

**Recommendation.** Generate `endSimulationYear - simStartYear + 1` years.

**Resolution.** Fixed. `simulationEngine.ts` exports `getSimulationEndYear` and
`getSimulationHorizonYears`, and `runRetirementSimulation` uses the same end-year helper so the two
cannot drift. `generateSyntheticSequence` and `generateHistoricalSequence` take a `years` argument
(default `MONTE_CARLO_SEQUENCE_YEARS`); `runMonteCarloSimulation` and the sequence memo in `App.tsx`
pass the horizon, and the memo now re-keys on birth dates, longevity, filer status and start year so
changing longevity regenerates the sequences. A historical block longer than the 56-year dataset wraps
to 1970. Stress-test overrides iterate the sequence length. The percentile table is sized by the
longest ledger any trial produced, which also fixed a related survivor-mode bug: the loop stops in the
final longevity year, so the table's last row had no data and the Plan Health Summary showed $0 for
P10 and P50. Hard-coded 35s and the literal 2060 in the Monte Carlo workspace, the stress-test year
picker, the Roth end-year picker and the bucket year list now derive from the horizon. Known effect:
each trial now consumes `horizon` draws from the shared seeded stream instead of 35, so seeded results
for any horizon other than 35 years differ from earlier runs. The first trial is unchanged.

---

## 18. Bear-market rule uses the current year's return before it is known

**Severity: Low-Medium (mild optimism in Monte Carlo)**

`simulationEngine.ts:1543` sets `isBearMarket = equityRate < 0` for the whole year, then draws cash
below the floor instead of selling equities. In January you do not know the year will end negative.
This is look-ahead: the simulated planner always avoids selling into down years.

**Recommendation.** Base the rule on the prior year's return, or on a trailing drawdown from the
portfolio's high-water mark, both of which are observable.

**Resolution.** Fixed. The rule now keys on the prior year's equity return. `runRetirementSimulation`
keeps a `priorYearEquityRate` that is seeded from a recorded actual for the year before the simulation
start (if one exists) and updated at the end of each year's iteration. `isBearMarket` is computed once
per year right after the year's rates are resolved and shared by the living-expense drawdown and the
year-end tax settlement drawdown, replacing the two local `equityRate < 0` checks. With no observable
prior-year loss, the first simulation year runs under the normal floor-protection rule. Tests cover the
no-look-ahead first year, the cash-first behavior in the year after an observed loss, and the pre-start
actual seeding. Known effect: in Monte Carlo and the stress tests, the first year of every drawdown now
sells equities at the low and the cash-first behavior begins one year later, so success rates and
terminal wealth shift slightly down compared with earlier runs. This is the realistic outcome the
look-ahead was hiding. The prior-year signal was chosen over a high-water-mark drawdown because it is
already in hand, needs no extra state, and mirrors how the engine already uses prior-year CPI to drive
the current year's inflation factor.

---

## 19. RMD income is counted even when it is not actually distributed; cross-spouse QCD offset

**Severity: Low**

- `taxableYourRMD = yourRMD - yourAnnualQCD` at `simulationEngine.ts:1695-1697` is taxed regardless of
  whether the monthly draws at `1425-1437` actually happened. If a Jan 1 conversion consumes the whole
  pre-tax balance in an RMD year, the converted dollars are taxed as a conversion *and* the RMD is taxed
  again. Also, the IRS requires the RMD to come out before any conversion.
- Line 1427 subtracts the combined `monthlyQcd` (both spouses) from *your* cash RMD draw. A QCD from
  the wife's IRA cannot satisfy your RMD. The year-end true-up is per-person, so taxable amounts are
  right, but the account balances are not.

**Recommendation.** Take the RMD before the conversion and cap the conversion at balance minus RMD;
track QCD per spouse in the monthly draw.

**Resolution.** Fixed in three parts. First, the January 1 conversion (flat and custom) now limits each
spouse to their balance minus their own statutory RMD, because an RMD belongs to its account owner and
cannot be converted. The custom strategy's capped flag and shortfall use the same limits. The
fill-to-target year-end conversion is unchanged, since the monthly draws have already paid the RMDs by
then. Second, the monthly RMD draw is per spouse: cash due is the RMD accrued to date, less that
spouse's own QCDs, less what they already drew. The combined `monthlyQcd` and the spouse offset
formula are gone, and uneven QCDs carry forward. Third, taxable RMD income is the cash actually
distributed (`annualYourRmdDraw`, `annualWifeRmdDraw`), so an IRA that runs dry mid-year is no longer
taxed on an RMD it never paid. Normal years produce the same numbers as before. Known limitation: a
QCD that lands late in the year does not claw back earlier cash draws, so taxable RMD can run slightly
above the statutory amount minus QCDs in that case. Monthly QCDs from the tithe engine do not trigger
it.

Added alongside the fix: a conversion source setting (percent split, or one spouse's IRA first, with
overflow to the other) in `rothConversionSplit.ts`, used by both the January 1 and year-end
conversions. The default is an even split, which matches the previous behavior.

---

## 20. Minor tax-base omissions

**Severity: Low**

- NIIT base at `simulationEngine.ts:1887` excludes cash interest, which is net investment income.
- Realized losses (basis ratio above 1 after a drawdown) are clamped to zero gain and never carried
  forward (`simulationEngine.ts:1569-1574`).
- Mutual fund capital gain distributions are not modeled separately (you can approximate via the
  non-qualified dividend portion, but the default 0.15 is low for a 60/40 or 80/20 taxable account
  holding bond funds).
- The Monte Carlo "cash" yield is constant while bonds are stochastic.
- The tithe expected-return estimate at `simulationEngine.ts:1343` double-counts growth plus dividend
  yield; this only affects the tithe target, not the account growth itself.
- `optimizer.ts` fallbacks differ from the engine (wife longevity 85 vs 95, birth year 1962 vs 1964).
- Quarterly estimates exclude NIIT and fill-to-target conversions; no underpayment penalty is modeled.
- Flat conversion inflation uses fixed CPI (`simulationEngine.ts:972`); FRA is hard-coded at 67.
- `taxEquilibriumEngine.ts:115` infers `isSingle` from the std-deduction midpoint, which is fragile.
- Historical 2025 row is a placeholder; 2024 S&P TR is 25.02% vs 24.00 in the table.

**Resolution:** NIIT base now includes cash interest (also in the tax-equilibrium NIIT drag check);
capital losses net against gains, offset up to $3,000 of ordinary income and carry forward
(`capitalLossCarryforward`); the tithe estimate no longer adds dividend yield to a total return;
optimizer and UI demographic fallbacks share `DEFAULT_*` constants; `isSingleReturn` is required and
the midpoint inference is removed; flat conversions follow the simulated CPI; the 2024 and 2025
historical rows are corrected. Fund distributions, constant MC cash yield, quarterly estimates and
the fixed FRA are documented in #21.

---

## 21. Modeling assumptions worth being explicit about

These are not bugs, but they shape the results and should be decided consciously.

- **Survivor behavior is implicit in the longevity ages.** The survivor toggle was removed. Each
  spouse is removed in their longevity year, the plan files single the year after the first death,
  and the simulation ends the year before the last survivor's longevity year. Equal longevity ages
  give a joint plan with no survivor years. A plan with longevity ages that differ now always shows
  the survivor tax and Social Security effects.
- **Real spending is flat for life.** No spending-smile decline in the 70s-80s, and no long-term care
  shock in the late years. LTC is the single largest unmodeled tail risk for a plan running to 95.
- **No "other income" at all.** There is no field for pension, annuity, rental, or part-time income;
  the only income sources are salary (pre-retirement), SS, RMDs, dividends and interest.
- **No 10% early-withdrawal penalty** on pre-tax draws before 59.5 and no Roth 5-year clock.
  Irrelevant at your ages, relevant if the sample plan is shared.
- **No underpayment penalty** on the (often large) year-end settlement.
- **No employer 401(k) match** is modeled during working years.
- **Mutual fund capital gain distributions are not modeled separately.** Only the non-qualified
  dividend portion approximates them. For a bond-heavy taxable account, raise that portion above the
  0.15 default.
- **The Monte Carlo cash yield is constant** (`cashYieldRate`) while bond returns are stochastic.
  Cash is a small slice and a money-market yield is not driven by bond price moves.
- **Quarterly estimated tax vouchers exclude NIIT and fill-to-target conversions**, and no
  underpayment penalty or safe-harbor rule is modeled. Settlement happens in full at year end.
- **Full retirement age is fixed at 67** (`SS_FULL_RETIREMENT_AGE`), correct for anyone born 1960 or
  later. A plan with an earlier birth year would get the wrong FRA.
- **Capital losses are not split short-term vs long-term**, the offset limit is the same for single
  and MFJ ($3,000), and the state return follows the federal offset.
- **Taxable account returns are modeled correctly** (dividends are subtracted before applying total
  return, so there is no double count). Checked specifically because it is a common error.

---

## What checked out

Verified correct: 2026 ordinary brackets and standard deductions, 2026 IRMAA thresholds and
surcharges, Part B base premium ($202.90), the Uniform Lifetime Table, SECURE 2.0 RMD ages, the SS
early-claim and delayed-credit formulas, the provisional-income taxability worksheet (including the
$6,000/$4,500 base term and un-indexed thresholds), LTCG stacking on top of ordinary income,
non-indexing of NIIT thresholds, the 82.5% survivor floor, the requirement that the primary has filed
before spousal benefits pay, QCDs reducing taxable RMDs, and the Box-Muller / Cholesky correlation
construction in the synthetic generator.
