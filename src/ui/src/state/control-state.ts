import type { GameState, Penalty as V2Penalty, GoalEvent } from '../api/v2-types';
import { digits2, formatClock, millisToMinSec } from '../utils/time';

// Re-export v2 types for backwards compatibility
export type Penalty = V2Penalty;
export type Goal = GoalEvent;

export interface TeamControlState {
  score: number;
  shots: number;
  penalties: Penalty[];
  goals?: Goal[];
}

export interface ControlState {
  time: number;
  running: boolean;
  period: number;
  periodLengthMillis: number;
  gameState: string;
  scoreboardOn: boolean;
  buzzerOn: boolean;
  home: TeamControlState;
  away: TeamControlState;
}

export interface ControlView {
  clockText: string;
  elapsedText: string;
  periodText: string;
  homeScoreDigits: [number, number];
  awayScoreDigits: [number, number];
  homeScoreText: string;
  awayScoreText: string;
  homeShotsText: string;
  awayShotsText: string;
  homePenalties: Penalty[];
  awayPenalties: Penalty[];
  scoreboardOn: boolean;
  buzzerOn: boolean;
  gameState: string;
}

// Legacy penalty format for tests
export interface LegacyPenalty {
  id: number;
  playerNumber: number;
  servingPlayerNumber?: number;
  time: number;
  elapsed: number;
  period: number;
  offIceTime?: number;
  startTime?: number;
}

// Legacy update payload for tests (simplified)
export interface LegacyUpdatePayload {
  time?: number;
  running?: boolean;
  period?: number;
  periodLength?: number;
  gameState?: string;
  scoreboardOn?: boolean;
  buzzerOn?: boolean;
  home?: {
    score?: number;
    shots?: number;
    penalties?: LegacyPenalty[];
    goals?: Goal[];
  };
  away?: {
    score?: number;
    shots?: number;
    penalties?: LegacyPenalty[];
    goals?: Goal[];
  };
}

/**
 * Helper to check if a penalty is still active (has time remaining)
 */
function isPenaltyActive(penalty: Penalty): boolean {
  return penalty.timeRemainingMillis > 0;
}

/**
 * Filter penalties to only active ones
 */
function filterActivePenalties(penalties: Penalty[]): Penalty[] {
  return penalties.filter(isPenaltyActive);
}

/**
 * Derives a normalized control state from a v2 GameState or legacy update payload
 */
export function deriveControlState(update: GameState | LegacyUpdatePayload): ControlState {
  // Handle v2 GameState format
  if ('clock' in update && update.clock) {
    const state = update as GameState;
    return {
      time: state.clock.timeRemainingMillis,
      running: state.clock.isRunning,
      period: state.period,
      periodLengthMillis: state.config?.periodLengthMillis ?? 0,
      gameState: state.status,
      scoreboardOn: true, // v2 doesn't have this in state
      buzzerOn: state.buzzerOn,
      home: {
        score: state.home.goals.length,
        shots: state.home.shots,
        penalties: state.home.penalties,
        goals: state.home.goals,
      },
      away: {
        score: state.away.goals.length,
        shots: state.away.shots,
        penalties: state.away.penalties,
        goals: state.away.goals,
      },
    };
  }

  // Handle legacy update payload format (for tests)
  const legacy = update as LegacyUpdatePayload;

  // Convert legacy penalties to v2 format
  const convertLegacyPenalties = (legacyPenalties?: LegacyPenalty[]): Penalty[] => {
    if (!legacyPenalties) return [];
    return legacyPenalties.map((p) => ({
      penaltyId: String(p.id),
      teamId: 'home' as const,
      playerNumber: p.playerNumber,
      servingPlayerNumber: p.servingPlayerNumber ?? p.playerNumber,
      durationMillis: p.time,
      timeRemainingMillis: p.time - p.elapsed,
      startTimeWallClock: p.startTime ?? 0,
      period: p.period,
    }));
  };

  return {
    time: legacy.time ?? 0,
    running: legacy.running ?? false,
    period: legacy.period ?? 0,
    periodLengthMillis: (legacy.periodLength ?? 0) * 60 * 1000,
    gameState: legacy.gameState ?? 'PRE_GAME',
    scoreboardOn: legacy.scoreboardOn ?? false,
    buzzerOn: legacy.buzzerOn ?? false,
    home: {
      score: legacy.home?.score ?? 0,
      shots: legacy.home?.shots ?? 0,
      penalties: convertLegacyPenalties(legacy.home?.penalties),
      goals: legacy.home?.goals,
    },
    away: {
      score: legacy.away?.score ?? 0,
      shots: legacy.away?.shots ?? 0,
      penalties: convertLegacyPenalties(legacy.away?.penalties),
      goals: legacy.away?.goals,
    },
  };
}

/**
 * Builds a view model for rendering the control UI
 */
export function buildControlView(state: ControlState): ControlView {
  const { minutes, seconds } = millisToMinSec(state.time);
  const clockText = formatClock(minutes, seconds);

  let elapsedText = '\u00a0'; // non-breaking space as default
  if (state.periodLengthMillis > 0) {
    const elapsedMillis = state.periodLengthMillis - state.time;
    const elapsedParts = millisToMinSec(elapsedMillis);
    elapsedText = `${elapsedParts.minutes} minutes and ${elapsedParts.seconds} seconds`;
  }

  return {
    clockText,
    elapsedText,
    periodText: String(state.period),
    homeScoreDigits: digits2(state.home.score),
    awayScoreDigits: digits2(state.away.score),
    homeScoreText: String(state.home.score).padStart(2, '0'),
    awayScoreText: String(state.away.score).padStart(2, '0'),
    homeShotsText: String(state.home.shots),
    awayShotsText: String(state.away.shots),
    homePenalties: filterActivePenalties(state.home.penalties),
    awayPenalties: filterActivePenalties(state.away.penalties),
    scoreboardOn: state.scoreboardOn,
    buzzerOn: state.buzzerOn,
    gameState: state.gameState,
  };
}
