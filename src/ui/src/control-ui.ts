/**
 * Main entry point for the Control UI.
 * Orchestrates all UI components and manages application state.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */

import { type GoalEvent, type Penalty, type GameState, type Command } from './api/v2-types';
import { pad, millisToMinSec } from './utils/time';
import { initClockSettingsDialog } from './view/clock-settings';
import { initGameDialog } from './view/game-dialog';
import { initGoalDialog, type GoalDialogController } from './view/goal-dialog';
import { initKeyboardShortcuts } from './view/keyboard-shortcuts';
import Modals from './view/modals';
import { initPenaltyDialog, initPenaltyDetailsPopup } from './view/penalty-dialog';
import { setPortMessage, type CountdownHandle } from './view/ports';
import { initTeamColorPickers } from './view/team-colors';
import { TeamLayout } from './view/team-layout';
import { websocketClient } from './websocket';

// DOM helpers
const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);

const on = (
  el: HTMLElement | Document,
  type: string,
  selOrHandler: string | EventListener,
  handler?: (e: Event, t: HTMLElement) => void
) => {
  if (!handler) {
    el.addEventListener(type, selOrHandler as EventListener);
    return;
  }
  el.addEventListener(type, (e) => {
    const t = (e.target as HTMLElement).closest(selOrHandler as string);
    if (t && el.contains(t)) handler(e, t as HTMLElement);
  });
};

// Application state - now managed by websocketClient
let currentGameState: GameState | null = null;
const pendingStateActions: Array<(state: GameState) => void> = [];

// Cached element references for performance (initialized on first use)
let cachedElements: {
  clockText: HTMLElement | null;
  clockToggle: HTMLElement | null;
  periodDigit: HTMLElement | null;
  buzzerIndicator: HTMLDivElement | null;
  intermissionIndicator: HTMLDivElement | null;
  periodUpBtn: HTMLButtonElement | null;
  periodDownBtn: HTMLButtonElement | null;
  homeScore: HTMLElement | null;
  homeShots: HTMLElement | null;
  homeTeam: HTMLElement | null;
  awayScore: HTMLElement | null;
  awayShots: HTMLElement | null;
  awayTeam: HTMLElement | null;
} | null = null;

const getElements = () => {
  if (!cachedElements) {
    cachedElements = {
      clockText: document.getElementById('clock-text'),
      clockToggle: document.getElementById('clock-toggle'),
      periodDigit: $('#period .digit'),
      buzzerIndicator: document.querySelector<HTMLDivElement>('#period-indicators [data-indicator="buzzer"]'),
      intermissionIndicator: document.querySelector<HTMLDivElement>('#period-indicators [data-indicator="intermission"]'),
      periodUpBtn: document.querySelector<HTMLButtonElement>('.period-up'),
      periodDownBtn: document.querySelector<HTMLButtonElement>('.period-down'),
      homeScore: document.getElementById('home-score'),
      homeShots: document.getElementById('home-shots'),
      homeTeam: $('#home'),
      awayScore: document.getElementById('away-score'),
      awayShots: document.getElementById('away-shots'),
      awayTeam: $('#away'),
    };
  }
  return cachedElements;
};

const withGameState = (handler: (state: GameState) => void) => {
  if (currentGameState) {
    handler(currentGameState);
  } else {
    pendingStateActions.push(handler);
  }
};

const getConfiguredPeriodLimit = (state: GameState | null): number => {
  if (!state) return 3;
  const configured = state.config?.periods;
  return configured && configured > 0 ? configured : 3;
};

// Rendering
type TeamCode = 'home' | 'away';

const sendCommand = (command: Command) => {
  websocketClient.sendCommand(command);
};

/**
 * Compare penalties by stable fields only (not timeRemainingMillis).
 * Used to determine if penalty table structure needs to be rebuilt.
 */
