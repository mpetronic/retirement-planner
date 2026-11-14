/**
 * Formats a build timestamp (ISO 8601) as a readable date and time in the viewer's
 * local time zone, for example "Nov 13, 2026, 3:49 PM". Returns the input unchanged
 * when it cannot be parsed, so the About screen never shows "Invalid Date".
 */
export function formatBuildTime(isoTime: string, locale?: string): string {
  const parsed = new Date(isoTime);
  if (!isoTime || Number.isNaN(parsed.getTime())) return isoTime || 'Unknown';
  return parsed.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
