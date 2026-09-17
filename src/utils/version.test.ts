import { describe, it, expect } from 'vitest';
import {
  formatTimestampYYYYMMDDHHMMSS,
  computeDisplayVersion,
  getVersionInfo,
} from './version';

describe('version utilities', () => {
  describe('formatTimestampYYYYMMDDHHMMSS', () => {
    it('formats a date as exactly 14 characters YYYYMMDDHHMMSS with zero padding', () => {
      const fixedDate = new Date(2026, 4, 3, 8, 5, 9); // May 3, 2026 08:05:09
      const formatted = formatTimestampYYYYMMDDHHMMSS(fixedDate);
      expect(formatted).toBe('20260503080509');
      expect(formatted.length).toBe(14);
    });

    it('handles two-digit months, days, hours, minutes, and seconds properly', () => {
      const fixedDate = new Date(2026, 11, 25, 23, 59, 58); // Dec 25, 2026 23:59:58
      const formatted = formatTimestampYYYYMMDDHHMMSS(fixedDate);
      expect(formatted).toBe('20261225235958');
    });
  });

  describe('computeDisplayVersion', () => {
    it('returns clean commit short hash when untagged and clean', () => {
      const version = computeDisplayVersion({
        commitShort: 'aa1391b',
        isDirty: false,
      });
      expect(version).toBe('aa1391b');
    });

    it('returns tag when on exact tag and clean', () => {
      const version = computeDisplayVersion({
        lastTag: '0.0.7',
        tagDistance: 0,
        commitShort: 'aa1391b',
        isDirty: false,
      });
      expect(version).toBe('0.0.7');
    });

    it('returns tag with -dYYYYMMDDHHMMSS when on exact tag and dirty', () => {
      const version = computeDisplayVersion({
        lastTag: '0.0.7',
        tagDistance: 0,
        commitShort: 'aa1391b',
        isDirty: true,
        timestamp: '20260812080646',
      });
      expect(version).toBe('0.0.7-d20260812080646');
    });

    it('returns tag-distance-gcommit when ahead of tag and clean', () => {
      const version = computeDisplayVersion({
        lastTag: '0.0.7',
        tagDistance: 3,
        commitShort: 'ac2d10b',
        isDirty: false,
      });
      expect(version).toBe('0.0.7-3-gac2d10b');
    });

    it('returns tag-distance-gcommit-dYYYYMMDDHHMMSS when ahead of tag and dirty', () => {
      const version = computeDisplayVersion({
        lastTag: '0.0.7',
        tagDistance: 3,
        commitShort: 'ac2d10b',
        isDirty: true,
        timestamp: '20260812080646',
      });
      expect(version).toBe('0.0.7-3-gac2d10b-d20260812080646');
    });

    it('falls back to commitShort when no tag exists', () => {
      const version = computeDisplayVersion({
        commitShort: 'ac2d10b',
        isDirty: false,
      });
      expect(version).toBe('ac2d10b');
    });

    it('falls back to commitShort-dYYYYMMDDHHMMSS when untagged and dirty', () => {
      const version = computeDisplayVersion({
        commitShort: 'ac2d10b',
        isDirty: true,
        timestamp: '20260812080646',
      });
      expect(version).toBe('ac2d10b-d20260812080646');
    });

    it('falls back to dev when no commit or tag is provided', () => {
      const version = computeDisplayVersion({});
      expect(version).toBe('dev');
    });

    it('appends -d timestamp to dev when dirty and no commit or tag is provided', () => {
      const version = computeDisplayVersion({
        isDirty: true,
        timestamp: '20260812080646',
      });
      expect(version).toBe('dev-d20260812080646');
    });
  });

  describe('getVersionInfo', () => {
    it('returns a valid AppVersionInfo object', () => {
      const info = getVersionInfo();
      expect(info).toBeDefined();
      expect(typeof info.displayVersion).toBe('string');
      expect(typeof info.commitShort).toBe('string');
      expect(typeof info.isDirty).toBe('boolean');
      expect(typeof info.buildTimestamp).toBe('string');
    });
  });
});