const penaltiesStructureEqual = (a: Penalty[], b: Penalty[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].penaltyId !== b[i].penaltyId ||
      a[i].playerNumber !== b[i].playerNumber ||
      a[i].servingPlayerNumber !== b[i].servingPlayerNumber ||
      a[i].period !== b[i].period ||
      a[i].durationMillis !== b[i].durationMillis
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Update penalty times in-place without recreating DOM elements.
 */
const updatePenaltyTimes = (teamElem: HTMLElement | null, penalties: Penalty[]) => {
  const listTBody = teamElem?.querySelector<HTMLElement>('tbody.list');
  if (!listTBody) return;

  const rows = listTBody.querySelectorAll<HTMLTableRowElement>('tr:not(.placeholder)');
  rows.forEach((row, idx) => {
    if (idx >= penalties.length) return;
    const penalty = penalties[idx];
    // Update time in the 3rd cell (index 2)
    const cells = row.querySelectorAll('td');
    if (cells[2]) {
      const { minutes, seconds } = millisToMinSec(penalty.timeRemainingMillis);
      cells[2].textContent = `${pad(minutes, 2)}:${pad(seconds, 2)}`;
    }
    // Update the remaining data attribute on the details link
    const detailsLink = row.querySelector<HTMLAnchorElement>('a[data-action="penalty-details"]');
    if (detailsLink) {
      detailsLink.dataset.remaining = String(penalty.timeRemainingMillis);
    }
  });
};

const renderPenaltyTable = (teamElem: HTMLElement | null, teamKey: 'home' | 'away', penalties: Penalty[]) => {
  const listTBody = teamElem?.querySelector<HTMLElement>('tbody.list');
  const phTBody = teamElem?.querySelector<HTMLElement>('tbody.placeholders');

  if (!listTBody || !phTBody) return;

  // Clear existing rows
  while (listTBody.firstChild) {
    listTBody.removeChild(listTBody.firstChild);
  }
  while (phTBody.firstChild) {
    phTBody.removeChild(phTBody.firstChild);
  }

  // Render penalty rows
  penalties.forEach(detail => {
    const row = document.createElement('tr');

    const periodCell = document.createElement('td');
    periodCell.textContent = String(detail.period);
    row.appendChild(periodCell);

    const playerCell = document.createElement('td');
    const playerSpan = document.createElement('span');
    playerSpan.className = 'pn';
    playerSpan.textContent = String(detail.playerNumber);
    if (detail.servingPlayerNumber && detail.servingPlayerNumber !== detail.playerNumber) {
      playerSpan.dataset.serving = String(detail.servingPlayerNumber);
    }
    playerCell.appendChild(playerSpan);
    row.appendChild(playerCell);

    const remainingCell = document.createElement('td');
    const { minutes, seconds } = millisToMinSec(detail.timeRemainingMillis);
    remainingCell.textContent = `${pad(minutes, 2)}:${pad(seconds, 2)}`;
    row.appendChild(remainingCell);

    const actionsCell = document.createElement('td');
    const detailsLink = document.createElement('a');
    detailsLink.href = '#';
    detailsLink.dataset.action = 'penalty-details';
    detailsLink.dataset.team = detail.teamId;
    detailsLink.dataset.pid = detail.penaltyId;
    detailsLink.dataset.player = String(detail.playerNumber);
    detailsLink.dataset.period = String(detail.period);
    detailsLink.dataset.duration = String(detail.durationMillis);
    detailsLink.dataset.remaining = String(detail.timeRemainingMillis);
    detailsLink.title = 'Details';
    detailsLink.textContent = 'Details';
    actionsCell.appendChild(detailsLink);

    actionsCell.appendChild(document.createTextNode(' | '));

    const deleteLink = document.createElement('a');
    deleteLink.href = '#';
    deleteLink.dataset.action = 'delete-penalty';
    deleteLink.dataset.team = detail.teamId;
    deleteLink.dataset.pid = detail.penaltyId;
    deleteLink.textContent = 'x';
    actionsCell.appendChild(deleteLink);

    row.appendChild(actionsCell);

    listTBody.appendChild(row);
  });

  // Render placeholder rows
  const placeholderCount = Math.max(0, 2 - penalties.length);
  for (let i = 0; i < placeholderCount; i++) {
    const row = document.createElement('tr');
    row.className = 'placeholder';
    for (let j = 0; j < 4; j++) {
      const cell = document.createElement('td');
      cell.innerHTML = '&ndash;';
      row.appendChild(cell);
    }
    phTBody.appendChild(row);
  }
};

const renderGoalTable = (teamElem: HTMLElement | null, goals: GoalEvent[]) => {
  if (!teamElem) return;
  const listTBody = teamElem.querySelector<HTMLElement>('tbody.goal-list');
  if (!listTBody) return;

  // Clear existing rows
  while (listTBody.firstChild) {
    listTBody.removeChild(listTBody.firstChild);
  }

  if (!Array.isArray(goals) || goals.length === 0) {
    const row = document.createElement('tr');
    row.className = 'placeholder';
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No goals yet';
    row.appendChild(cell);
    listTBody.appendChild(row);
    return;
  }

  goals.forEach((goal) => {
    const row = document.createElement('tr');
    if (goal.goalId) {
      row.dataset.goalId = goal.goalId;
    }

    const safeTime = typeof goal.timeInPeriodMillis === 'number' ? Math.max(0, goal.timeInPeriodMillis) : 0;
    const { minutes, seconds } = millisToMinSec(safeTime);
    const timeText = `${pad(minutes, 2)}:${pad(seconds, 2)}`;
    const period = goal.period;
    const scorer = goal.scorerNumber;
    const assistsText = goal.assistNumbers && goal.assistNumbers.length > 0 ? goal.assistNumbers.map(String).join(' / ') : '–';

    const periodCell = document.createElement('td');
    periodCell.textContent = String(period);
    row.appendChild(periodCell);

    const timeCell = document.createElement('td');
    timeCell.textContent = timeText;
    row.appendChild(timeCell);

    const scorerCell = document.createElement('td');
    scorerCell.textContent = String(scorer);
    row.appendChild(scorerCell);

    const assistsCell = document.createElement('td');
    assistsCell.innerHTML = assistsText; // Use innerHTML for &ndash;
    row.appendChild(assistsCell);

    listTBody.appendChild(row);
  });
};

const renderUpdate = (newState: GameState) => {
  const previousState = currentGameState;
  const els = getElements();
  let latestHomeScoreText: string | null = null;
  let latestAwayScoreText: string | null = null;

  // Clock - use cached element
  const oldClock = previousState?.clock;
  const newClock = newState.clock;
  if (!oldClock || oldClock.timeRemainingMillis !== newClock.timeRemainingMillis) {
    const { minutes, seconds } = millisToMinSec(newClock.timeRemainingMillis);
    if (els.clockText) els.clockText.textContent = `${pad(minutes, 2)}:${pad(seconds, 2)}`;
  }

  if (!oldClock || oldClock.isRunning !== newClock.isRunning) {
    if (els.clockToggle) {
      const icon = els.clockToggle.querySelector('.glyphicon');
      const label = els.clockToggle.querySelector('.cta-text');
      if (newClock.isRunning) {
        if (icon) icon.className = 'glyphicon glyphicon-pause';
        if (label) label.textContent = 'Pause';
      } else {
        if (icon) icon.className = 'glyphicon glyphicon-play';
        if (label) label.textContent = 'Start';
      }
    }
  }

  // Period - use cached elements
  if (!previousState || previousState.period !== newState.period) {
    if (els.periodDigit) els.periodDigit.textContent = String(newState.period);
  }
  if (els.buzzerIndicator) {
    els.buzzerIndicator.dataset.state = newState.buzzerOn ? 'active' : 'idle';
  }
  if (els.intermissionIndicator) {
    els.intermissionIndicator.dataset.state = newState.status === 'INTERMISSION' ? 'active' : 'idle';
  }
  if (els.periodUpBtn) {
    els.periodUpBtn.disabled = newState.period >= getConfiguredPeriodLimit(newState);
  }
  if (els.periodDownBtn) {
    els.periodDownBtn.disabled = newState.period <= 0;
  }

  // Home Team - use cached elements
  const oldHome = previousState?.home;
  const newHome = newState.home;
  if (!oldHome || oldHome.goals.length !== newHome.goals.length) {
    if (els.homeScore) {
      latestHomeScoreText = pad(newHome.goals.length, 2);
      els.homeScore.textContent = latestHomeScoreText;
    }
  }
  if (!oldHome || oldHome.shots !== newHome.shots) {
    if (els.homeShots) els.homeShots.textContent = String(newHome.shots);
  }
  // Only rebuild penalty table when structure changes, otherwise just update times in-place
  if (!oldHome || !penaltiesStructureEqual(oldHome.penalties, newHome.penalties)) {
    renderPenaltyTable(els.homeTeam, 'home', newHome.penalties);
  } else if (newHome.penalties.length > 0) {
    updatePenaltyTimes(els.homeTeam, newHome.penalties);
  }
  if (!oldHome || JSON.stringify(oldHome.goals) !== JSON.stringify(newHome.goals)) {
    renderGoalTable(els.homeTeam, newHome.goals);
  }

  // Away Team - use cached elements
  const oldAway = previousState?.away;
  const newAway = newState.away;
  if (!oldAway || oldAway.goals.length !== newAway.goals.length) {
    if (els.awayScore) {
      latestAwayScoreText = pad(newAway.goals.length, 2);
      els.awayScore.textContent = latestAwayScoreText;
    }
  }
  if (!oldAway || oldAway.shots !== newAway.shots) {
    if (els.awayShots) els.awayShots.textContent = String(newAway.shots);
  }
  // Only rebuild penalty table when structure changes, otherwise just update times in-place
  if (!oldAway || !penaltiesStructureEqual(oldAway.penalties, newAway.penalties)) {
    renderPenaltyTable(els.awayTeam, 'away', newAway.penalties);
  } else if (newAway.penalties.length > 0) {
    // Structure same but times may have changed - update in-place
    updatePenaltyTimes(els.awayTeam, newAway.penalties);
  }
  if (!oldAway || JSON.stringify(oldAway.goals) !== JSON.stringify(newAway.goals)) {
    renderGoalTable(els.awayTeam, newAway.goals);
  }

  // Buzzer
  if ((previousState?.buzzerOn ?? null) !== newState.buzzerOn) {
    document.body.classList.toggle('buzzer', newState.buzzerOn);
  }

  // Update the global state reference
  currentGameState = newState;

  if (!previousState && pendingStateActions.length && currentGameState) {
    const actions = pendingStateActions.splice(0, pendingStateActions.length);
    actions.forEach((fn) => fn(currentGameState));
  }

  const testHooks = ((window as any).__test ?? {}) as Record<string, unknown>;
  (window as any).__test = {
    ...testHooks,
    lastUpdate: newState,
    domHomeScore: latestHomeScoreText ?? (testHooks.domHomeScore as string | undefined) ?? null,
    domAwayScore: latestAwayScoreText ?? (testHooks.domAwayScore as string | undefined) ?? null,
  };
};

// Power control
let powerState: 'off' | 'connecting' | 'assumed' | 'on' | 'error' = 'off';
let notOnCountdownHandle: CountdownHandle | null = null;

const setPowerUI = (state: typeof powerState, text?: string) => {
  powerState = state;
  const powerBtn = $('#power-btn') as HTMLButtonElement | null;
  const powerStatus = $('#power-status');
  switch (state) {
    case 'off':
      if (powerBtn) powerBtn.disabled = false;
      if (powerStatus) {
        powerStatus.className = 'label label-danger';
        powerStatus.textContent = 'Scoreboard Off';
      }
      break;
    case 'connecting':
      if (powerBtn) powerBtn.disabled = true;
      if (powerStatus) {
        powerStatus.className = 'label label-info';
        powerStatus.textContent = text || 'Opening port…';
      }
      break;
    case 'assumed':
      if (powerBtn) powerBtn.disabled = true;
      if (powerStatus) {
        powerStatus.className = 'label label-warning';
        powerStatus.textContent = 'Assumed On — confirm';
      }
      break;
    case 'on':
      if (powerBtn) powerBtn.disabled = false;
      if (powerStatus) {
        powerStatus.className = 'label label-success';
        powerStatus.textContent = 'Scoreboard On';
      }
      break;
    case 'error':
      if (powerBtn) powerBtn.disabled = false;
      if (powerStatus) {
        powerStatus.className = 'label label-danger';
        powerStatus.textContent = text || 'Error';
      }
      break;
  }
};

const setConnectMessage = (msg: string) => {
  setPortMessage($('#connect-message'), msg || '');
};

// Port stepper state
let portStepper = { ports: [] as string[], index: 0, active: false };
let notOnCountdownTimer: ReturnType<typeof setInterval> | null = null;

// Render port pills (visual indicators)
const renderPortPills = (activeIndex = 0) => {
  const wrap = $('#connect-portNames');
  if (!wrap) return;
  wrap.innerHTML = '';
  (portStepper.ports || []).forEach((name, i) => {
    const pill = document.createElement('span');
    pill.className = 'port-pill' + (i === activeIndex ? ' active' : '') + (i < activeIndex ? ' tried' : '');
    pill.textContent = name;
    wrap.appendChild(pill);
  });
};

// Start countdown on "Not On" button
const startNotOnCountdown = (btn: HTMLButtonElement | null, seconds = 5, nextName = '') => {
  if (!btn) return { cancel: () => {} };
  if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; }
  let remaining = seconds;
  btn.disabled = true;
  btn.textContent = `Waiting (${remaining})`;
  notOnCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(notOnCountdownTimer!);
      notOnCountdownTimer = null;
      btn.disabled = false;
      btn.textContent = nextName ? `Try ${nextName}` : 'Not On';
    } else {
      btn.textContent = `Waiting (${remaining})`;
    }
  }, 1000);
  return {
    cancel: () => {
      if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; }
      btn.disabled = false;
      btn.textContent = 'Not On';
    }
  };
};

