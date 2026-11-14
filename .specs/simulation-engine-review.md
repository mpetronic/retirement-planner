# Simulation Engine Code Review

Read-only review performed 2026-11-14 against commit `08d8d5b` (branch `variable-social-security`).

Scope: `src/engine/simulationEngine.ts`, `src/engine/taxRates2026.ts`, `src/engine/stateTaxRegistry.ts`
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
| 1 | Year-end tax settlement income never taxed | High | Open |
| 2 | MC mean reversion / regime vol narrows distribution | High | Open |
| 3 | Historical bootstrap arithmetic vs geometric calibration | Medium-High | Open |
| 4 | Survivor (wife first): husband's cash wiped out | High (latent) | Open |
| 5 | Survivor (wife first): Roth conversions stop | Medium-High (latent) | Open |
| 6 | No federal basis step-up unless FL | Medium | Open |
| 7 | TE optimizer nominal income vs un-inflated brackets | Medium-High | Open |
| 8 | OBBBA 2025 federal changes not modeled | Medium | Open |
| 9 | Maryland state tax errors and stale values | Medium | Open |
| 10 | 2026 LTCG thresholds look overstated | Low-Medium | Open |
| 11 | IRMAA thresholds inflated to lookback year | Low-Medium | Open |
| 12 | Survivor filing-status inconsistencies | Low | Open |
| 13 | Spousal benefit formula | Low-Medium | Open |
| 14 | Survivor benefit 100% from age 60 | Low | Open |
| 15 | SS earnings test not modeled | Low | Open |
| 16 | Stale 2025 statutory constants | Low | Open |
| 17 | MC sequences hard-capped at 35 years | Low-Medium | Open |
| 18 | Bear-market rule uses look-ahead | Low-Medium | Open |
| 19 | RMD counted when not distributed; cross-spouse QCD | Low | Open |
| 20 | Minor tax-base omissions | Low | Open |
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
floor) in `taxRates2026.ts`, named constants per the project rule, and look them up by simulation year.
Add property tax as an input (or let detailed expenses tag an item as SALT-eligible).

---

## 9. Maryland state tax has several errors and stale values

**Severity: Medium-Low individually, Medium combined for a MD resident**

**What I found.**

- **Pension exclusion applied to IRA distributions.** `simulationEngine.ts:1853-1858` (and copies at
  997-1002, 1238-1243, 1754-1759) applies the exclusion to RMDs and discretionary pre-tax draws.
  Maryland's pension exclusion covers employee retirement systems (401k, 403b, pensions, annuities);
  traditional IRA distributions are explicitly excluded. Your accounts are labeled IRA. If they are
  rollover IRAs, Maryland still denies it.
- **Stale cap.** `MD_PENSION_EXCLUSION_BASE_CAP = 34300` at `taxRates2026.ts:10` is the 2022 figure;
  it was $39,500 for 2024 (verify 2025/2026).
- **Missing personal exemptions.** Maryland allows $3,200 per person plus $1,000 per person 65+,
  phased out above $100k/$150k FAGI. The MD profile at `stateTaxRegistry.ts:309-348` models none. In a
  low-income conversion year that is $8,400 of missing subtraction.
- **Stale standard deduction.** The 15%-of-AGI with $3,450-$5,150 bounds is the 2023 structure.
  Maryland's 2025 budget act replaced it with a flat $3,350 single / $6,700 MFJ.
- **Missing 2025 brackets and surtax.** The same act added 6.25% and 6.5% brackets (over $500k/$600k
  and $1M/$1.2M) and a 2% surtax on capital gains for FAGI over $350k. The tiers at
  `taxRates2026.ts:298-318` top out at 5.75%. Probably not your income band, but a big conversion year
  could cross $350k.

**Recommendation.** Make the pension exclusion opt-in with a per-account "qualified employer plan"
flag (default off for IRA-labeled accounts); update the cap, deduction and brackets to current law; add
the exemptions with the phase-out.

