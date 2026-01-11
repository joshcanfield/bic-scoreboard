/**
 * Scoresheet page - displays game data in a printable format.
 * Connects via WebSocket to receive live game state updates.
 */

import type { GameState, GoalEvent, Penalty, InfractionType } from './api/v2-types';
import { websocketClient } from './websocket';
import { millisToMinSec, pad } from './utils/time';

// Format time as MM:SS
const formatTime = (millis: number): string => {
  const { minutes, seconds } = millisToMinSec(millis);
  return `${pad(minutes, 2)}:${pad(seconds, 2)}`;
};

// Format infraction type for display
const formatInfraction = (penalty: Penalty): string => {
  if (!penalty.infraction) return '';
  if (penalty.infraction.type === 'OTHER') {
    return penalty.infraction.customDescription || 'Other';
  }
  return formatInfractionType(penalty.infraction.type);
};

const formatInfractionType = (type: InfractionType): string => {
  const names: Record<InfractionType, string> = {
    TRIPPING: 'Tripping',
    HOOKING: 'Hooking',
    HOLDING: 'Holding',
    SLASHING: 'Slashing',
    INTERFERENCE: 'Interference',
    ROUGHING: 'Roughing',
    HIGH_STICKING: 'High-sticking',
    CROSS_CHECKING: 'Cross-checking',
    BOARDING: 'Boarding',
    DELAY_OF_GAME: 'Delay of Game',
    OTHER: 'Other',
  };
  return names[type] || type;
};

// Get penalty duration in minutes
const getPenaltyMinutes = (penalty: Penalty): string => {
  const minutes = penalty.durationMillis / 60000;
  return String(minutes);
};

// Current layout state
let currentLayout: 'summary' | 'scoresheet' = 'summary';
let currentState: GameState | null = null;

// DOM Elements (cached)
const elements = {
  summaryBtn: null as HTMLButtonElement | null,
  scoresheetBtn: null as HTMLButtonElement | null,
  printBtn: null as HTMLButtonElement | null,
  summaryLayout: null as HTMLElement | null,
  scoresheetLayout: null as HTMLElement | null,
  // Scoresheet layout - separate penalty tables
  homePenaltiesBody: null as HTMLElement | null,
  awayPenaltiesBody: null as HTMLElement | null,
  // Period scoring cells
  homeP1: null as HTMLElement | null,
  homeP2: null as HTMLElement | null,
  homeP3: null as HTMLElement | null,
  homeOt: null as HTMLElement | null,
  awayP1: null as HTMLElement | null,
  awayP2: null as HTMLElement | null,
  awayP3: null as HTMLElement | null,
  awayOt: null as HTMLElement | null,
  // Summary layout elements
  homeFinalScore: null as HTMLElement | null,
  awayFinalScore: null as HTMLElement | null,
  homeShots: null as HTMLElement | null,
  awayShots: null as HTMLElement | null,
  goalsTableBody: null as HTMLElement | null,
  penaltiesTableBody: null as HTMLElement | null,
  // Traditional layout elements
  traditionalGoalsBody: null as HTMLElement | null,
  traditionalPenaltiesBody: null as HTMLElement | null,
  traditionalHomeScore: null as HTMLElement | null,
  traditionalAwayScore: null as HTMLElement | null,
  traditionalHomeShots: null as HTMLElement | null,
  traditionalAwayShots: null as HTMLElement | null,
};