// Try port at specific index
const tryPortAtIndex = async (i: number) => {
  const notOnBtn = $('#not-on') as HTMLButtonElement | null;
  const confirmBtn = $('#confirm-on');
  const retryBtn = $('#retry-ports');
  const giveUpBtn = $('#give-up');
  const titleEl = $('#connect-title');
  const name = portStepper.ports[i];

  if (!name) {
    // Exhausted all ports
    setConnectMessage('No more ports to try. Check USB/power and cables.');
    portStepper.active = false;
    websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} });
    setPowerUI('off');
    renderPortPills(portStepper.ports.length); // mark all as tried
    if (notOnBtn) { notOnBtn.style.display = 'none'; notOnBtn.disabled = false; notOnBtn.textContent = 'Not On'; }
    if (retryBtn) retryBtn.style.display = '';
    if (giveUpBtn) giveUpBtn.style.display = '';
    return;
  }

  renderPortPills(i);
  if (titleEl) titleEl.textContent = 'Look up, is the Scoreboard on?';
  setConnectMessage(`Trying ${name}… Did the scoreboard turn on?`);

  // Send START_ADAPTER with this port
  websocketClient.sendCommand({ type: 'START_ADAPTER', payload: { portName: name } });

  // Show confirmation buttons
  if (notOnBtn) {
    notOnBtn.style.display = '';
    if (retryBtn) retryBtn.style.display = 'none';
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    if (confirmBtn) {
      (confirmBtn as HTMLElement).style.display = '';
      confirmBtn.textContent = "It's On!";
      confirmBtn.className = 'btn btn-success';
    }
    const nextName = portStepper.ports[i + 1] || '';
    notOnCountdownHandle = startNotOnCountdown(notOnBtn, 5, nextName);
  }
};