---

## 10. 2026 long-term capital gains thresholds look overstated

**Severity: Low-Medium (verify)**

**What I found.** `taxRates2026.ts:75-86` sets the 0% threshold at $50,200 single / $100,500 MFJ and
the 15% ceiling at $554,000 / $623,000. My recollection of Rev. Proc. 2025-32 is $49,450 / $98,900 and
$545,500 / $613,700. The ordinary brackets in the same file do match 2026, so this looks like a
one-off.

**Why it matters.** About $1,600 of extra 0% gain room for MFJ. Small, but it is a statutory constant
and it affects the fill-to-target logic for the 12%-bracket target, which keeps qualified dividends in
the 0% zone.

**Recommendation.** Verify against the IRS revenue procedure and correct.

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

---

## 14. Survivor benefit is paid at 100% from age 60

**Severity: Low (only if widowed before FRA)**

`simulationEngine.ts:585` and `1304-1306` start the full survivor benefit at age 60. A survivor
claiming at 60 receives 71.5%, scaling linearly to 100% at survivor FRA (67). The 82.5% floor at line
598 is correct.

**Recommendation.** Apply the age-based survivor reduction, or at least expose a survivor claiming age.

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
- Part D base premium $34.50 at `taxRates2026.ts:4`: 2026 base beneficiary premium is $38.99 (plan
  premiums vary; user-configurable).
- The additional Medicare tax threshold ($200k) is inflated at lines 649/691; it is not indexed in law.

**Recommendation.** Update to 2026 and consider a `simulationStartYear`-keyed constants table so a 2027
start does not silently use 2026 values.

---

## 17. Monte Carlo sequences are hard-capped at 35 years

**Severity: Low-Medium (depends on horizon)**

Sequences are generated for 35 years (`monteCarloEngine.ts:166`, `303`, `327`, `408`, `635`). The
engine falls back to the deterministic rate when the index is out of range
(`simulationEngine.ts:442`). Your default horizon is 34 years (2026-2059), so it fits, but raising the
wife's longevity to 100 makes the last 4 years silently deterministic, and the percentile chart stops
at 35.

**Recommendation.** Generate `endSimulationYear - simStartYear + 1` years.

---

## 18. Bear-market rule uses the current year's return before it is known

**Severity: Low-Medium (mild optimism in Monte Carlo)**

`simulationEngine.ts:1543` sets `isBearMarket = equityRate < 0` for the whole year, then draws cash
below the floor instead of selling equities. In January you do not know the year will end negative.
This is look-ahead: the simulated planner always avoids selling into down years.

**Recommendation.** Base the rule on the prior year's return, or on a trailing drawdown from the
portfolio's high-water mark, both of which are observable.

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

---

## 21. Modeling assumptions worth being explicit about

These are not bugs, but they shape the results and should be decided consciously.

- **Baseline (non-survivor) mode assumes both of you live to the later longevity date.**
  `simulationEngine.ts:393` and `490-491`: with survivor mode off, `youDeceased` is never true, so both
  SS benefits, MFJ brackets and MFJ IRMAA tiers continue through 2059 even though your longevity is 85
  (2045). The default view is the optimistic one; the survivor view is the realistic one for the last
  14 years.
- **Real spending is flat for life.** No spending-smile decline in the 70s-80s, and no long-term care
  shock in the late years. LTC is the single largest unmodeled tail risk for a plan running to 95.
- **No "other income" at all.** There is no field for pension, annuity, rental, or part-time income;
  the only income sources are salary (pre-retirement), SS, RMDs, dividends and interest.
- **No 10% early-withdrawal penalty** on pre-tax draws before 59.5 and no Roth 5-year clock.
  Irrelevant at your ages, relevant if the sample plan is shared.
- **No underpayment penalty** on the (often large) year-end settlement.
- **No employer 401(k) match** is modeled during working years.
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
