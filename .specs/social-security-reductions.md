# Social Security Benefit Reductions Specification

## 1. Overview

Models a possible Social Security trust fund shortfall. The user defines a schedule of years and
payment levels. From each configured year (January 1) onward, benefits are paid at that percent of the
scheduled amount until a later entry replaces it.

## 2. Decisions

- Each entry is a payment level (for example 2032 at 78%), not an incremental cut. A later entry
  replaces the earlier one; levels do not compound.
- One global schedule. It scales both spouses' own benefits, the spousal top-up, and the survivor
  benefit.
- Off by default. With no entries or the toggle disabled, results are identical to before.
- Calendar-year granularity, effective January 1.
- Stored with the plan inputs (`ssReductions`) and applied in every run: deterministic, Monte Carlo,
  comparison, exports.

## 3. Data Model

- `SSReductionConfig`: `enabled` flag plus `entries` of `{ year, paymentPercent }`.
- `getSSPaymentLevel(config, year)` returns a fraction from 0 to 1. Years before the first entry
  return 1.
- Named constants hold the allowed percent range.
- `SimulationResultRow.ssPaymentLevel` records the level applied each year.

## 4. Engine

The level is computed once per simulation year and multiplied into the five SS base amounts
(own benefits, spousal floor, survivor amounts). Every downstream use, including tax estimates,
lookback estimates and planning, therefore sees the reduced benefit.

## 5. UI

- Parameters, Profiles & Family: "Social Security Benefit Reductions" card with an enabled toggle,
  editable rows (year, percent, remove) and an "Add reduction" button. Years must be unique and
  at least 1900 (a year before the simulation start applies from the first simulated year); invalid input
  shows an inline message and reverts; percent is clamped 0 to 100; rows are kept sorted.
- Row inspection dialog: shows paid amount, percent, and scheduled amount when a reduction applies.
- Read-only summaries: Monte Carlo workspace, configuration PDF, Plan Comparison.

## 6. Not Included

Per-person schedules, month-level timing, a lost-benefit column, chart markers, Excel columns.
