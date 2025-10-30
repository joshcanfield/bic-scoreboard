import { describe, expect, it } from 'vitest';

import {
  computeRecPeriods,
  gcd,
  lcm,
  minutesStepForShift,
  minutesStepForShiftOnly,
  normalizeMinutes
} from './rec-time';

describe('rec time utilities', () => {
  it('computes gcd and lcm for integer inputs', () => {
    expect(gcd(60, 42)).toBe(6);
    expect(gcd(7, 0)).toBe(7);
    expect(lcm(15, 4)).toBe(60);
  });

  it('falls back to base step when shift is disabled', () => {
    expect(minutesStepForShift(0)).toBe(15);
    expect(minutesStepForShift(-30)).toBe(15);
  });

  it('aligns minute steps with shift duration', () => {
    expect(minutesStepForShift(90)).toBe(15);
    expect(minutesStepForShift(120)).toBe(30);
  });

  it('calculates shift-only minute granularity', () => {
    expect(minutesStepForShiftOnly(90)).toBe(3);
    expect(minutesStepForShiftOnly(0)).toBe(1);
  });

  it('normalizes minutes down to the nearest aligned step', () => {
    expect(normalizeMinutes(62, 120)).toBe(60);
    expect(normalizeMinutes(5, 90)).toBe(15);
  });

  it('splits rec games into period chunks within limits', () => {
    expect(computeRecPeriods(150, 120)).toEqual([90, 60]);
    expect(computeRecPeriods(30, 0)).toEqual([30]);
    expect(computeRecPeriods(0, 90)).toEqual([]);
  });
});