function cacheElements(): void {
  elements.summaryBtn = document.getElementById('layout-summary-btn') as HTMLButtonElement;
  elements.scoresheetBtn = document.getElementById('layout-scoresheet-btn') as HTMLButtonElement;
  elements.printBtn = document.getElementById('print-btn') as HTMLButtonElement;
  elements.summaryLayout = document.getElementById('layout-summary');
  elements.scoresheetLayout = document.getElementById('layout-scoresheet');
  // Summary layout
  elements.homeFinalScore = document.getElementById('home-final-score');
  elements.awayFinalScore = document.getElementById('away-final-score');
  elements.homeShots = document.getElementById('home-shots');
  elements.awayShots = document.getElementById('away-shots');
  elements.goalsTableBody = document.getElementById('goals-table-body');
  elements.penaltiesTableBody = document.getElementById('penalties-table-body');
  // Traditional layout
  elements.traditionalGoalsBody = document.getElementById('traditional-goals-body');
  elements.homePenaltiesBody = document.getElementById('home-penalties-body');
  elements.awayPenaltiesBody = document.getElementById('away-penalties-body');
  elements.traditionalHomeScore = document.getElementById('traditional-home-score');
  elements.traditionalAwayScore = document.getElementById('traditional-away-score');
  elements.traditionalHomeShots = document.getElementById('traditional-home-shots');
  elements.traditionalAwayShots = document.getElementById('traditional-away-shots');
  // Period scoring
  elements.homeP1 = document.getElementById('home-p1');
  elements.homeP2 = document.getElementById('home-p2');
  elements.homeP3 = document.getElementById('home-p3');
  elements.homeOt = document.getElementById('home-ot');
  elements.awayP1 = document.getElementById('away-p1');
  elements.awayP2 = document.getElementById('away-p2');
  elements.awayP3 = document.getElementById('away-p3');
  elements.awayOt = document.getElementById('away-ot');
}

function switchLayout(layout: 'summary' | 'scoresheet'): void {
  currentLayout = layout;
  if (elements.summaryLayout) {
    elements.summaryLayout.style.display = layout === 'summary' ? '' : 'none';
  }
  if (elements.scoresheetLayout) {
    elements.scoresheetLayout.style.display = layout === 'scoresheet' ? '' : 'none';
  }
  // Update button states
  if (elements.summaryBtn) {
    elements.summaryBtn.classList.toggle('active', layout === 'summary');
  }
  if (elements.scoresheetBtn) {
    elements.scoresheetBtn.classList.toggle('active', layout === 'scoresheet');
  }
  // Re-render with current state
  if (currentState) {
    renderState(currentState);
  }
}

function getTeamName(teamId: 'home' | 'away'): string {
  const inputId = teamId === 'home' ? 'home-team-name' : 'away-team-name';
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  return input?.value || (teamId === 'home' ? 'Home' : 'Away');
}

// Combine goals from both teams and sort by period/time
function getAllGoals(state: GameState): Array<GoalEvent & { team: 'home' | 'away' }> {
  const homeGoals = state.home.goals.map((g) => ({ ...g, team: 'home' as const }));
  const awayGoals = state.away.goals.map((g) => ({ ...g, team: 'away' as const }));
  const allGoals = [...homeGoals, ...awayGoals];
  // Sort by period, then by time (descending - higher time = earlier in period for countdown clocks)
  allGoals.sort((a, b) => {
    if (a.period !== b.period) return a.period - b.period;
    return b.timeInPeriodMillis - a.timeInPeriodMillis;
  });
  return allGoals;
}

// Combine penalties from both teams' history and sort by period/time
function getAllPenalties(state: GameState): Array<Penalty & { team: 'home' | 'away' }> {
  const homeHistory = (state.home.penaltyHistory || state.home.penalties).map((p) => ({ ...p, team: 'home' as const }));
  const awayHistory = (state.away.penaltyHistory || state.away.penalties).map((p) => ({ ...p, team: 'away' as const }));
  const allPenalties = [...homeHistory, ...awayHistory];
  // Sort by period, then by off time (descending)
  allPenalties.sort((a, b) => {
    if (a.period !== b.period) return a.period - b.period;
    const aOff = a.offTimeGameClockMillis ?? 0;
    const bOff = b.offTimeGameClockMillis ?? 0;
    return bOff - aOff;
  });
  return allPenalties;
}

function renderSummaryGoals(goals: Array<GoalEvent & { team: 'home' | 'away' }>): void {
  const tbody = elements.goalsTableBody;
  if (!tbody) return;

  if (goals.length === 0) {
    tbody.innerHTML = '<tr class="placeholder"><td colspan="6">No goals recorded</td></tr>';
    return;
  }

  tbody.innerHTML = goals
    .map((goal) => {
      const teamName = getTeamName(goal.team);
      const scorer = goal.scorerNumber || '-';
      const assist1 = goal.assistNumbers?.[0] || '-';
      const assist2 = goal.assistNumbers?.[1] || '-';
      return `<tr>
        <td>${goal.period}</td>
        <td>${formatTime(goal.timeInPeriodMillis)}</td>
        <td>${teamName}</td>
        <td>${scorer}</td>
        <td>${assist1}</td>
        <td>${assist2}</td>
      </tr>`;
    })
    .join('');
}

