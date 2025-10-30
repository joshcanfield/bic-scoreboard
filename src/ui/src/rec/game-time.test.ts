import { describe, expect, it } from 'vitest'

import {
  buildDivisibleHint,
  buildLastBuzzerHint,
  buildRecHelperText,
  buildSplitHint,
  computeMinutesFromEnds,
  formatEndsOptionLabel,
  formatEndsOptionValue,
  generateEndsOptions,
  normalizeMinutes,
  roundToNearestFive,
  toShiftTotal
} from './game-time'

describe('rec game helpers', () => {
  it('coerces shift totals based on enabled state', () => {
    expect(toShiftTotal('120', true)).toBe(120)
    expect(toShiftTotal(null, true)).toBe(0)
    expect(toShiftTotal('45', false)).toBe(0)
  })

  it('normalizes minutes using shift granularity', () => {
    expect(normalizeMinutes(63, 120)).toBe(60)
    expect(normalizeMinutes(30, 0)).toBe(30)
  })

  it('renders helper strings for minutes and shifts', () => {
    const noShift = buildRecHelperText(45, 0)
    expect(noShift).toContain('Game: 45 min')
    expect(noShift).toContain('Shifts: disabled')

    const withShift = buildRecHelperText(60, 90)
    expect(withShift).toContain('Shifts: 40')
    expect(withShift).toContain('01:30')

    expect(buildSplitHint(30, 0)).toBe('')
    expect(typeof buildDivisibleHint(60, 90)).toBe('string')
  })

  it('formats end option values and labels', () => {
    const dt = new Date(2024, 0, 1, 13, 5)
    expect(formatEndsOptionValue(dt)).toBe('13:05')
    expect(formatEndsOptionLabel(new Date(2024, 0, 1, 0, 0))).toBe('12:00 AM')
  })

  it('rounds to nearest five minutes', () => {
    const snap = roundToNearestFive(new Date(2024, 0, 1, 10, 17))
    expect(snap.getMinutes()).toBe(15)
  })

  it('generates ends options around now and selects target', () => {
    const target = new Date(2024, 0, 1, 15, 30)
    const { options, selectedValue } = generateEndsOptions(target, 1)
    expect(options.some(o => o.value === selectedValue)).toBe(true)
    expect(options.length).toBeGreaterThan(0)
  })

  it('computes minutes from end selections and last buzzer hints', () => {
    const now = new Date(2024, 0, 1, 12, 0)
    expect(computeMinutesFromEnds('13:30', now)).toBeGreaterThan(0)
    expect(computeMinutesFromEnds('bad', now)).toBeNull()
    expect(buildLastBuzzerHint('13:30', 90, now)).toContain('Last buzzer:')
    expect(buildLastBuzzerHint('13:30', 0, now)).toBe('')
  })
})
