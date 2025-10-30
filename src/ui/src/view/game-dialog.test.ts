import { describe, it, expect } from 'vitest';

import { normalizeMinutes } from '../rec/game-time';
import { computeRecPeriods } from '../utils/rec-time';

describe('game-dialog', () => {
  it('imports rec utilities without errors', () => {
    expect(computeRecPeriods).toBeDefined();
    expect(normalizeMinutes).toBeDefined();
  });

  it('computeRecPeriods divides game time evenly', () => {
    const periods = computeRecPeriods(90, 120); // 90 min with 2 min shifts
    expect(periods.length).toBeGreaterThan(0);
    expect(periods.every((p) => typeof p === 'number')).toBe(true);
  });

  it('normalizeMinutes adjusts to shift boundaries', () => {
    const normalized = normalizeMinutes(91, 120); // 91 min with 2 min shifts
    expect(normalized).toBe(90); // Should round to nearest shift boundary
  });
});
