import { AppStateInputs, LockedReturnSequence } from '../types';
import { runRetirementSimulation, calculateSSBenefit, calculateSpousalBenefit } from './simulationEngine';
import { CONVERSION_TARGET_PRESETS } from './taxRates2026';

export interface OptimizationResult {
  bestStrategy: 'flat' | 'fill-to-target' | 'custom';
  bestAnnualRothConversion: number;
  bestTargetValue: number | null;
  bestYourSSAge: number;
  bestWifeSSAge: number;
  metricValue: number;
  details: {
    endingEstate: number;
    lifetimeTaxes: number;
    lifetimeIRMAA: number;
    endingRoth: number;
    spousalAddOnAnnual: number;   // Annual $ boost from spousal floor (0 if wife's own benefit exceeds floor or no concurrent claiming)
    survivorBenefitAnnual: number; // Wife's annualized SS in first survivor year under the optimal plan (0 if single or wife predeceases)
  };
}

export type OptimizationGoal = 'min_taxes' | 'max_portfolio' | 'min_surcharges' | 'max_roth';

interface RothCandidate {
  strategy: 'flat' | 'fill-to-target' | 'custom';
  annualConversion: number;
  targetValue: number | null;
}

/**
 * Sweeps the entire 3D input parameter grid:
 * - Roth conversion strategies (Flat annual amounts vs. Target MAGI/IRMAA ceilings vs. Active Custom schedule)
 * - Your SS Claim Age (62-70)
 * - Spouse SS Claim Age (62-70)
 * to locate the optimal retirement scenario for a specific goal.
 */
