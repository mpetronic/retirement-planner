import React from 'react';
import { budgetBarGeometry, budgetBarLabel, BudgetBarStatus } from '../utils/budgetTracker';

interface BudgetProgressBarProps {
  name: string;
  ytdActual: number;
  ytdBudget: number;
}

const FILL_STYLES: Record<BudgetBarStatus, string> = {
  under: 'bg-emerald-500',
  on: 'bg-emerald-500',
  over: 'bg-rose-500',
  noBudget: 'bg-rose-500',
  none: 'bg-slate-700',
};
const LABEL_STYLES: Record<BudgetBarStatus, string> = {
  under: 'text-emerald-400',
  on: 'text-emerald-400',
  over: 'text-rose-400',
  noBudget: 'text-rose-400',
  none: 'text-slate-500',
};
const toPercentStyle = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({ name, ytdActual, ytdBudget }) => {
  const g = budgetBarGeometry(ytdActual, ytdBudget);
  const label = budgetBarLabel(g);
  const ariaLabel = label
    ? `${name}: ${label.replace('(', '').replace(')', '')} year to date budget`
    : `${name}: no year to date spend or budget`;

  return (
    <div role="img" aria-label={ariaLabel} className="flex items-center justify-end gap-2">
      <div className="relative h-3 w-32 shrink-0">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-800" />
        <div
          className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${FILL_STYLES[g.status]}`}
          style={{ left: 0, width: toPercentStyle(g.fill) }}
        />
        {g.marker !== null && (
          <div
            className="absolute top-0 h-3 w-0.5 bg-slate-200"
            style={{ left: toPercentStyle(g.marker) }}
          />
        )}
      </div>
      <span className={`w-20 text-left text-[11px] font-semibold whitespace-nowrap ${LABEL_STYLES[g.status]}`}>
        {label}
      </span>
    </div>
  );
};
