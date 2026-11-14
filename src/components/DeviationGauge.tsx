import React from 'react';
import { gaugeGeometry } from '../engine/rebalancingEngine';
import { FundStatus } from '../shared/types/rebalancing';

interface DeviationGaugeProps {
  symbol: string;
  currentPercent: number;
  targetPercent: number;
  thresholdPoints: number;
  status: FundStatus;
}

const MARKER_STYLES: Record<FundStatus, string> = {
  IN_BAND: 'bg-emerald-400',
  HIGH: 'bg-rose-400',
  LOW: 'bg-amber-400',
};
const PERCENT_DECIMALS = 1;
const toPercentStyle = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

export const DeviationGauge: React.FC<DeviationGaugeProps> = ({
  symbol,
  currentPercent,
  targetPercent,
  thresholdPoints,
  status,
}) => {
  const g = gaugeGeometry(currentPercent, targetPercent, thresholdPoints);
  const deviation = currentPercent - targetPercent;
  const side = deviation > 0 ? 'above' : 'below';
  const label =
    status === 'IN_BAND'
      ? `${symbol}: within the allowed band, ${Math.abs(deviation).toFixed(PERCENT_DECIMALS)} points ${side} target`
      : `${symbol}: ${Math.abs(deviation).toFixed(PERCENT_DECIMALS)} points ${side} target, outside the plus or minus ${thresholdPoints} point limit`;

  return (
    <div role="img" aria-label={label} className="inline-flex flex-col gap-0.5 w-40 align-middle">
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-800" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-600"
          style={{ left: toPercentStyle(g.lower), width: toPercentStyle(g.upper - g.lower) }}
        />
        <div
          className="absolute top-0 h-3 w-px bg-slate-400"
          style={{ left: toPercentStyle(g.target) }}
        />
        <div
          className={`absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm ${MARKER_STYLES[status]} ${
            g.clamped ? 'ring-1 ring-slate-950' : ''
          }`}
          style={{ left: toPercentStyle(g.marker) }}
        />
      </div>
      <div className="flex justify-between text-[10px] leading-none text-slate-500">
        <span>{(targetPercent - thresholdPoints).toFixed(PERCENT_DECIMALS)}%</span>
        <span>{(targetPercent + thresholdPoints).toFixed(PERCENT_DECIMALS)}%</span>
      </div>
    </div>
  );
};