export function optimizeRetirementScenario(
  inputs: AppStateInputs,
  goalInput: OptimizationGoal | string,
  simulateSurvivor: boolean,
  overrideSequence?: LockedReturnSequence | null
): OptimizationResult {
  // Normalize goal string defensively (handling hyphens or underscores)
  const normalizedGoal = (goalInput || 'max_portfolio').replace(/-/g, '_') as OptimizationGoal;

  if (!inputs.isConfigured) {
    return {
      bestStrategy: inputs.rothConversionStrategy === 'fill-to-target'
        ? 'fill-to-target'
        : (inputs.rothConversionStrategy === 'custom' ? 'custom' : 'flat'),
      bestAnnualRothConversion: inputs.annualRothConversion,
      bestTargetValue: inputs.rothConversionTargetValue,
      bestYourSSAge: inputs.you.targetSSClaimingAge ?? 67,
      bestWifeSSAge: inputs.wife.targetSSClaimingAge ?? 67,
      metricValue: 0,
      details: {
        endingEstate: 0,
        lifetimeTaxes: 0,
        lifetimeIRMAA: 0,
        endingRoth: 0,
        spousalAddOnAnnual: 0,
        survivorBenefitAnnual: 0,
      },
    };
  }

  const parseBirthYear = (dateStr: string | undefined, fallback: number): number => {
    if (!dateStr) return fallback;
    const match = dateStr.match(/^(\d{4})/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
        return parsed;
      }
    }
    return fallback;
  };
  
  const yourBirthYear = parseBirthYear(inputs.you.birthDate, 1960);
  const deathYear = yourBirthYear + (inputs.you.longevityAge ?? 85);
  const wifeBirthYear = parseBirthYear(inputs.wife.birthDate, 1962);
  const wifeDeathYear = wifeBirthYear + (inputs.wife.longevityAge ?? 85);

  let bestStrategy: 'flat' | 'fill-to-target' | 'custom' =
    inputs.rothConversionStrategy === 'fill-to-target'
      ? 'fill-to-target'
      : (inputs.rothConversionStrategy === 'custom' ? 'custom' : 'flat');
  let bestAnnualRothConversion = inputs.annualRothConversion;
  let bestTargetValue = inputs.rothConversionTargetValue;
  let bestYourSSAge = inputs.you.targetSSClaimingAge ?? 67;
  let bestWifeSSAge = inputs.wife.targetSSClaimingAge ?? 67;

  let bestScore = (normalizedGoal === 'max_portfolio' || normalizedGoal === 'max_roth') ? -Infinity : Infinity;
  let bestEndingEstate = -Infinity; // Secondary metric tie-breaker
  let bestLifetimeTaxes = Infinity;
  let bestResultDetails: OptimizationResult['details'] | null = null;

  // Build comprehensive list of candidate Roth strategies to evaluate
  const rothCandidates: RothCandidate[] = [];

  // Flat conversion candidates: $0 through $400k in $10k increments (41 candidates)
  for (let amt = 0; amt <= 400000; amt += 10000) {
    rothCandidates.push({ strategy: 'flat', annualConversion: amt, targetValue: null });
  }

  // Target ceiling candidates: Federal Brackets (Taxable Income) and IRMAA cliffs (MAGI) derived directly from statutory presets
  const targetCeilings = CONVERSION_TARGET_PRESETS.map((p) => p.targetValue);

  for (const targetVal of targetCeilings) {
    rothCandidates.push({ strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: targetVal });
  }

  // Also include the user's active settings if not already in candidate list
  if (inputs.rothConversionStrategy === 'flat') {
    if (inputs.annualRothConversion > 0 && !rothCandidates.some(c => c.strategy === 'flat' && c.annualConversion === inputs.annualRothConversion)) {
      rothCandidates.push({ strategy: 'flat', annualConversion: inputs.annualRothConversion, targetValue: null });
    }
  } else if (inputs.rothConversionStrategy === 'fill-to-target') {
    if (inputs.rothConversionTargetValue !== null && !rothCandidates.some(c => c.strategy === 'fill-to-target' && c.targetValue === inputs.rothConversionTargetValue)) {
      rothCandidates.push({ strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: inputs.rothConversionTargetValue });
    }
  } else if (inputs.rothConversionStrategy === 'custom') {
    rothCandidates.push({ strategy: 'custom', annualConversion: inputs.annualRothConversion, targetValue: inputs.rothConversionTargetValue });
  }

  const yourAgeChoices = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  const wifeAgeChoices = inputs.isSingleFiler ? [67] : [62, 63, 64, 65, 66, 67, 68, 69, 70];

  for (const candidate of rothCandidates) {
    for (const yourAge of yourAgeChoices) {
      for (const wifeAge of wifeAgeChoices) {
        // Construct hypothetical inputs
        const testInputs: AppStateInputs = {
          ...inputs,
          rothConversionStrategy: candidate.strategy,
          annualRothConversion: candidate.annualConversion,
          rothConversionTargetValue: candidate.targetValue,
          you: {
            ...inputs.you,
            targetSSClaimingAge: yourAge,
          },
          wife: {
            ...inputs.wife,
            targetSSClaimingAge: inputs.isSingleFiler ? (inputs.wife.targetSSClaimingAge ?? 67) : wifeAge,
          },
        };

        const ledger = runRetirementSimulation(testInputs, simulateSurvivor, overrideSequence);
        if (ledger.length === 0) continue;

        // Compute metrics
        const finalRow = ledger[ledger.length - 1];
        const endingEstate = finalRow.totalPortfolioValue;
        const lifetimeTaxes = ledger.reduce((sum, r) => sum + r.totalIncomeTax, 0);
        const lifetimeIRMAA = ledger.reduce((sum, r) => sum + r.combinedSurchargeAnnual, 0);
        const endingRoth = finalRow.endYourRothIRA + finalRow.endWifeRothIRA;

        // Spousal add-on: find the first year where both spouses are concurrently collecting SS
        // and measure how much the spousal floor boosted her above her own earned benefit.
        let spousalAddOnAnnual = 0;
        if (!testInputs.isSingleFiler && testInputs.wife.targetSSClaimingAge && testInputs.you.targetSSClaimingAge) {
          const effectiveWifeSSAge = testInputs.wife.targetSSClaimingAge;
          const ownWifeSSBase = calculateSSBenefit(testInputs.wife.estimatedPIA || 0, effectiveWifeSSAge) * 12;
          const spousalFloorBase = calculateSpousalBenefit(testInputs.you.estimatedPIA || 0, effectiveWifeSSAge) * 12;
          if (spousalFloorBase > ownWifeSSBase) {
            const firstConcurrentYear = Math.max(yourBirthYear + yourAge, wifeBirthYear + effectiveWifeSSAge);
            const concurrentRow = ledger.find(r => r.year >= firstConcurrentYear && r.year < Math.min(deathYear, wifeDeathYear));
            if (concurrentRow) {
              spousalAddOnAnnual = (spousalFloorBase - ownWifeSSBase) * concurrentRow.cpiFactor;
            }
          }
        }

        // Survivor benefit: wife's annualized SS in first survivor year under the optimal plan.
        let survivorBenefitAnnual = 0;
        if (!testInputs.isSingleFiler && wifeDeathYear > deathYear) {
          const effectiveWifeSSAge = testInputs.wife.targetSSClaimingAge ?? 67;
          const survivorSSAnnualBase = calculateSSBenefit(testInputs.you.estimatedPIA || 0, yourAge) * 12;
          const survivorWifeSSAnnualBase = calculateSSBenefit(testInputs.wife.estimatedPIA || 0, effectiveWifeSSAge) * 12;
          const survivorFloorBase = (testInputs.you.estimatedPIA || 0) * 0.825 * 12;
          const baseSurvivorAnnual = Math.max(survivorSSAnnualBase, survivorWifeSSAnnualBase, survivorFloorBase);

          const survivorRow = ledger.find((r) => r.year >= deathYear) || finalRow;
          survivorBenefitAnnual = baseSurvivorAnnual * survivorRow.cpiFactor;
        }

        let score = 0;
        switch (normalizedGoal) {
          case 'min_taxes':
            score = lifetimeTaxes;
            break;
          case 'max_portfolio':
            score = endingEstate;
            break;
          case 'min_surcharges':
            score = lifetimeIRMAA;
            break;
          case 'max_roth':
            score = endingRoth;
            break;
          default:
            score = endingEstate;
            break;
        }

        // Compare score
        let isBetter = false;
        if (normalizedGoal === 'max_portfolio' || normalizedGoal === 'max_roth') {
          if (score > bestScore) {
            isBetter = true;
          } else if (score === bestScore) {
            if (endingEstate > bestEndingEstate || (endingEstate === bestEndingEstate && lifetimeTaxes < bestLifetimeTaxes)) {
              isBetter = true;
            }
          }
        } else {
          // Minimization goals (min_taxes, min_surcharges)
          if (score < bestScore) {
            isBetter = true;
          } else if (score === bestScore) {
            if (endingEstate > bestEndingEstate || (endingEstate === bestEndingEstate && lifetimeTaxes < bestLifetimeTaxes)) {
              isBetter = true;
            }
          }
        }

        if (isBetter) {
          bestScore = score;
          bestEndingEstate = endingEstate;
          bestLifetimeTaxes = lifetimeTaxes;
          bestStrategy = candidate.strategy;
          bestAnnualRothConversion = candidate.annualConversion;
          bestTargetValue = candidate.targetValue;
          bestYourSSAge = yourAge;
          bestWifeSSAge = inputs.isSingleFiler ? (inputs.wife.targetSSClaimingAge ?? 67) : wifeAge;
          bestResultDetails = {
            endingEstate,
            lifetimeTaxes,
            lifetimeIRMAA,
            endingRoth,
            spousalAddOnAnnual,
            survivorBenefitAnnual,
          };
        }
      }
    }
  }

  return {
    bestStrategy,
    bestAnnualRothConversion,
    bestTargetValue,
    bestYourSSAge,
    bestWifeSSAge,
    metricValue: isFinite(bestScore) ? bestScore : 0,
    details: bestResultDetails || {
      endingEstate: 0,
      lifetimeTaxes: 0,
      lifetimeIRMAA: 0,
      endingRoth: 0,
      spousalAddOnAnnual: 0,
      survivorBenefitAnnual: 0,
    },
  };
}
