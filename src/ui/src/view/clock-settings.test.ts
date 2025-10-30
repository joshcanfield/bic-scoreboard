import { describe, it, expect } from 'vitest';

import { parseClockMillis } from '../utils/time';

describe('clock-settings', () => {
  it('imports without errors', () => {
    expect(parseClockMillis).toBeDefined();
  });

  it('parseClockMillis handles various formats', () => {
    expect(parseClockMillis('20:00')).toBe(20 * 60 * 1000);
    expect(parseClockMillis('1500')).toBe(15 * 60 * 1000);
    expect(parseClockMillis('5:30')).toBe(5.5 * 60 * 1000);
  });
});
