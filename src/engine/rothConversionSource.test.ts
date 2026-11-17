import { describe, it, expect } from 'vitest';
import { runRetirementSimulation } from './simulationEngine';
import { splitRothConversion, describeRothConversionSource, getRothConversionSourceNames } from './rothConversionSplit';
import { SAMPLE_DEMO_PLAN } from '../shared/utils/sampleDemoPlan';
import { AppStateInputs } from '../types';

describe('splitRothConversion', () => {
  it('splits evenly by default, matching the previous half-and-half behavior', () => {
    const split = splitRothConversion(300000, 500000, 500000);
    expect(split).toEqual({ your: 150000, wife: 150000 });
  });

  it('honors a percent split such as 83/17', () => {
    const split = splitRothConversion(100000, 3500000, 700000, 'percent', 83);
    expect(split.your).toBeCloseTo(83000, 6);
    expect(split.wife).toBeCloseTo(17000, 6);
  });

  it('overflows to the other spouse when one limit is smaller than its share', () => {
    // Wife has only 100,000 convertible, so you cover the other 200,000
    const split = splitRothConversion(300000, 479675, 100000, 'percent', 50);
    expect(split.wife).toBe(100000);
    expect(split.your).toBe(200000);
  });

  it('drains your account first and only then the wife account', () => {
    const covered = splitRothConversion(200000, 500000, 700000, 'you-first');
    expect(covered).toEqual({ your: 200000, wife: 0 });
    const spill = splitRothConversion(600000, 500000, 700000, 'you-first');
    expect(spill).toEqual({ your: 500000, wife: 100000 });
  });

  it('drains the wife account first when asked', () => {
    const split = splitRothConversion(900000, 500000, 700000, 'wife-first');
    expect(split).toEqual({ your: 200000, wife: 700000 });
  });

  it('never converts more than the combined limits', () => {
    const split = splitRothConversion(1000000, 28780, 40000, 'percent', 50);
    expect(split.your + split.wife).toBe(68780);
  });

  it('clamps an out-of-range percent', () => {
    expect(splitRothConversion(100, 1000, 1000, 'percent', 250)).toEqual({ your: 100, wife: 0 });
    expect(splitRothConversion(100, 1000, 1000, 'percent', -5)).toEqual({ your: 0, wife: 100 });
  });

  it('describes each source for reports using profile names', () => {
    const names = getRothConversionSourceNames('Mark', 'Jane');
    expect(describeRothConversionSource('percent', 83, names)).toBe('83% Mark / 17% Jane');
    expect(describeRothConversionSource('you-first', 50, names)).toBe('Mark, then Jane');
    expect(describeRothConversionSource('wife-first', 50, names)).toBe('Jane, then Mark');
  });

  it('falls back to generic labels when a profile name is blank', () => {
    const names = getRothConversionSourceNames('  ', undefined);
    expect(describeRothConversionSource('you-first', 50, names)).toBe('You, then Spouse');
  });
});

const clonePlan = (): AppStateInputs => JSON.parse(JSON.stringify(SAMPLE_DEMO_PLAN));

describe('Roth conversion source in the simulation', () => {
  const getPreRmdInputs = (): AppStateInputs => {
    const inputs = clonePlan();
    inputs.simulationStartYear = 2026;
    inputs.you.birthDate = '1966-01-01';
    inputs.wife.birthDate = '1966-01-01';
    inputs.you.plannedRetirementAge = 55;
    inputs.wife.plannedRetirementAge = 55;
    inputs.portfolio.yourPreTaxIRA = 3500000;
    inputs.portfolio.wifePreTaxIRA = 700000;
    inputs.portfolio.yourCash = 1500000;
    inputs.portfolio.wifeCash = 0;
    inputs.rothConversionStrategy = 'flat';
    inputs.annualRothConversion = 100000;
    inputs.rothConversionStartYear = 2026;
    inputs.rothConversionEndYear = 2026;
    return inputs;
  };

  it('pulls the conversion from your IRA first when requested', () => {
    const evenInputs = getPreRmdInputs();
    const youFirstInputs = getPreRmdInputs();
    youFirstInputs.rothConversionSourceMode = 'you-first';
    const wifeFirstInputs = getPreRmdInputs();
    wifeFirstInputs.rothConversionSourceMode = 'wife-first';

    const even = runRetirementSimulation(evenInputs)[0];
    const youFirst = runRetirementSimulation(youFirstInputs)[0];
    const wifeFirst = runRetirementSimulation(wifeFirstInputs)[0];

    expect(youFirst.intentionalRothConversion).toBeGreaterThan(0);
    expect(youFirst.intentionalRothConversion).toBeCloseTo(even.intentionalRothConversion, 2);
    expect(wifeFirst.intentionalRothConversion).toBeCloseTo(even.intentionalRothConversion, 2);

    expect(youFirst.endYourPreTaxIRA).toBeLessThan(even.endYourPreTaxIRA);
    expect(youFirst.endWifePreTaxIRA).toBeGreaterThan(even.endWifePreTaxIRA);
    expect(wifeFirst.endYourPreTaxIRA).toBeGreaterThan(even.endYourPreTaxIRA);
    expect(wifeFirst.endWifePreTaxIRA).toBeLessThan(even.endWifePreTaxIRA);
  });

  it('treats a 100 percent share as your IRA first', () => {
    const percentInputs = getPreRmdInputs();
    percentInputs.rothConversionSourceMode = 'percent';
    percentInputs.rothConversionYourSharePercent = 100;
    const orderInputs = getPreRmdInputs();
    orderInputs.rothConversionSourceMode = 'you-first';

    const percentRow = runRetirementSimulation(percentInputs)[0];
    const orderRow = runRetirementSimulation(orderInputs)[0];
    expect(percentRow.endYourPreTaxIRA).toBeCloseTo(orderRow.endYourPreTaxIRA, 2);
    expect(percentRow.endWifePreTaxIRA).toBeCloseTo(orderRow.endWifePreTaxIRA, 2);
  });
});

