export interface PlannerProfileNames {
  primaryName: string;
  spouseName: string;
  isSingleFiler: boolean;
}

export function getPlannerProfileNames(): PlannerProfileNames {
  if (typeof window === 'undefined') {
    return { primaryName: 'Primary', spouseName: 'Spouse', isSingleFiler: false };
  }

  try {
    const raw = window.localStorage.getItem('retirement_planner_inputs');
    if (raw) {
      const parsed = JSON.parse(raw);
      const primaryName = parsed.you?.name?.trim() || 'Primary';
      const spouseName = parsed.wife?.name?.trim() || parsed.spouse?.name?.trim() || 'Spouse';
      const isSingleFiler = Boolean(parsed.isSingleFiler);
      return { primaryName, spouseName, isSingleFiler };
    }
  } catch (err) {
    console.error('Failed to read planner profile names from localStorage:', err);
  }

  return { primaryName: 'Primary', spouseName: 'Spouse', isSingleFiler: false };
}
