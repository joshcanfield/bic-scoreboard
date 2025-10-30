import { describe, expect, it } from 'vitest';

import { buildControlView, deriveControlState } from './control-state';

const buildUpdate = () => ({
  time: 120000,
  running: true,
  period: 2,
  periodLength: 20,
  gameState: 'IN_PROGRESS' as const,
  home: {
    score: 5,
    shots: 12,
    penalties: [
      { id: 1, time: 120000, elapsed: 60000, playerNumber: 12, period: 1, offIceTime: 0, startTime: 0 },
    ],
  },
  away: {
    score: 3,
    shots: 8,
    penalties: [],
  },
  scoreboardOn: true,
  buzzerOn: false,
});

describe('control state helpers', () => {
  it('derives control state from update payloads', () => {
    const state = deriveControlState(buildUpdate());
    expect(state).toMatchObject({
      time: 120000,
      running: true,
      period: 2,
      periodLengthMillis: 20 * 60 * 1000,
      scoreboardOn: true,
      buzzerOn: false,
    });
    expect(state.home.score).toBe(5);
    expect(state.away.penalties).toEqual([]);
  });

  it('builds a control view model for rendering', () => {
    const state = deriveControlState(buildUpdate());
    const view = buildControlView(state);

    expect(view.clockText).toBe('02:00');
    expect(view.elapsedText).toBe('18 minutes and 0 seconds');
    expect(view.homeScoreDigits).toEqual([0, 5]);
    expect(view.homeScoreText).toBe('05');
    expect(view.awayScoreText).toBe('03');
    expect(view.homeShotsText).toBe('12');
    expect(view.awayShotsText).toBe('8');
    expect(view.homePenalties).toHaveLength(1);
  });

  it('returns non-breaking space for elapsed text when period length is zero', () => {
    const state = deriveControlState({ ...buildUpdate(), periodLength: 0 });
    const view = buildControlView(state);
    expect(view.elapsedText).toBe('\u00a0');
  });
});
