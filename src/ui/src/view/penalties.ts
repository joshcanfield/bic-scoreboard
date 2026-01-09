import type { Penalty } from '../api/v2-types';
import { formatTime } from '../utils/time';

type TeamCode = 'home' | 'away';

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
  activePenalties: Penalty[];
  details: PenaltyDetail[];
  rowsHtml: string;
  placeholderHtml: string;
}

/**
 * Returns true if the penalty still has time remaining
 */
export function isPenaltyActive(penalty: Penalty): boolean {
  return penalty.timeRemainingMillis > 0;
}

/**
 * Filters penalties to only those with time remaining
 */
export function filterActivePenalties(penalties: Penalty[]): Penalty[] {
  return penalties.filter(isPenaltyActive);
}

/**
 * Builds placeholder rows HTML for empty penalty slots
 */
export function buildPlaceholderRows(count: number): string {
  if (count <= 0) return '';
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    rows.push('<tr class="penalty-placeholder"><td colspan="3">&nbsp;</td></tr>');
  }
  return rows.join('');
}

/**
 * Builds a penalty table data structure for rendering
 */
export function buildPenaltyTable(team: TeamCode, penalties: Penalty[]): PenaltyTableData {
  const activePenalties = filterActivePenalties(penalties);
  const details: PenaltyDetail[] = activePenalties.map((p) => ({
    id: p.penaltyId,
    team,
    period: String(p.period),
    player: String(p.playerNumber),
    duration: formatTime(p.durationMillis),
    off: formatTime(p.durationMillis - p.timeRemainingMillis), // elapsed time
    start: formatTime(p.startTimeWallClock),
    remaining: formatTime(p.timeRemainingMillis),
    servingPlayer: p.servingPlayerNumber != null ? String(p.servingPlayerNumber) : '',
  }));

  const rowsHtml = activePenalties
    .map((p, idx) => {
      const detail = details[idx];
      const servingAttr = detail.servingPlayer ? ` data-serving="${detail.servingPlayer}"` : '';
      return `<tr data-team="${team}" data-id="${detail.id}"${servingAttr}><td>${detail.player}</td><td>${detail.remaining}</td><td>${detail.servingPlayer || '-'}</td></tr>`;
    })
    .join('');

  const minRows = 2;
  const placeholderCount = Math.max(0, minRows - activePenalties.length);
  const placeholderHtml = buildPlaceholderRows(placeholderCount);

  return { activePenalties, details, rowsHtml, placeholderHtml };
}
