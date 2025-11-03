import type { TeamCode } from '../transport/server';

export interface PenaltyDetail {
  id: string;
  team: TeamCode;
  period: string;
  player: string;
  duration: string;
  off: string;
  start: string;
  remaining: string;
  servingPlayer: string;
}

export interface PenaltyTableData {
  activePenalties: PenaltyDetail[];
  placeholderCount: number;
}
