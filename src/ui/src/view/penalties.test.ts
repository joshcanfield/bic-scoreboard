import { describe, expect, it } from 'vitest';

import type { Penalty } from '../api/v2-types';

import { buildPenaltyTable, buildPlaceholderRows, filterActivePenalties, isPenaltyActive } from './penalties';

const basePenalty = (overrides: Partial<Penalty>): Penalty => ({
  penaltyId: '1',
  teamId: 'home',
  playerNumber: 10,
  servingPlayerNumber: 10,
  durationMillis: 120000,
  timeRemainingMillis: 120000,
  startTimeWallClock: 0,
  period: 1,
  ...overrides,
});

describe('penalty view helpers', () => {
  it('filters active penalties based on remaining time', () => {
    const penalties: Penalty[] = [
      basePenalty({ penaltyId: '1', durationMillis: 120000, timeRemainingMillis: 120000 }),
      basePenalty({ penaltyId: '2', durationMillis: 60000, timeRemainingMillis: 0 }), // expired
      basePenalty({ penaltyId: '3', durationMillis: 90000, timeRemainingMillis: 60000 }),
    ];

    expect(isPenaltyActive(penalties[0])).toBe(true);
    expect(isPenaltyActive(penalties[1])).toBe(false);
    expect(isPenaltyActive(penalties[2])).toBe(true);
    expect(filterActivePenalties(penalties).map((p) => p.penaltyId)).toEqual(['1', '3']);
  });

  it('builds penalty rows, details, and placeholders for a table', () => {
    const penalties: Penalty[] = [
      basePenalty({ penaltyId: '1', playerNumber: 12, servingPlayerNumber: 8 }),
      basePenalty({ penaltyId: '2', playerNumber: 9, timeRemainingMillis: 90000 }),
    ];

    const table = buildPenaltyTable('home', penalties);

    expect(table.activePenalties).toHaveLength(2);
    expect(table.details.map((d) => d.id)).toEqual(['1', '2']);
    expect(table.rowsHtml).toContain('data-team="home"');
    expect(table.rowsHtml).toContain('data-serving="8"');
    expect(table.placeholderHtml).toBe('');
  });

  it('renders placeholder rows when active penalties are below minimum', () => {
    const table = buildPenaltyTable('away', []);
    expect(table.rowsHtml).toBe('');
    expect(table.details).toEqual([]);
    expect(table.placeholderHtml).toBe(buildPlaceholderRows(2));
  });
});