describe('RMD handling around Roth conversions and QCDs', () => {
  const getRmdYearSingleInputs = (): AppStateInputs => {
    const inputs = clonePlan();
    inputs.isSingleFiler = true;
    inputs.simulationStartYear = 2026;
    inputs.you.birthDate = '1951-01-01'; // Age 75 in 2026
    inputs.you.plannedRetirementAge = 65;
    inputs.you.estimatedPIA = 0;
    inputs.you.targetSSClaimingAge = null;
    inputs.portfolio.yourPreTaxIRA = 500000;
    inputs.portfolio.yourRothIRA = 0;
    inputs.portfolio.yourTaxableBrokerage = 0;
    inputs.portfolio.yourTaxableBasis = 0;
    inputs.portfolio.yourCash = 3000000;
    inputs.annualLivingExpenses = 60000;
    inputs.charitySettings = { ...inputs.charitySettings!, enabled: false };
    return inputs;
  };

  it('does not convert the RMD portion of the IRA on January 1', () => {
    const inputs = getRmdYearSingleInputs();
    inputs.rothConversionStrategy = 'flat';
    inputs.annualRothConversion = 500000;
    inputs.rothConversionStartYear = 2026;
    inputs.rothConversionEndYear = 2026;

    const row = runRetirementSimulation(inputs)[0];
    expect(row.yourRMD).toBeGreaterThan(0);
    // Conversion plus the RMD that still had to come out together cannot exceed the starting balance
    expect(row.intentionalRothConversion + row.yourRMD).toBeLessThanOrEqual(500000 + 0.01);
    expect(row.intentionalRothConversion).toBeGreaterThan(0);
  });

  it('taxes an RMD only on cash actually distributed when the IRA is exhausted mid-year', () => {
    const inputs = getRmdYearSingleInputs();
    inputs.portfolio.yourPreTaxIRA = 30000;
    inputs.portfolio.yourCash = 0;
    inputs.rothConversionStrategy = 'none';
    inputs.annualLivingExpenses = 120000;

    const row = runRetirementSimulation(inputs)[0];
    const statutoryRmd = 30000 / 24.6;
    expect(row.yourRMD).toBeGreaterThan(0);
    expect(row.yourRMD).toBeLessThan(statutoryRmd * 0.5);
  });

  it('does not let your QCD reduce the wife RMD cash draw', () => {
    const base = clonePlan();
    base.isSingleFiler = false;
    base.simulationStartYear = 2026;
    base.you.birthDate = '1951-01-01';
    base.wife.birthDate = '1951-01-01';
    base.you.plannedRetirementAge = 65;
    base.wife.plannedRetirementAge = 65;
    base.you.estimatedPIA = 0;
    base.wife.estimatedPIA = 0;
    base.you.targetSSClaimingAge = null;
    base.wife.targetSSClaimingAge = null;
    base.portfolio.yourPreTaxIRA = 600000;
    base.portfolio.wifePreTaxIRA = 1200000;
    base.portfolio.yourCash = 3000000;
    base.rothConversionStrategy = 'none';
    base.charitySettings = { ...base.charitySettings!, enabled: false, useQCD: false };

    const qcd = clonePlan();
    Object.assign(qcd, JSON.parse(JSON.stringify(base)));
    // A large fixed tithe that is routed to QCDs from your IRA first
    qcd.charitySettings = {
      ...base.charitySettings!,
      enabled: true,
      useQCD: true,
      growthPercentage: 0.10,
      minAnnualTithe: 90000,
      maxAnnualTithe: null,
    };

    const baseRow = runRetirementSimulation(base)[0];
    const qcdRow = runRetirementSimulation(qcd)[0];

    // The QCD is larger than your whole RMD, so your taxable RMD disappears
    expect(qcdRow.yourRMD).toBeLessThan(baseRow.yourRMD);
    // Your QCD cannot satisfy the spouse's RMD, so she still takes her full RMD in cash
    expect(qcdRow.wifeRMD).toBeCloseTo(baseRow.wifeRMD, 0);
    expect(qcdRow.endWifePreTaxIRA).toBeCloseTo(baseRow.endWifePreTaxIRA, -2);
  });
});
