import { describe, it, expect } from 'vitest';

import { parseClockMillis } from '../utils/time';

describe('penalty-dialog', () => {
  it('imports without errors', () => {
    expect(parseClockMillis).toBeDefined();
  });

  it('parseClockMillis handles penalty times', () => {
    expect(parseClockMillis('2:00')).toBe(2 * 60 * 1000);
    expect(parseClockMillis('5:00')).toBe(5 * 60 * 1000);
    expect(parseClockMillis('10:00')).toBe(10 * 60 * 1000);
  });
});
