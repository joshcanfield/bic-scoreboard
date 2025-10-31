import type { UpdateEventPayload } from '../transport/server';
import { digits2, millisToMinSec, pad } from '../utils/time';

export type Penalty = NonNullable<UpdateEventPayload['home']['penalties']>[number];
export type Goal = NonNullable<UpdateEventPayload['home']['goals']>[number];

export interface TeamState {
  score: number;
  shots: number;
  penalties: Penalty[];
  goals: Goal[];
}

export interface ControlState {
  time: number;
  running: boolean;
  period: number;
  periodLengthMillis: number;
  home: TeamState;
  away: TeamState;
  scoreboardOn: boolean;
  buzzerOn: boolean;
}

export interface ControlViewModel {
  clockText: string;
  elapsedText: string;
  periodText: string;
  homeScoreDigits: [number, number];
  awayScoreDigits: [number, number];
  homeScoreText: string;
  awayScoreText: string;
  homeShotsText: string;
  awayShotsText: string;
  scoreboardOn: boolean;
  buzzerOn: boolean;
  homePenalties: Penalty[];
  awayPenalties: Penalty[];
}

const normalizeTeamState = (team: UpdateEventPayload['home'] | undefined): TeamState => ({
  score: team?.score ?? 0,
  shots: team?.shots ?? 0,
  penalties: Array.isArray(team?.penalties) ? (team!.penalties as Penalty[]) : [],
  goals: Array.isArray(team?.goals) ? (team!.goals as Goal[]) : [],
});

export const deriveControlState = (update: UpdateEventPayload): ControlState => ({
  time: update.time ?? 0,
  running: !!update.running,
  period: update.period ?? 0,
  periodLengthMillis: Math.max(0, Math.floor((update.periodLength ?? 0) * 60 * 1000)),
  home: normalizeTeamState(update.home),
  away: normalizeTeamState(update.away),
  scoreboardOn: !!update.scoreboardOn,
  buzzerOn: !!update.buzzerOn,
});

const buildElapsedText = (state: ControlState): string => {
  if (state.periodLengthMillis <= 0) return '\u00a0';
  const elapsed = Math.max(0, state.periodLengthMillis - state.time);
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed / 1000) % 60);
  const minutePart = minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '';
  const secondPart = `${seconds} seconds`;
  if (!minutePart) return secondPart;
  return `${minutePart} and ${secondPart}`;
};

const scoreDigitsToText = (digits: [number, number]): string => `${digits[0]}${digits[1]}`;

export const buildControlView = (state: ControlState): ControlViewModel => {
  const { minutes, seconds } = millisToMinSec(state.time);
  const homeDigits = digits2(state.home.score ?? 0) as [number, number];
  const awayDigits = digits2(state.away.score ?? 0) as [number, number];

  return {
    clockText: `${pad(minutes, 2)}:${pad(seconds, 2)}`,
    elapsedText: buildElapsedText(state),
    periodText: String(state.period ?? ''),
    homeScoreDigits: homeDigits,
    awayScoreDigits: awayDigits,
    homeScoreText: scoreDigitsToText(homeDigits),
    awayScoreText: scoreDigitsToText(awayDigits),
    homeShotsText: String(state.home.shots ?? 0),
    awayShotsText: String(state.away.shots ?? 0),
    scoreboardOn: state.scoreboardOn,
    buzzerOn: state.buzzerOn,
    homePenalties: state.home.penalties,
    awayPenalties: state.away.penalties,
  };
};
