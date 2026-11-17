/** Decimal places shown for the Monte Carlo success rate. Two places resolve a single failed trial out of 5,000 (0.02%). */
export const SUCCESS_RATE_DECIMALS = 2;

/**
 * Formats a Monte Carlo success rate (0..1) as a percentage string. Shared by every place that shows
 * the rate so the dashboard and the Plan Health Summary never disagree through rounding.
 */
export function formatSuccessRate(rate: number): string {
  const scale = 10 ** SUCCESS_RATE_DECIMALS;
  const rounded = Math.round((rate * 100 + Number.EPSILON) * scale) / scale;
  return `${rounded.toFixed(SUCCESS_RATE_DECIMALS)}%`;
}
