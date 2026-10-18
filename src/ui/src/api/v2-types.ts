/**
 * TypeScript types matching the v2 Java backend domain models.
 * These types are used for WebSocket communication with GameWebSocketV2.
 */

export type GameStatus =
  | 'PRE_GAME'
  | 'READY_FOR_PERIOD'
  | 'PLAYING'
  | 'PAUSED'
  | 'INTERMISSION'
  | 'GAME_OVER';

export type ClockType = 'STOP_TIME' | 'RUNNING_TIME';

export type InfractionType =
  | 'TRIPPING'
  | 'HOOKING'
  | 'HOLDING'
  | 'SLASHING'
  | 'INTERFERENCE'
  | 'ROUGHING'
  | 'HIGH_STICKING'
  | 'CROSS_CHECKING'
  | 'BOARDING'
  | 'DELAY_OF_GAME'
  | 'OTHER';

export type PenaltyStatus = 'ACTIVE' | 'EXPIRED' | 'RELEASED';

export interface InfractionInfo {
  type: InfractionType;
  customDescription?: string;
}

export interface ClockState {
  timeRemainingMillis: number;
  isRunning: boolean;
  startTimeWallClock: number;
}

export interface GoalEvent {
  goalId: string;
  teamId: 'home' | 'away';
  period: number;
  timeInPeriodMillis: number;
  scorerNumber: number;
  assistNumbers: number[];
  isEmptyNet: boolean;
}

export interface Penalty {
  penaltyId: string;
  teamId: 'home' | 'away';
  playerNumber: number;
  servingPlayerNumber: number;
  durationMillis: number;
  timeRemainingMillis: number;
  startTimeWallClock: number;
  period: number; // Period when penalty was issued
  // New fields for scoresheet support:
  infraction?: InfractionInfo;
  offTimeGameClockMillis?: number;
  onTimeGameClockMillis?: number | null;
  status?: PenaltyStatus;
}

export interface TeamState {
  goals: GoalEvent[];
  shots: number;
  penalties: Penalty[];
  penaltyHistory?: Penalty[]; // All penalties including expired/released (for scoresheet)
}

export interface GameConfig {
  templateId: string;
  warmupLengthMinutes: number;
  warmupLengthMillis: number;
  periodLengthMinutes: number;
  periodLengthMillis: number;
  intermissionLengthMinutes: number;
  intermissionLengthMillis: number;
  periods: number;
  clockType: ClockType;
  shiftLengthSeconds: number | null;
}

export interface GameState {
  gameId: string | null;
  config: GameConfig | null;
  status: GameStatus;
  period: number;
  clock: ClockState;
  home: TeamState;
  away: TeamState;
  buzzerOn: boolean;
  eventHistory: string[];
}

// Command types for WebSocket messages
export interface Command {
  type: string;
  payload?: Record<string, unknown>;
}

// WebSocket message envelope types
export interface InitialStateMessage {
  type: 'INITIAL_STATE';
  state: GameState;
}

export interface StatePatchMessage {
  type: 'STATE_PATCH';
  patch: Record<string, unknown>;
}

export interface CommandMessage {
  type: 'COMMAND';
  command: string;
  payload?: Record<string, unknown>;
}

export type WebSocketMessage = InitialStateMessage | StatePatchMessage;

// Helper to get team score from goals
export function getTeamScore(team: TeamState): number {
  return team.goals.length;
}
