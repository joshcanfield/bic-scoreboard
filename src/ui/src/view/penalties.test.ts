import { describe, expect, it } from 'vitest';

import type { Penalty } from '../state/control-state';

import { buildPenaltyTable, buildPlaceholderRows, filterActivePenalties, isPenaltyActive } from './penalties';

const basePenalty = (overrides: Partial<Penalty>): Penalty =>
  ({
    id: 1,
    playerNumber: 10,
    servingPlayerNumber: undefined,
    time: 120000,
    elapsed: 0,
    period: 1,
    offIceTime: 0,
    startTime: 0,
    ...overrides,
  } as Penalty);

describe('penalty view helpers', () => {
  it('filters active penalties based on remaining time', () => {
    const penalties: Penalty[] = [
      basePenalty({ id: 1, time: 120000, startTime: 0 }),
      basePenalty({ id: 2, time: 60000, elapsed: 60000, startTime: 60000 }),
      basePenalty({ id: 3, time: 90000, elapsed: 30000, startTime: 60000 }),
    ];

    expect(isPenaltyActive(penalties[0])).toBe(true);
    expect(isPenaltyActive(penalties[1])).toBe(false);
    expect(isPenaltyActive(penalties[2])).toBe(true);
    expect(filterActivePenalties(penalties).map((p) => p.id)).toEqual([1, 3]);
  });

  it('builds penalty rows, details, and placeholders for a table', () => {
    const penalties: Penalty[] = [
      basePenalty({ id: 1, playerNumber: 12, servingPlayerNumber: 8 }),
      basePenalty({ id: 2, playerNumber: 9, startTime: 90000, elapsed: 30000 }),
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
