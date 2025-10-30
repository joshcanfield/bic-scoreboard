import { describe, it, expect } from 'vitest';

import { sanitizeHex, relLuminance } from './team-colors';

describe('team-colors', () => {
  describe('sanitizeHex', () => {
    it('accepts valid 6-character hex codes', () => {
      expect(sanitizeHex('#ff0000')).toBe('#ff0000');
      expect(sanitizeHex('#AABBCC')).toBe('#AABBCC');
    });

    it('accepts valid 3-character hex codes', () => {
      expect(sanitizeHex('#f00')).toBe('#f00');
      expect(sanitizeHex('#ABC')).toBe('#ABC');
    });

    it('returns empty string for invalid formats', () => {
      expect(sanitizeHex('ff0000')).toBe('');
      expect(sanitizeHex('#gg0000')).toBe('');
      expect(sanitizeHex('#ff00')).toBe('');
      expect(sanitizeHex('not-a-color')).toBe('');
      expect(sanitizeHex(null)).toBe('');
    });

    it('trims whitespace', () => {
      expect(sanitizeHex('  #ff0000  ')).toBe('#ff0000');
    });
  });

  describe('relLuminance', () => {
    it('calculates luminance for black as close to 0', () => {
      expect(relLuminance('#000000')).toBeCloseTo(0, 2);
    });

    it('calculates luminance for white as close to 1', () => {
      expect(relLuminance('#ffffff')).toBeCloseTo(1, 2);
    });

    it('calculates luminance for red', () => {
      const lum = relLuminance('#ff0000');
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(0.5);
    });

    it('handles 3-character hex codes', () => {
      expect(relLuminance('#fff')).toBeCloseTo(1, 2);
      expect(relLuminance('#000')).toBeCloseTo(0, 2);
    });
  });
});
