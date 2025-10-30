import type { Penalty } from '../state/control-state';
import type { TeamCode } from '../transport/server';
import { formatClock, millisToMinSec } from '../utils/time';

export interface PenaltyDetail {
  id: string;
  team: TeamCode;
  period: string;
  player: string;
  duration: string;
  off: string;
  start: string;
  remaining: string;
}

export interface PenaltyTableFragments {
  rowsHtml: string;
  placeholderHtml: string;
  activePenalties: Penalty[];
  details: PenaltyDetail[];
}

const PENALTY_PLACEHOLDER_COLUMNS = 4;
const MIN_VISIBLE_ROWS = 2;

export const isPenaltyActive = (penalty: Penalty): boolean => {
  if (!penalty) return false;
  const elapsed = penalty.elapsed ?? 0;
  const remaining = penalty.startTime && penalty.startTime > 0
    ? Math.max(0, penalty.time - elapsed)
    : penalty.time;
  return (remaining ?? 0) > 0;
};

export const filterActivePenalties = (penalties: ReadonlyArray<Penalty> = []): Penalty[] =>
  penalties.filter(isPenaltyActive);

export const buildPenaltyDetail = (team: TeamCode, penalty: Penalty): PenaltyDetail => {
  const elapsed = penalty.elapsed ?? 0;
  const offIce = penalty.offIceTime ?? 0;
  const startTime = penalty.startTime ?? 0;
  const remainingMillis = penalty.startTime && penalty.startTime > 0
    ? Math.max(0, penalty.time - elapsed)
    : penalty.time;
  const remaining = millisToMinSec(remainingMillis);
  const off = millisToMinSec(offIce);
  const st = millisToMinSec(startTime);
  const durationMinutes = Math.floor(penalty.time / 60000);
  const durationSeconds = Math.floor((penalty.time / 1000) % 60);

  return {
    id: String(penalty.id ?? ''),
    team,
    period: String(penalty.period ?? '—'),
    player: String(penalty.playerNumber ?? '—'),
    duration: formatClock(durationMinutes, durationSeconds),
    off: formatClock(off.minutes, off.seconds),
    start: formatClock(st.minutes, st.seconds),
    remaining: formatClock(remaining.minutes, remaining.seconds),
  };
};

const penaltyRow = (team: TeamCode, penalty: Penalty): { html: string; detail: PenaltyDetail } => {
  const detail = buildPenaltyDetail(team, penalty);
  const offender = String(penalty.playerNumber ?? '');
  const servingValue = penalty.servingPlayerNumber ?? penalty.playerNumber;
  const serving = servingValue != null ? String(servingValue) : offender;
  const pnHtml = serving && serving !== offender
    ? `<span class="pn" data-serving="${serving}">${offender}</span>`
    : `<span class="pn">${offender}</span>`;

  const rowHtml = `<tr>
      <td>${detail.period}</td>
      <td>${pnHtml}</td>
      <td>${detail.remaining}</td>
      <td>
        <a href="#" data-action="penalty-details" data-team="${detail.team}" data-pid="${detail.id}" data-player="${detail.player}" data-period="${detail.period}" data-duration="${detail.duration}" data-off="${detail.off}" data-start="${detail.start}" data-remaining="${detail.remaining}" title="Details">Details</a>
        &nbsp;|&nbsp;
        <a href="#" data-action="delete-penalty" data-team="${detail.team}" data-pid="${detail.id}">x</a>
      </td>
    </tr>`;

  return { html: rowHtml, detail };
};

const buildPlaceholderCells = () =>
  Array.from({ length: PENALTY_PLACEHOLDER_COLUMNS })
    .map(() => '<td>—</td>')
    .join('');

export const buildPlaceholderRows = (count: number): string => {
  if (count <= 0) return '';
  return Array.from({ length: count })
    .map(() => `<tr class="placeholder">${buildPlaceholderCells()}</tr>`)
    .join('');
};

export const buildPenaltyRows = (team: TeamCode, penalties: ReadonlyArray<Penalty>): { html: string; details: PenaltyDetail[] } => {
  const rows = penalties.map((penalty) => penaltyRow(team, penalty));
  return {
    html: rows.map((r) => r.html).join(''),
    details: rows.map((r) => r.detail),
  };
};

export const buildPenaltyTable = (team: TeamCode, penalties: ReadonlyArray<Penalty> = []): PenaltyTableFragments => {
  const activePenalties = filterActivePenalties(penalties);
  const { html, details } = buildPenaltyRows(team, activePenalties);
  const placeholderCount = Math.max(0, MIN_VISIBLE_ROWS - activePenalties.length);
  const placeholderHtml = buildPlaceholderRows(placeholderCount);

  return { rowsHtml: html, placeholderHtml, activePenalties, details };
};
