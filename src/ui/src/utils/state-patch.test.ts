import { describe, expect, it } from 'vitest';

import { applyPatch } from './state-patch';

describe('state-patch', () => {
  it('applies simple property changes', () => {
    const state = { name: 'test', value: 1 };
    const result = applyPatch(state, { value: 2 });
    expect(result).toEqual({ name: 'test', value: 2 });
  });

  it('applies nested property changes with dot notation', () => {
    const state = {
      clock: { timeRemainingMillis: 1200000, isRunning: false },
      period: 1,
    };
    const result = applyPatch(state, { 'clock.timeRemainingMillis': 1199000 });
    expect(result.clock.timeRemainingMillis).toBe(1199000);
    expect(result.clock.isRunning).toBe(false);
    expect(result.period).toBe(1);
  });

  it('applies multiple nested changes', () => {
    const state = {
      clock: { timeRemainingMillis: 1200000, isRunning: false },
      status: 'PRE_GAME',
    };
    const result = applyPatch(state, {
      'clock.timeRemainingMillis': 1199000,
      'clock.isRunning': true,
      status: 'PLAYING',
    });
    expect(result.clock.timeRemainingMillis).toBe(1199000);
    expect(result.clock.isRunning).toBe(true);
    expect(result.status).toBe('PLAYING');
  });

  it('creates intermediate objects if they do not exist', () => {
    const state = { value: 1 };
    const result = applyPatch(state, { 'nested.deep.value': 42 });
    expect((result as Record<string, unknown>).nested).toEqual({ deep: { value: 42 } });
  });

  it('does not mutate original state', () => {
    const state = {
      clock: { timeRemainingMillis: 1200000, isRunning: false },
    };
    const original = JSON.parse(JSON.stringify(state));
    applyPatch(state, { 'clock.timeRemainingMillis': 1199000 });
    expect(state).toEqual(original);
  });
});
