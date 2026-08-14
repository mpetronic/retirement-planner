import { AppStateInputs, LockedReturnSequence } from '../types';
import { runRetirementSimulation, calculateSSBenefit, calculateSpousalBenefit } from './simulationEngine';

export interface OptimizationResult {
  bestStrategy: 'flat' | 'fill-to-target';
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
    spousalAddOnAnnual: number;   // Annual $ boost from spousal floor (0 if wife's own benefit exceeds floor)
    survivorBenefitAnnual: number; // Wife's annual SS in the first survivor year under the optimal plan
  };
}

export type OptimizationGoal = 'min_taxes' | 'max_portfolio' | 'min_surcharges' | 'max_roth';

interface RothCandidate {
  strategy: 'flat' | 'fill-to-target';
  annualConversion: number;
  targetValue: number | null;
}

/**
 * Sweeps the entire 3D input parameter grid:
 * - Roth conversion strategies (Flat annual amounts vs. Target MAGI/IRMAA ceilings)
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

  let bestStrategy: 'flat' | 'fill-to-target' = inputs.rothConversionStrategy || 'flat';
  let bestAnnualRothConversion = inputs.annualRothConversion;
  let bestTargetValue = inputs.rothConversionTargetValue;
  let bestYourSSAge = inputs.you.targetSSClaimingAge ?? 67;
  let bestWifeSSAge = inputs.wife.targetSSClaimingAge ?? 67;

  let bestScore = (normalizedGoal === 'max_portfolio' || normalizedGoal === 'max_roth') ? -Infinity : Infinity;
  let bestEndingEstate = -Infinity; // Secondary metric tie-breaker
  let bestLifetimeTaxes = Infinity;
  let bestResultDetails: OptimizationResult['details'] | null = null;

  // Build comprehensive list of candidate Roth strategies to evaluate
  const rothCandidates: RothCandidate[] = [
    // Flat conversion candidates: $0 (baseline) through $400k
    { strategy: 'flat', annualConversion: 0, targetValue: null },
    { strategy: 'flat', annualConversion: 10000, targetValue: null },
    { strategy: 'flat', annualConversion: 25000, targetValue: null },
    { strategy: 'flat', annualConversion: 50000, targetValue: null },
    { strategy: 'flat', annualConversion: 75000, targetValue: null },
    { strategy: 'flat', annualConversion: 100000, targetValue: null },
    { strategy: 'flat', annualConversion: 125000, targetValue: null },
    { strategy: 'flat', annualConversion: 150000, targetValue: null },
    { strategy: 'flat', annualConversion: 200000, targetValue: null },
    { strategy: 'flat', annualConversion: 250000, targetValue: null },
    { strategy: 'flat', annualConversion: 300000, targetValue: null },
    { strategy: 'flat', annualConversion: 400000, targetValue: null },

    // Target MAGI ceiling candidates: Federal Brackets and IRMAA cliffs
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 57000 },   // 10% Bracket
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 133000 },  // 12% Bracket
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 200000 },
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 217999 },  // IRMAA Tier 1 ($1 below cliff)
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 243600 },  // 22% Bracket
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 273999 },  // IRMAA Tier 2 ($1 below cliff)
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 300000 },
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 341999 },  // IRMAA Tier 3 ($1 below cliff)
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 400000 },
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 409999 },  // IRMAA Tier 4 ($1 below cliff)
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 435750 },  // 24% Bracket
    { strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: 544650 },  // 32% Bracket
  ];

  // Also include the user's current settings if not already in candidate list
  if (inputs.annualRothConversion > 0 && !rothCandidates.some(c => c.strategy === 'flat' && c.annualConversion === inputs.annualRothConversion)) {
    rothCandidates.push({ strategy: 'flat', annualConversion: inputs.annualRothConversion, targetValue: null });
  }
  if (inputs.rothConversionTargetValue !== null && !rothCandidates.some(c => c.strategy === 'fill-to-target' && c.targetValue === inputs.rothConversionTargetValue)) {
    rothCandidates.push({ strategy: 'fill-to-target', annualConversion: inputs.annualRothConversion, targetValue: inputs.rothConversionTargetValue });
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
            targetSSClaimingAge: inputs.isSingleFiler ? inputs.wife.targetSSClaimingAge : wifeAge,
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

        // Spousal add-on: find the first year where wife is collecting SS and measure
        // how much the spousal floor boosted her above her own earned benefit.
        let spousalAddOnAnnual = 0;
        if (!testInputs.isSingleFiler && testInputs.wife.targetSSClaimingAge) {
          const ownWifeSS = calculateSSBenefit(testInputs.wife.estimatedPIA || 0, testInputs.wife.targetSSClaimingAge) * 12;
          const spousalFloor = calculateSpousalBenefit(testInputs.you.estimatedPIA || 0, testInputs.wife.targetSSClaimingAge) * 12;
          spousalAddOnAnnual = Math.max(0, spousalFloor - ownWifeSS);
        }

        // Survivor benefit: wife's SS in the first survivor year, already inflation-adjusted in the ledger.
        const survivorRow = ledger.find((r) => r.year === deathYear);
        const survivorBenefitAnnual = survivorRow ? survivorRow.wifeSS : 0;

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
            if (endingEstate > bestEndingEstate) {
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
          bestWifeSSAge = wifeAge;
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
    metricValue: bestScore,
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
