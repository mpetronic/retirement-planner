export const MONTHS_PER_YEAR = 12;
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const cumulate = (values: number[]): number[] => {
  let running = 0;
  return values.map((v) => (running += v));
};

export interface BudgetTrackerMetrics {
  hasElapsed: boolean;
  lastIdx: number;
  cumActual: number[];
  cumBudget: number[];
  ytdActual: number;
  ytdBudget: number;
  annualBudget: number;
  projectedYearEnd: number;
  projection: Array<number | null>;
  variance: Array<number | null>;
}

/**
 * Compares 12 monthly actuals against a 12 month budget schedule. Months after the current month
 * (for the current year) are treated as not yet elapsed. The year-end projection scales the remaining
 * budget schedule by the actual-to-budget pace so far, which respects lumpy due months.
 */
export const computeBudgetTracker = (
  monthlyActual: number[],
  monthlyBudget: number[],
  year: number,
  now: Date = new Date()
): BudgetTrackerMetrics => {
  const lastIdx = year < now.getFullYear() ? MONTHS_PER_YEAR - 1 : year > now.getFullYear() ? -1 : now.getMonth();
  const hasElapsed = lastIdx >= 0;

  const cumActual = cumulate(monthlyActual);
  const cumBudget = cumulate(monthlyBudget);
  const annualBudget = cumBudget[MONTHS_PER_YEAR - 1];
  const ytdActual = hasElapsed ? cumActual[lastIdx] : 0;
  const ytdBudget = hasElapsed ? cumBudget[lastIdx] : 0;

  const paceRatio = ytdBudget > 0 ? ytdActual / ytdBudget : 1;
  const projection: Array<number | null> = Array(MONTHS_PER_YEAR).fill(null);
  let projectedYearEnd = ytdActual;
  if (hasElapsed) {
    let running = ytdActual;
    projection[lastIdx] = running;
    for (let m = lastIdx + 1; m < MONTHS_PER_YEAR; m++) {
      running += monthlyBudget[m] * paceRatio;
      projection[m] = running;
    }
    projectedYearEnd = running;
  }

  const variance = monthlyBudget.map((b, m) => (m <= lastIdx ? b - monthlyActual[m] : null));

  return { hasElapsed, lastIdx, cumActual, cumBudget, ytdActual, ytdBudget, annualBudget, projectedYearEnd, projection, variance };
};

/** The bar scale never extends past this multiple of the budget, so one huge overage cannot flatten other rows. */
export const BAR_MAX_BUDGET_MULTIPLE = 2;
const PERCENT = 100;

export type BudgetBarStatus = 'under' | 'over' | 'on' | 'noBudget' | 'none';

export interface BudgetBarGeometry {
  /** Fraction of the track filled by actual spend, 0 to 1. */
  fill: number;
  /** Fraction of the track where the budget marker sits, or null when there is no budget. */
  marker: number | null;
  status: BudgetBarStatus;
  /** Whole percent that actual is above or below budget. Zero when there is no budget. */
  deviationPercent: number;
  /** True when the bar was cut off at the maximum scale. */
  clamped: boolean;
}

/** Geometry for a bullet bar comparing year-to-date actual spend with year-to-date budget. */
export const budgetBarGeometry = (ytdActual: number, ytdBudget: number): BudgetBarGeometry => {
  if (ytdBudget <= 0) {
    return ytdActual > 0
      ? { fill: 1, marker: null, status: 'noBudget', deviationPercent: 0, clamped: false }
      : { fill: 0, marker: null, status: 'none', deviationPercent: 0, clamped: false };
  }
  const scaleMax = Math.min(Math.max(ytdActual, ytdBudget), ytdBudget * BAR_MAX_BUDGET_MULTIPLE);
  const deviationPercent = Math.round((Math.abs(ytdActual - ytdBudget) / ytdBudget) * PERCENT);
  const status: BudgetBarStatus = deviationPercent === 0 ? 'on' : ytdActual > ytdBudget ? 'over' : 'under';
  return {
    fill: Math.min(ytdActual, scaleMax) / scaleMax,
    marker: ytdBudget / scaleMax,
    status,
    deviationPercent,
    clamped: ytdActual > scaleMax,
  };
};

/** Short annotation such as "63% (over)" or "22% (under)". */
export const budgetBarLabel = (g: BudgetBarGeometry): string => {
  switch (g.status) {
    case 'over':
    case 'under':
      return `${g.deviationPercent}% (${g.status})`;
    case 'on':
      return 'On budget';
    case 'noBudget':
      return 'No budget';
    default:
      return '';
  }
};

export interface LoggedSpendingSource {
  amount: number;
  category?: string;
  name?: string;
  categoryName?: string;
  catalogId?: string;
  categoryId?: string;
}

export interface LoggedSpendingSummary {
  /** Every logged expense for the year, healthcare included. Single source of truth for actual spending. */
  total: number;
  /** Non-healthcare spending by category group. */
  livingByCategory: Record<string, number>;
  living: number;
  healthcareOOP: number;
  premiums: number;
  irmaa: number;
}

/**
 * Splits a year of logged expenses into living and healthcare buckets. Always pass the full year,
 * never a month-filtered list, so the total matches every other consumer of actual spending.
 */
export const summarizeLoggedSpending = (expenses: LoggedSpendingSource[]): LoggedSpendingSummary => {
  const summary: LoggedSpendingSummary = { total: 0, livingByCategory: {}, living: 0, healthcareOOP: 0, premiums: 0, irmaa: 0 };
  for (const exp of expenses) {
    const catLower = (exp.categoryName || `${exp.category} ${exp.name}`).toLowerCase();
    const idLower = (exp.catalogId || exp.categoryId || '').toLowerCase();
    summary.total += exp.amount;
    if (
      idLower === 'healthcare-oop' ||
      catLower.includes('out-of-pocket') ||
      catLower.includes('deductible') ||
      catLower.includes('copay') ||
      catLower.includes('co-pay')
    ) {
      summary.healthcareOOP += exp.amount;
    } else if (
      idLower === 'healthcare-premiums' ||
      catLower.includes('insurance premium') ||
      catLower.includes('medicare part b') ||
      catLower.includes('supplement')
    ) {
      summary.premiums += exp.amount;
    } else if (idLower === 'healthcare-irmaa' || catLower.includes('irmaa') || catLower.includes('surcharge')) {
      summary.irmaa += exp.amount;
    } else {
      const group =
        exp.category ||
        (exp.categoryName && exp.categoryName.includes(' - ')
          ? exp.categoryName.split(' - ')[0].trim()
          : exp.categoryName || 'Uncategorized');
      summary.livingByCategory[group] = (summary.livingByCategory[group] || 0) + exp.amount;
      summary.living += exp.amount;
    }
  }
  return summary;
};
