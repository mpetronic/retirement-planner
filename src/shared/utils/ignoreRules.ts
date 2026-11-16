/**
 * User-defined "ignore rows" patterns for a statement format. A row whose description matches
 * any pattern is excluded from import, the same way automatic payments and transfers are.
 */

/** Longest pattern accepted; keeps the stored list readable and limits pathological regexes. */
export const MAX_IGNORE_PATTERN_LENGTH = 200;

/** Returns an error message when the pattern cannot be used, or null when it is valid. */
export function validateIgnorePattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (!trimmed) return 'Enter a pattern.';
  if (trimmed.length > MAX_IGNORE_PATTERN_LENGTH) {
    return `Patterns are limited to ${MAX_IGNORE_PATTERN_LENGTH} characters.`;
  }
  try {
    new RegExp(trimmed, 'i');
  } catch (err) {
    return err instanceof Error ? err.message.replace(/^Invalid regular expression: /, '') : 'Invalid pattern.';
  }
  return null;
}

/** Compiles the valid patterns (case-insensitive); blank or invalid entries are skipped, never thrown. */
export function compileIgnorePatterns(patterns?: string[]): RegExp[] {
  const regexes: RegExp[] = [];
  for (const pattern of patterns ?? []) {
    if (validateIgnorePattern(pattern) !== null) continue;
    regexes.push(new RegExp(pattern.trim(), 'i'));
  }
  return regexes;
}

/** True when the description matches any compiled pattern. */
export function isIgnoredByPatterns(description: string, regexes: RegExp[]): boolean {
  return regexes.some(rx => rx.test(description));
}

/**
 * Replaces the pattern at `index`, keeping its position. Fails with an error message when the new
 * text is blank, invalid, too long, or already used by another pattern. Re-saving the same text is fine.
 */
export function replaceIgnorePattern(
  patterns: string[],
  index: number,
  next: string
): { patterns: string[] } | { error: string } {
  if (index < 0 || index >= patterns.length) return { error: 'That pattern no longer exists.' };
  const trimmed = next.trim();
  const error = validateIgnorePattern(trimmed);
  if (error) return { error };
  if (patterns.some((p, i) => i !== index && p === trimmed)) {
    return { error: 'That pattern is already in the list.' };
  }
  return { patterns: patterns.map((p, i) => (i === index ? trimmed : p)) };
}
