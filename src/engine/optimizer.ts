import { AppStateInputs, LockedReturnSequence } from '../types';
import { runRetirementSimulation, calculateSSBenefit, calculateSpousalBenefit } from './simulationEngine';

export interface OptimizationResult {
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

/**
 * Sweeps the entire 3D input parameter grid (Roth conversions/targets x Your SS Claim Age x Spouse SS Claim Age)
 * to locate the optimal retirement scenario for a specific goal.
 */
export function optimizeRetirementScenario(
  inputs: AppStateInputs,
  goal: OptimizationGoal,
  simulateSurvivor: boolean,
  overrideSequence?: LockedReturnSequence | null
): OptimizationResult {
  const isFillToTarget = inputs.rothConversionStrategy === 'fill-to-target';

  let bestAnnualRothConversion = inputs.annualRothConversion;
  let bestTargetValue = inputs.rothConversionTargetValue;
  let bestYourSSAge = inputs.you.targetSSClaimingAge ?? 67;
  let bestWifeSSAge = inputs.wife.targetSSClaimingAge ?? 67;

  let bestScore = (goal === 'max_portfolio' || goal === 'max_roth') ? -Infinity : Infinity;
  let bestEndingEstate = -Infinity; // Secondary metric tie-breaker
  let bestResultDetails: OptimizationResult['details'] | null = null;

  // Search ranges for either flat annual conversion or target MAGI limit
  const rothChoices: number[] = [];
  for (let amt = 0; amt <= 400000; amt += 5000) {
    rothChoices.push(amt);
  }

  const yourAgeChoices = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  const wifeAgeChoices = [62, 63, 64, 65, 66, 67, 68, 69, 70];

  for (const choiceValue of rothChoices) {
    for (const yourAge of yourAgeChoices) {
      for (const wifeAge of wifeAgeChoices) {
        // Construct hypothetical inputs
        const testInputs: AppStateInputs = {
          ...inputs,
          rothConversionStrategy: inputs.rothConversionStrategy,
          annualRothConversion: isFillToTarget ? inputs.annualRothConversion : choiceValue,
          rothConversionTargetValue: isFillToTarget ? choiceValue : inputs.rothConversionTargetValue,
          you: {
            ...inputs.you,
            targetSSClaimingAge: yourAge,
          },
          wife: {
            ...inputs.wife,
            targetSSClaimingAge: wifeAge,
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

        // Survivor benefit: wife's SS in the first survivor year (2045), already inflation-adjusted in the ledger.
        const survivorRow = ledger.find((r) => r.year === 2045);
        const survivorBenefitAnnual = survivorRow ? survivorRow.wifeSS : 0;

        let score = 0;
        switch (goal) {
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
        }

        // Compare score
        let isBetter = false;
        if (goal === 'max_portfolio' || goal === 'max_roth') {
          if (score > bestScore) {
            isBetter = true;
          } else if (score === bestScore) {
            if (endingEstate > bestEndingEstate) {
              isBetter = true;
            }
          }
        } else {
          // Minimization goals
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
          if (isFillToTarget) {
            bestTargetValue = choiceValue;
          } else {
            bestAnnualRothConversion = choiceValue;
          }
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