// Begin stepping through ports
const beginPortStepper = async (ports: string[], currentPort: string) => {
  portStepper.active = true;
  // Order: try currentPort first if present
  const ordered = [...ports];
  if (currentPort) {
    const idx = ordered.indexOf(currentPort);
    if (idx > 0) { ordered.splice(idx, 1); ordered.unshift(currentPort); }
  }
  portStepper.ports = ordered;
  portStepper.index = 0;
  resetConnectModalUI();
  Modals.showById('#scoreboard-connect');
  await tryPortAtIndex(portStepper.index);
};

// Reset modal UI state
const resetConnectModalUI = () => {
  const notOnBtn = $('#not-on') as HTMLButtonElement | null;
  const confirmBtn = $('#confirm-on');
  const retryBtn = $('#retry-ports');
  const giveUpBtn = $('#give-up');
  const titleEl = $('#connect-title');

  if (notOnCountdownTimer) { clearInterval(notOnCountdownTimer); notOnCountdownTimer = null; }
  setConnectMessage('');
  if (retryBtn) retryBtn.style.display = 'none';
  if (giveUpBtn) giveUpBtn.style.display = 'none';
  if (confirmBtn) { (confirmBtn as HTMLElement).style.display = ''; confirmBtn.textContent = "It's On!"; confirmBtn.className = 'btn btn-success'; }
  if (notOnBtn) { notOnBtn.style.display = 'none'; notOnBtn.disabled = false; notOnBtn.textContent = 'Not On'; }
  if (titleEl) titleEl.textContent = 'Look up, is the Scoreboard on?';
  renderPortPills(0);
};

