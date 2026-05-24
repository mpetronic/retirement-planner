import { AppStateInputs } from '../types';
import { runRetirementSimulation } from './simulationEngine';

export interface OptimizationResult {
  bestAnnualRothConversion: number;
  bestYourSSAge: number;
  bestWifeSSAge: number;
  metricValue: number;
  details: {
    endingEstate: number;
    lifetimeTaxes: number;
    lifetimeIRMAA: number;
    endingRoth: number;
  };
}

export type OptimizationGoal = 'min_taxes' | 'max_portfolio' | 'min_surcharges' | 'max_roth';

/**
 * Sweeps the entire 3D input parameter grid (Roth conversions x Your SS Claim Age x Spouse SS Claim Age)
 * to locate the optimal retirement scenario for a specific goal.
 */
export function optimizeRetirementScenario(
  inputs: AppStateInputs,
  goal: OptimizationGoal,
  simulateSurvivor: boolean
): OptimizationResult {
  let bestAnnualRothConversion = inputs.annualRothConversion;
  let bestYourSSAge = inputs.you.targetSSClaimingAge;
  let bestWifeSSAge = inputs.wife.targetSSClaimingAge;

  let bestScore = (goal === 'max_portfolio' || goal === 'max_roth') ? -Infinity : Infinity;
  let bestEndingEstate = -Infinity; // Secondary metric tie-breaker
  let bestResultDetails: OptimizationResult['details'] | null = null;

  // Search ranges
  const rothConversionChoices: number[] = [];
  for (let amt = 0; amt <= 400000; amt += 5000) {
    rothConversionChoices.push(amt);
  }

  const yourAgeChoices = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  const wifeAgeChoices = [62, 63, 64, 65, 66, 67, 68, 69, 70];

  for (const annualConversion of rothConversionChoices) {
    for (const yourAge of yourAgeChoices) {
      for (const wifeAge of wifeAgeChoices) {
        // Construct hypothetical inputs
        const testInputs: AppStateInputs = {
          ...inputs,
          annualRothConversion: annualConversion,
          you: {
            ...inputs.you,
            targetSSClaimingAge: yourAge,
          },
          wife: {
            ...inputs.wife,
            targetSSClaimingAge: wifeAge,
          },
        };

        const ledger = runRetirementSimulation(testInputs, simulateSurvivor);
        if (ledger.length === 0) continue;

        // Compute metrics
        const finalRow = ledger[ledger.length - 1];
        const endingEstate = finalRow.totalPortfolioValue;
        const lifetimeTaxes = ledger.reduce((sum, r) => sum + r.totalIncomeTax, 0);
        const lifetimeIRMAA = ledger.reduce((sum, r) => sum + r.combinedSurchargeAnnual, 0);
        const endingRoth = finalRow.endYourRothIRA + finalRow.endWifeRothIRA;

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
            // Secondary tie-breaker: maximize total estate
            if (endingEstate > bestEndingEstate) {
              isBetter = true;
            }
          }
        } else {
          // Minimization goals
          if (score < bestScore) {
            isBetter = true;
          } else if (score === bestScore) {
            // Secondary tie-breaker: maximize total estate
            if (endingEstate > bestEndingEstate) {
              isBetter = true;
            }
          }
        }

        if (isBetter) {
          bestScore = score;
          bestEndingEstate = endingEstate;
          bestAnnualRothConversion = annualConversion;
          bestYourSSAge = yourAge;
          bestWifeSSAge = wifeAge;
          bestResultDetails = {
            endingEstate,
            lifetimeTaxes,
            lifetimeIRMAA,
            endingRoth,
          };
        }
      }
    }
  }

  return {
    bestAnnualRothConversion,
    bestYourSSAge,
    bestWifeSSAge,
    metricValue: bestScore,
    details: bestResultDetails || {
      endingEstate: 0,
      lifetimeTaxes: 0,
      lifetimeIRMAA: 0,
      endingRoth: 0,
    },
  };
}
