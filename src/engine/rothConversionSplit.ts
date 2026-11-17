import type { RothConversionSourceMode } from '../types';

/** Default share of each conversion taken from the primary spouse's IRA when no source is configured. */
export const DEFAULT_ROTH_SOURCE_YOUR_PERCENT = 50;

const PERCENT_DENOMINATOR = 100;

export interface RothConversionSplit {
  your: number;
  wife: number;
}

/**
 * Splits a household Roth conversion between the two spouses' traditional IRAs.
 *
 * `yourLimit` and `wifeLimit` are the most each spouse can convert (balance minus the RMD that must
 * stay in that spouse's own account). Anything one spouse cannot cover overflows to the other, so the
 * total converted is always min(target, yourLimit + wifeLimit).
 */
export function splitRothConversion(
  target: number,
  yourLimit: number,
  wifeLimit: number,
  mode: RothConversionSourceMode = 'percent',
  yourSharePercent: number = DEFAULT_ROTH_SOURCE_YOUR_PERCENT
): RothConversionSplit {
  const safeTarget = Math.max(0, target);
  const yourCap = Math.max(0, yourLimit);
  const wifeCap = Math.max(0, wifeLimit);

  if (mode === 'you-first') {
    const your = Math.min(safeTarget, yourCap);
    const wife = Math.min(safeTarget - your, wifeCap);
    return { your, wife };
  }
  if (mode === 'wife-first') {
    const wife = Math.min(safeTarget, wifeCap);
    const your = Math.min(safeTarget - wife, yourCap);
    return { your, wife };
  }

  const clampedPercent = Math.min(PERCENT_DENOMINATOR, Math.max(0, yourSharePercent));
  const yourWanted = safeTarget * (clampedPercent / PERCENT_DENOMINATOR);
  let your = Math.min(yourWanted, yourCap);
  let wife = Math.min(safeTarget - yourWanted, wifeCap);

  // Overflow: whatever one side could not cover goes to the other side's remaining room.
  const remainder = safeTarget - your - wife;
  if (remainder > 0) {
    const yourExtra = Math.min(remainder, yourCap - your);
    your += yourExtra;
    wife += Math.min(remainder - yourExtra, wifeCap - wife);
  }
  return { your, wife };
}

export interface RothConversionSourceNames {
  you: string;
  wife: string;
}

const FALLBACK_NAMES: RothConversionSourceNames = { you: 'You', wife: 'Spouse' };

/** Profile names for the two spouses, falling back to generic labels when a name is blank. */
export function getRothConversionSourceNames(
  yourName?: string | null,
  wifeName?: string | null
): RothConversionSourceNames {
  return {
    you: yourName?.trim() || FALLBACK_NAMES.you,
    wife: wifeName?.trim() || FALLBACK_NAMES.wife,
  };
}

/** Short human-readable description of the configured conversion source, for summaries and reports. */
export function describeRothConversionSource(
  mode: RothConversionSourceMode = 'percent',
  yourSharePercent: number = DEFAULT_ROTH_SOURCE_YOUR_PERCENT,
  names: RothConversionSourceNames = FALLBACK_NAMES
): string {
  if (mode === 'you-first') return `${names.you}, then ${names.wife}`;
  if (mode === 'wife-first') return `${names.wife}, then ${names.you}`;
  const clamped = Math.min(PERCENT_DENOMINATOR, Math.max(0, yourSharePercent));
  return `${clamped}% ${names.you} / ${PERCENT_DENOMINATOR - clamped}% ${names.wife}`;
}