// Reset modal to closed state
const resetConnectModal = () => {
  resetConnectModalUI();
  portStepper.active = false;
  portStepper.index = 0;
};

// Expose for legacy compatibility
(window as any).updatePowerFromServer = (on: boolean) => {
  // If server reports a boolean, reflect it unless we're mid-assumed confirmation
  if (powerState === 'connecting' || powerState === 'assumed') return;
  setPowerUI(on ? 'on' : 'off');
};

// Event handlers
const initEvents = (goalDialog: GoalDialogController) => {
  const blurTarget = (event: Event) => {
    const target = event.currentTarget as HTMLButtonElement | null;
    target?.blur();
  };

  on(document, 'click', '#buzzer', () => websocketClient.sendCommand({ type: 'TRIGGER_BUZZER', payload: {} }));
  on(document, 'click', '#clock-start', () => websocketClient.sendCommand({ type: 'START_CLOCK', payload: {} }));
  on(document, 'click', '#clock-pause', () => websocketClient.sendCommand({ type: 'PAUSE_CLOCK', payload: {} }));
  on(document, 'click', '.period-up', () => {
    withGameState((state) => {
      const maxPeriod = getConfiguredPeriodLimit(state);
      if (state.period >= maxPeriod) {
        return;
      }
      websocketClient.sendCommand({ type: 'SET_PERIOD', payload: { period: state.period + 1 } });
    });
  });
  on(document, 'click', '.period-down', () => {
    withGameState((state) => {
      if (state.period <= 0) {
        return;
      }
      websocketClient.sendCommand({ type: 'SET_PERIOD', payload: { period: state.period - 1 } });
    });
  });

  on(document, 'click', '.score-up', (e, t) => {
    e.preventDefault();
    const team = t.dataset.team as TeamCode; // TeamCode is from legacy, need to map to 'home' | 'away'
    goalDialog.open(team); // This will eventually call websocketClient.sendCommand
  });

  on(document, 'click', '.score-down', (e, t) => {
    const team = t.dataset.team as 'home' | 'away';
    withGameState((state) => {
      const goals = team === 'home' ? state.home.goals : state.away.goals;
      if (goals.length > 0) {
        const lastGoal = goals[goals.length - 1];
        websocketClient.sendCommand({ type: 'REMOVE_GOAL', payload: { goalId: lastGoal.goalId } });
      }
    });
    blurTarget(e);
  });

  on(document, 'click', '.shots-up', (e, t) => {
    const team = t.dataset.team as 'home' | 'away';
    websocketClient.sendCommand({ type: 'ADD_SHOT', payload: { teamId: team } });
    blurTarget(e);
  });

  on(document, 'click', '.shots-down', (e, t) => {
    const team = t.dataset.team as 'home' | 'away';
    websocketClient.sendCommand({ type: 'UNDO_LAST_SHOT', payload: { teamId: team } });
    blurTarget(e);
  });

  // Delete penalty (delegated)
  on(document, 'click', 'a[data-action="delete-penalty"]', (e, t) => {
    e.preventDefault();
    const pid = t.dataset.pid;
    if (pid) {
      websocketClient.sendCommand({ type: 'CANCEL_PENALTY', payload: { penaltyId: pid } });
    }
  });

  // Big clock toggle
  on(document, 'click', '#clock-toggle', () => {
    withGameState((state) => {
      if (state.clock.isRunning) {
        websocketClient.sendCommand({ type: 'PAUSE_CLOCK', payload: {} });
      } else {
        websocketClient.sendCommand({ type: 'START_CLOCK', payload: {} });
      }
    });
  });
  on(document, 'click', '#clock-start', (e) => {
    e.preventDefault();
    websocketClient.sendCommand({ type: 'START_CLOCK', payload: {} });
  });
  on(document, 'click', '#clock-pause', (e) => {
    e.preventDefault();
    websocketClient.sendCommand({ type: 'PAUSE_CLOCK', payload: {} });
  });

  // Power button
  on(document, 'click', '#power-btn', async () => {
    if (powerState === 'on') {
      // Turn off
      setPowerUI('connecting', 'Turning off…');
      try {
        websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} });
      } catch (e) {
        console.error("Error sending STOP_ADAPTER command:", e);
      }
      // Assume quick off
      setTimeout(() => setPowerUI('off'), 500);
      return;
    }

    // Turn on flow - first check if game is initialized
    if (!currentGameState?.config?.templateId) {
      setPowerUI('error', 'Game not initialized. Create a game first.');
      resetConnectModalUI();
      Modals.showById('#scoreboard-connect');
      setConnectMessage('Game not initialized. Create a game first.');
      return;
    }

    // Request available ports and begin stepper workflow
    setPowerUI('connecting', 'Fetching ports…');
    try {
      const portsData = await websocketClient.requestPorts();

      if (portsData.ports.length > 0) {
        setPowerUI('assumed');
        await beginPortStepper(portsData.ports, portsData.currentPort);
      } else {
        setPowerUI('error', 'No serial ports found');
        resetConnectModalUI();
        Modals.showById('#scoreboard-connect');
        setConnectMessage('No serial ports detected. Check USB/power and try again.');
      }
    } catch (e) {
      console.error("Error fetching ports:", e);
      setPowerUI('error', 'Failed to fetch ports');
    }
  });

  // Confirmation from modal
  on(document, 'click', '#confirm-on', () => {
    setPowerUI('on');
    // Reset modal to port selection state for next time
    resetConnectModal();
    Modals.hideById('#scoreboard-connect');
  });

  on(document, 'click', '#not-on', async () => {
    // User indicates the board didn't turn on
    try {
      websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} });
    } catch (e) {
      console.error("Error sending STOP_ADAPTER command:", e);
    }
    if (notOnCountdownHandle) {
      notOnCountdownHandle.cancel();
      notOnCountdownHandle = null;
    }

    if (portStepper.active) {
      const isLast = portStepper.index >= (portStepper.ports.length - 1);
      if (!isLast) {
        // Try next port
        portStepper.index += 1;
        await tryPortAtIndex(portStepper.index);
      } else {
        // Last port exhausted - show Retry + Give Up
        await tryPortAtIndex(portStepper.index + 1); // Will handle "exhausted" case
      }
    } else {
      resetConnectModal();
      Modals.hideById('#scoreboard-connect');
      setPowerUI('off');
    }
  });

  // Retry through ports again
  on(document, 'click', '#retry-ports', async () => {
    // Refresh ports and restart stepper
    setPowerUI('assumed');
    try {
      const portsData = await websocketClient.requestPorts();
      if (portsData.ports.length > 0) {
        await beginPortStepper(portsData.ports, portsData.currentPort);
      } else {
        setConnectMessage('No serial ports detected. Check USB/power and try again.');
      }
    } catch (e) {
      console.error("Error fetching ports:", e);
      setConnectMessage('Failed to fetch ports.');
    }
  });

  // Give up: close port and dialog, reflect Off
  on(document, 'click', '#give-up', () => {
    try {
      websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} });
    } catch (e) {
      console.error("Error sending STOP_ADAPTER command:", e);
    }
    setPowerUI('off');
    resetConnectModal();
    Modals.hideById('#scoreboard-connect');
  });

  // Initialize power UI
  // setPowerUI(State.scoreboardOn ? 'on' : 'off'); // State.scoreboardOn is gone
};

