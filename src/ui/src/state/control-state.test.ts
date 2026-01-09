import { describe, expect, it } from 'vitest';
import type { GameState } from '../api/v2-types';

import { buildControlView, deriveControlState } from './control-state';

// Helper to build a v2 GameState
const buildV2GameState = (): GameState => ({
  gameId: 'game-123',
  config: {
    templateId: 'USAH_ADULT_20',
    warmupLengthMinutes: 5,
    warmupLengthMillis: 300000,
    periodLengthMinutes: 20,
    periodLengthMillis: 1200000,
    intermissionLengthMinutes: 1,
    intermissionLengthMillis: 60000,
    periods: 3,
    clockType: 'STOP_TIME',
    shiftLengthSeconds: null,
  },
  status: 'PLAYING',
  period: 2,
  clock: {
    timeRemainingMillis: 600000,
    isRunning: true,
    startTimeWallClock: Date.now(),
  },
  home: {
    goals: [
      {
        goalId: 'goal-1',
        teamId: 'home',
        period: 1,
        timeInPeriodMillis: 1100000,
        scorerNumber: 10,
        assistNumbers: [7],
        isEmptyNet: false,
      },
    ],
    shots: 15,
    penalties: [
      {
        penaltyId: 'pen-1',
        teamId: 'home',
        playerNumber: 12,
        servingPlayerNumber: 12,
        durationMillis: 120000,
        timeRemainingMillis: 60000,
        startTimeWallClock: Date.now() - 60000,
        period: 2,
      },
    ],
  },
  away: {
    goals: [],
    shots: 8,
    penalties: [],
  },
  buzzerOn: false,
  eventHistory: [],
});

// Helper to build legacy update payload
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

  describe('v2 GameState format', () => {
    it('derives control state from v2 GameState', () => {
      const gameState = buildV2GameState();
      const state = deriveControlState(gameState);

      expect(state).toMatchObject({
        time: 600000,
        running: true,
        period: 2,
        periodLengthMillis: 1200000,
        gameState: 'PLAYING',
        scoreboardOn: true,
        buzzerOn: false,
      });
    });

    it('calculates score from goals array length', () => {
      const gameState = buildV2GameState();
      const state = deriveControlState(gameState);

      expect(state.home.score).toBe(1); // 1 goal in home.goals
      expect(state.away.score).toBe(0); // 0 goals in away.goals
    });

    it('preserves goals array in team state', () => {
      const gameState = buildV2GameState();
      const state = deriveControlState(gameState);

      expect(state.home.goals).toHaveLength(1);
      expect(state.home.goals![0].scorerNumber).toBe(10);
      expect(state.home.goals![0].assistNumbers).toEqual([7]);
    });

    it('preserves shots from v2 GameState', () => {
      const gameState = buildV2GameState();
      const state = deriveControlState(gameState);

      expect(state.home.shots).toBe(15);
      expect(state.away.shots).toBe(8);
    });

    it('preserves penalties from v2 GameState', () => {
      const gameState = buildV2GameState();
      const state = deriveControlState(gameState);

      expect(state.home.penalties).toHaveLength(1);
      expect(state.home.penalties[0].playerNumber).toBe(12);
      expect(state.home.penalties[0].timeRemainingMillis).toBe(60000);
    });

    it('handles v2 GameState with null config', () => {
      const gameState: GameState = {
        ...buildV2GameState(),
        config: null,
      };
      const state = deriveControlState(gameState);

      expect(state.periodLengthMillis).toBe(0);
    });

    it('builds control view from v2-derived state', () => {
      const gameState = buildV2GameState();
      const state = deriveControlState(gameState);
      const view = buildControlView(state);

      expect(view.clockText).toBe('10:00');
      expect(view.homeScoreText).toBe('01');
      expect(view.awayScoreText).toBe('00');
      expect(view.homeShotsText).toBe('15');
      expect(view.awayShotsText).toBe('8');
      expect(view.homePenalties).toHaveLength(1);
    });
  });
});
