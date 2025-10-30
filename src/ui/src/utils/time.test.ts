import { describe, expect, it } from 'vitest';

import {
  digits2,
  formatClock,
  millisToMinSec,
  pad,
  parseClock,
  parseClockMillis,
  roundToSecond
} from './time';

describe('time utilities', () => {
  it('pads numbers with leading zeros', () => {
    expect(pad(5, 2)).toBe('05');
    expect(pad('12', 4)).toBe('0012');
    expect(pad(1234, 2)).toBe('34');
  });

  it('splits numbers into digits', () => {
    expect(digits2(42)).toEqual([4, 2]);
    expect(digits2(7)).toEqual([0, 7]);
  });

  it('parses clock strings into minutes and seconds', () => {
    expect(parseClock('12:34')).toEqual({ minutes: 12, seconds: 34 });
    expect(parseClock('9')).toEqual({ minutes: 0, seconds: 9 });
    expect(parseClock('bad')).toBeNull();
  });

  it('converts clock strings to milliseconds', () => {
    expect(parseClockMillis('01:30')).toBe(90000);
    expect(parseClockMillis(45000)).toBe(45000);
    expect(parseClockMillis('x')).toBeNull();
  });

  it('formats minutes and seconds into clock string', () => {
    expect(formatClock(3, 5)).toBe('03:05');
  });

  it('turns milliseconds into minutes and seconds', () => {
    expect(millisToMinSec(125000)).toEqual({ minutes: 2, seconds: 5 });
  });

  it('rounds arbitrary milliseconds up to the nearest second', () => {
    expect(roundToSecond(1010)).toBe(2000);
    expect(roundToSecond(null)).toBe(0);
  });
});