const initSocket = () => {
  const status = document.getElementById('conn-status');
  const overlay = document.getElementById('conn-overlay');
  const overlayText = document.getElementById('conn-overlay-text');
  const setStatus = (state: string, text: string) => {
    if (!status) return;
    status.dataset.state = state;
    status.textContent = text;
  };
  const setOverlay = (state: string, text: string) => {
    if (!overlay) return;
    overlay.dataset.state = state;
    overlay.style.display = state === 'ok' ? 'none' : 'flex';
    if (overlayText) overlayText.textContent = text || '';
  };

  websocketClient.subscribe((newState) => {
    // Update UI based on new state
    renderUpdate(newState);
  });

  websocketClient.subscribeConnection((connectionState) => {
    if (connectionState === 'open') {
      setStatus('ok', 'Connected');
      setOverlay('ok', '');
    } else if (connectionState === 'connecting') {
      setStatus('connecting', 'Connecting...');
      setOverlay('connecting', 'Connecting to scoreboard...');
    } else if (connectionState === 'closed') {
      setStatus('error', 'Disconnected');
      setOverlay('error', 'Unable to reach the scoreboard server. Retrying...');
    }
  });
};

export const resetGameState = () => {
  // This function will now reset the state of the GameEngine via a command
  websocketClient.sendCommand({ type: 'RESET_GAME', payload: {} });
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  Modals.init();
  initTeamColorPickers();
  TeamLayout.init();
  const goalDialog = initGoalDialog(sendCommand, () => ({
    currentPeriod: currentGameState?.period || 0,
    currentTime: currentGameState?.clock.timeRemainingMillis || 0,
    homePenalties: currentGameState?.home.penalties || [],
    awayPenalties: currentGameState?.away.penalties || [],
  }));
  initClockSettingsDialog(() => currentGameState?.clock.timeRemainingMillis || 0);
  initPenaltyDialog(sendCommand, () => ({
    currentPeriod: currentGameState?.period || 0,
    currentTime: currentGameState?.clock.timeRemainingMillis || 0,
  }));
  initPenaltyDetailsPopup();
  initGameDialog(sendCommand);
  initEvents(goalDialog);
  initKeyboardShortcuts({ openGoalDialog: (team) => goalDialog.open(team) });
  initSocket();
});