function renderSummaryPenalties(penalties: Array<Penalty & { team: 'home' | 'away' }>): void {
  const tbody = elements.penaltiesTableBody;
  if (!tbody) return;

  if (penalties.length === 0) {
    tbody.innerHTML = '<tr class="placeholder"><td colspan="7">No penalties recorded</td></tr>';
    return;
  }

  tbody.innerHTML = penalties
    .map((penalty) => {
      const teamName = getTeamName(penalty.team);
      const offTime = penalty.offTimeGameClockMillis != null ? formatTime(penalty.offTimeGameClockMillis) : '-';
      const onTime = penalty.onTimeGameClockMillis != null ? formatTime(penalty.onTimeGameClockMillis) : '-';
      return `<tr>
        <td>${penalty.period}</td>
        <td>${teamName}</td>
        <td>${penalty.playerNumber}</td>
        <td>${formatInfraction(penalty)}</td>
        <td>${getPenaltyMinutes(penalty)}</td>
        <td>${offTime}</td>
        <td>${onTime}</td>
      </tr>`;
    })
    .join('');
}

function renderScoresheetGoals(goals: Array<GoalEvent & { team: 'home' | 'away' }>): void {
  const tbody = elements.traditionalGoalsBody;
  if (!tbody) return;

  if (goals.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No goals</td></tr>';
    return;
  }

  tbody.innerHTML = goals
    .map((goal) => {
      const teamLabel = goal.team === 'home' ? 'H' : 'V';
      const scorer = goal.scorerNumber || '-';
      const assist1 = goal.assistNumbers?.[0] || '-';
      const assist2 = goal.assistNumbers?.[1] || '-';
      // Goal type - default to EV (even strength)
      const goalType = 'EV';
      return `<tr>
        <td>${goal.period}</td>
        <td>${formatTime(goal.timeInPeriodMillis)}</td>
        <td>${teamLabel}</td>
        <td>${scorer}</td>
        <td>${assist1}</td>
        <td>${assist2}</td>
        <td>${goalType}</td>
      </tr>`;
    })
    .join('');
}

function renderTeamPenalties(penalties: Penalty[], tbody: HTMLElement | null): void {
  if (!tbody) return;

  if (penalties.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">-</td></tr>';
    return;
  }

  tbody.innerHTML = penalties
    .map((penalty) => {
      const offTime = penalty.offTimeGameClockMillis != null ? formatTime(penalty.offTimeGameClockMillis) : '-';
      const onTime = penalty.onTimeGameClockMillis != null ? formatTime(penalty.onTimeGameClockMillis) : '-';
      return `<tr>
        <td>${penalty.period}</td>
        <td>${penalty.playerNumber}</td>
        <td>${formatInfraction(penalty)}</td>
        <td>${getPenaltyMinutes(penalty)}</td>
        <td>${offTime}</td>
        <td>${onTime}</td>
      </tr>`;
    })
    .join('');
}

// Calculate goals per period for a team
function getGoalsByPeriod(goals: GoalEvent[]): { p1: number; p2: number; p3: number; ot: number } {
  const result = { p1: 0, p2: 0, p3: 0, ot: 0 };
  for (const goal of goals) {
    // Period 0 or less gets counted as period 1 (pre-game corrections)
    if (goal.period <= 1) result.p1++;
    else if (goal.period === 2) result.p2++;
    else if (goal.period === 3) result.p3++;
    else result.ot++; // Period > 3 is overtime
  }
  return result;
}

function renderState(state: GameState): void {
  currentState = state;

  const homeScore = state.home.goals.length;
  const awayScore = state.away.goals.length;
  const homeShots = state.home.shots;
  const awayShots = state.away.shots;

  // Update scores and shots in both layouts
  if (elements.homeFinalScore) elements.homeFinalScore.textContent = String(homeScore);
  if (elements.awayFinalScore) elements.awayFinalScore.textContent = String(awayScore);
  if (elements.homeShots) elements.homeShots.textContent = String(homeShots);
  if (elements.awayShots) elements.awayShots.textContent = String(awayShots);
  if (elements.traditionalHomeScore) elements.traditionalHomeScore.textContent = String(homeScore);
  if (elements.traditionalAwayScore) elements.traditionalAwayScore.textContent = String(awayScore);
  if (elements.traditionalHomeShots) elements.traditionalHomeShots.textContent = String(homeShots);
  if (elements.traditionalAwayShots) elements.traditionalAwayShots.textContent = String(awayShots);

  // Update period-by-period scoring
  const homeByPeriod = getGoalsByPeriod(state.home.goals);
  const awayByPeriod = getGoalsByPeriod(state.away.goals);
  if (elements.homeP1) elements.homeP1.textContent = String(homeByPeriod.p1);
  if (elements.homeP2) elements.homeP2.textContent = String(homeByPeriod.p2);
  if (elements.homeP3) elements.homeP3.textContent = String(homeByPeriod.p3);
  if (elements.homeOt) elements.homeOt.textContent = homeByPeriod.ot > 0 ? String(homeByPeriod.ot) : '-';
  if (elements.awayP1) elements.awayP1.textContent = String(awayByPeriod.p1);
  if (elements.awayP2) elements.awayP2.textContent = String(awayByPeriod.p2);
  if (elements.awayP3) elements.awayP3.textContent = String(awayByPeriod.p3);
  if (elements.awayOt) elements.awayOt.textContent = awayByPeriod.ot > 0 ? String(awayByPeriod.ot) : '-';

  // Get combined and sorted data
  const allGoals = getAllGoals(state);
  const allPenalties = getAllPenalties(state);

  // Render tables based on current layout
  if (currentLayout === 'summary') {
    renderSummaryGoals(allGoals);
    renderSummaryPenalties(allPenalties);
  } else {
    renderScoresheetGoals(allGoals);
    // Render penalties to separate team tables
    const homePenalties = (state.home.penaltyHistory || state.home.penalties);
    const awayPenalties = (state.away.penaltyHistory || state.away.penalties);
    renderTeamPenalties(homePenalties, elements.homePenaltiesBody);
    renderTeamPenalties(awayPenalties, elements.awayPenaltiesBody);
  }

  // Sync traditional layout text fields from inputs
  syncTraditionalFields();
}

function syncTraditionalFields(): void {
  // Sync input values to traditional layout display spans
  const fields = ['game-date', 'game-arena', 'home-team-name', 'away-team-name', 'referee', 'linesman1', 'linesman2', 'scorekeeper', 'game-notes'];
  fields.forEach((fieldId) => {
    const input = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
    const displays = document.querySelectorAll(`[data-field="${fieldId}"]`);
    const value = input?.value || '';
    displays.forEach((el) => {
      el.textContent = value;
    });
  });

  // Also update team labels in the score display
  const homeNameInputs = document.querySelectorAll('[data-team="home"]');
  const awayNameInputs = document.querySelectorAll('[data-team="away"]');
  const homeName = getTeamName('home');
  const awayName = getTeamName('away');
  homeNameInputs.forEach((el) => {
    if (el.tagName !== 'INPUT') el.textContent = homeName;
  });
  awayNameInputs.forEach((el) => {
    if (el.tagName !== 'INPUT') el.textContent = awayName;
  });
}

function setupEventListeners(): void {
  // Layout buttons
  elements.summaryBtn?.addEventListener('click', () => {
    switchLayout('summary');
  });
  elements.scoresheetBtn?.addEventListener('click', () => {
    switchLayout('scoresheet');
  });

  // Print button
  elements.printBtn?.addEventListener('click', () => {
    window.print();
  });

  // Sync fields when inputs change
  const inputFields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '#game-date, #game-arena, #home-team-name, #away-team-name, #referee, #linesman1, #linesman2, #scorekeeper, #game-notes'
  );
  inputFields.forEach((input) => {
    input.addEventListener('input', syncTraditionalFields);
  });
}

function initWebSocket(): void {
  // Subscribe to state updates
  websocketClient.subscribe((state) => {
    renderState(state);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  setupEventListeners();
  initWebSocket();

  // Set default date to today
  const dateInput = document.getElementById('game-date') as HTMLInputElement | null;
  if (dateInput && !dateInput.value) {
    const today = new Date();
    dateInput.value = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  }
});
