/**
 * Main entry point for the Control UI.
 * Orchestrates all UI components and manages application state.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */

import { type GoalEvent, type Penalty, type GameState, type Command } from './api/game.types'; // Import new types
import { websocketClient } from './websocket'; // Import the new WebSocket client
import { initClockSettingsDialog } from './view/clock-settings';
import { initGameDialog } from './view/game-dialog';
import { initGoalDialog, type GoalDialogController } from './view/goal-dialog';
import Modals from './view/modals';
import { initPenaltyDialog, initPenaltyDetailsPopup } from './view/penalty-dialog';
import {
  defaultPortStepperState,
  initializeStepper,
  renderPortPills,
  resetNotOnButton,
  resetPortDialog,
  setPortMessage,
  startNotOnCountdown,
  tryPortSelection,
  type PortStepperState,
  type CountdownHandle,
} from './view/ports';
import { initTeamColorPickers } from './view/team-colors';
import { TeamLayout } from './view/team-layout';
import { initKeyboardShortcuts } from './view/keyboard-shortcuts';
import { pad, millisToMinSec } from './utils/time';

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

const withGameState = (handler: (state: GameState) => void) => {
  if (currentGameState) {
    handler(currentGameState);
  } else {
    pendingStateActions.push(handler);
  }
};

const getConfiguredPeriodLimit = (state: GameState | null): number => {
  if (!state) return 3;
  const config = (state as Record<string, unknown> & { config?: { periods?: number } }).config;
  const configured = config && typeof config.periods === 'number' ? config.periods : null;
  return configured && configured > 0 ? configured : 3;
};

// Rendering
type TeamCode = 'home' | 'away';

const sendCommand = (command: Command) => {
  websocketClient.sendCommand(command);
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
  let latestHomeScoreText: string | null = null;
  let latestAwayScoreText: string | null = null;

  // Clock
  const oldClock = previousState?.clock;
  const newClock = newState.clock;
  if (!oldClock || oldClock.timeRemainingMillis !== newClock.timeRemainingMillis) {
    const clockText = document.getElementById('clock-text');
    const { minutes, seconds } = millisToMinSec(newClock.timeRemainingMillis);
    if (clockText) clockText.textContent = `${pad(minutes, 2)}:${pad(seconds, 2)}`;
    // const clockMoment = $('#clock-moment'); // No direct equivalent in new state for elapsedText
    // if (clockMoment) clockMoment.innerHTML = view.elapsedText;
  }

  if (!oldClock || oldClock.isRunning !== newClock.isRunning) {
    const toggle = document.getElementById('clock-toggle');
    if (toggle) {
      const icon = toggle.querySelector('.glyphicon');
      const label = toggle.querySelector('.cta-text');
      if (newClock.isRunning) {
        if (icon) icon.className = 'glyphicon glyphicon-pause';
        if (label) label.textContent = 'Pause';
      } else {
        if (icon) icon.className = 'glyphicon glyphicon-play';
        if (label) label.textContent = 'Start';
      }
    }
  }

  // Period
  if (!previousState || previousState.period !== newState.period) {
    const periodDigit = $('#period .digit');
    if (periodDigit) periodDigit.textContent = String(newState.period);
  }
  const buzzerIndicator = document.querySelector<HTMLDivElement>('#period-indicators [data-indicator="buzzer"]');
  if (buzzerIndicator) {
    buzzerIndicator.dataset.state = newState.buzzerOn ? 'active' : 'idle';
  }
  const intermissionIndicator = document.querySelector<HTMLDivElement>('#period-indicators [data-indicator="intermission"]');
  if (intermissionIndicator) {
    const statusText = String((newState as Record<string, unknown> & { status?: string }).status ?? '').toUpperCase();
    intermissionIndicator.dataset.state = statusText === 'INTERMISSION' ? 'active' : 'idle';
  }
  const periodUpBtn = document.querySelector<HTMLButtonElement>('.period-up');
  if (periodUpBtn) {
    periodUpBtn.disabled = newState.period >= getConfiguredPeriodLimit(newState);
  }
  const periodDownBtn = document.querySelector<HTMLButtonElement>('.period-down');
  if (periodDownBtn) {
    periodDownBtn.disabled = newState.period <= 0;
  }

  // Home Team
  const oldHome = previousState?.home;
  const newHome = newState.home;
  if (!oldHome || oldHome.goals.length !== newHome.goals.length) { // Score is derived from goals length
    const homeScoreText = document.getElementById('home-score');
    if (homeScoreText) {
      latestHomeScoreText = pad(newHome.goals.length, 2);
      homeScoreText.textContent = latestHomeScoreText;
    }
  }
  if (!oldHome || oldHome.shots !== newHome.shots) {
    const homeShots = document.getElementById('home-shots');
    if (homeShots) homeShots.textContent = String(newHome.shots);
  }
  if (!oldHome || JSON.stringify(oldHome.penalties) !== JSON.stringify(newHome.penalties)) {
    const home = $('#home');
    renderPenaltyTable(home, 'home', newHome.penalties);
  }
  if (!oldHome || JSON.stringify(oldHome.goals) !== JSON.stringify(newHome.goals)) {
    const home = $('#home');
    renderGoalTable(home, newHome.goals);
  }

  // Away Team
  const oldAway = previousState?.away;
  const newAway = newState.away;
  if (!oldAway || oldAway.goals.length !== newAway.goals.length) { // Score is derived from goals length
    const awayScoreText = document.getElementById('away-score');
    if (awayScoreText) {
      latestAwayScoreText = pad(newAway.goals.length, 2);
      awayScoreText.textContent = latestAwayScoreText;
    }
  }
  if (!oldAway || oldAway.shots !== newAway.shots) {
    const awayShots = document.getElementById('away-shots');
    if (awayShots) awayShots.textContent = String(newAway.shots);
  }
  if (!oldAway || JSON.stringify(oldAway.penalties) !== JSON.stringify(newAway.penalties)) {
    const away = $('#away');
    renderPenaltyTable(away, 'away', newAway.penalties);
  }
  if (!oldAway || JSON.stringify(oldAway.goals) !== JSON.stringify(newAway.goals)) {
    const away = $('#away');
    renderGoalTable(away, newAway.goals);
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

// Ports UI (Legacy - will need refactoring or removal)
// let portStepper: PortStepperState = defaultPortStepperState();

// const refreshPortDialog = () => {
//   const wrap = $('#connect-portNames');
//   if (wrap) wrap.innerHTML = '';
// };

// const renderPortChips = (activeIndex = 0) => {
//   renderPortPills($('#connect-portNames'), portStepper.ports || [], activeIndex);
// };

// const setConnectMessage = (msg: string) => {
//   setPortMessage($('#connect-message'), msg || '');
// };

// const getPortDialogElements = () => {
//   const modal = $('#scoreboard-connect');
//   return {
//     container: $('#connect-portNames'),
//     progress: modal ? modal.querySelector<HTMLElement>('.progress') : null,
//     notOnButton: $('#not-on') as HTMLButtonElement | null,
//     confirmButton: $('#confirm-on') as HTMLButtonElement | null,
//     retryButton: $('#retry-ports') as HTMLButtonButtonElement | null,
//     giveUpButton: $('#give-up') as HTMLButtonElement | null,
//     messageEl: $('#connect-message'),
//   };
// };

// const resetConnectDialogUI = () => {
//   const elements = getPortDialogElements();
//   resetPortDialog(elements, notOnCountdownHandle);
//   notOnCountdownHandle = null;
//   renderPortChips(0);
// };

// const updatePortStateFromResponse = (resp: any, fallbackPort: string) => {
//   if (resp) {
//     // State.portNames = resp.portNames || State.portNames; // No longer using global State for this
//     // State.currentPort = resp.currentPort || fallbackPort; // No longer using global State for this
//   } else {
//     // State.currentPort = fallbackPort; // No longer using global State for this
//   }
// };

// const tryPortAtIndex = async (i: number) => {
//   const elements = getPortDialogElements();
//   const name = portStepper.ports[i];
//   const notOnBtn = elements.notOnButton;
//   const confirmBtn = elements.confirmButton;
//   const retryBtn = elements.retryButton;

//   if (!name) {
//     if (elements.progress) elements.progress.style.display = 'none';
//     setConnectMessage('No more ports to try. Check USB/power and cables.');
//     portStepper.active = false;
//     // Server.powerOff(); // Legacy call
//     setPowerUI('off');
//     renderPortChips(portStepper.ports.length);
//     if (notOnBtn) resetNotOnButton(notOnBtn);
//     if (notOnCountdownHandle) {
//       notOnCountdownHandle.cancel();
//       notOnCountdownHandle = null;
//     }
//     if (retryBtn) retryBtn.style.display = '';
//     if (confirmBtn) confirmBtn.textContent = "It's On!";
//     return;
//   }

//   renderPortChips(i);
//   try {
//     await tryPortSelection(
//       name,
//       elements,
//       (resp, attemptedPort) => updatePortStateFromResponse(resp, attemptedPort)
//     );
//   } catch (err: any) {
//     const message = err && err.message ? err.message : String(err || 'Unknown error');
//     setConnectMessage(`Unable to communicate with ${name}: ${message}`);
//     if (notOnCountdownHandle) {
//       notOnCountdownHandle.cancel();
//       notOnCountdownHandle = null;
//     }
//     if (notOnBtn) {
//       resetNotOnButton(notOnBtn);
//       notOnBtn.style.display = '';
//       notOnBtn.disabled = false;
//     }
//     if (retryBtn) retryBtn.style.display = '';
//     if (confirmBtn) {
//       confirmBtn.style.display = '';
//       confirmBtn.textContent = 'Retry';
//       confirmBtn.className = 'btn btn-warning';
//     }
//     return;
//   }

//   // Server.powerOff(); // Legacy call
//   // Server.powerOn(); // Legacy call

//   if (notOnCountdownHandle) notOnCountdownHandle.cancel();
//   const nextName = portStepper.ports[i + 1] || '';
//   notOnCountdownHandle = startNotOnCountdown(notOnBtn, 5, nextName);
// };

// const beginPortStepper = async () => {
//   portStepper = defaultPortStepperState();
//   // initializeStepper(portStepper, State.portNames || [], State.currentPort, $('#connect-portNames')); // State.portNames and State.currentPort are gone
//   resetConnectDialogUI();
//   Modals.showById('#scoreboard-connect');
//   await tryPortAtIndex(portStepper.index);
// };

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
        websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} }); // New command
      } catch (e) {
        console.error("Error sending STOP_ADAPTER command:", e);
      }
      // Assume quick off
      setTimeout(() => setPowerUI('off'), 500);
      return;
    }
    // Turn on flow
    setPowerUI('connecting', 'Opening port…');
    // In the new architecture, the server manages port selection.
    // We just send a command to start the adapter.
    if (currentGameState?.config.templateId) {
      setPowerUI('assumed');
      websocketClient.sendCommand({ type: 'START_ADAPTER', payload: {} }); // New command
    } else {
      setPowerUI('error', 'Game not initialized. Create a game first.');
      Modals.showById('#scoreboard-connect');
      setConnectMessage('Game not initialized. Create a game first.');
    }
  });

  // Confirmation from modal
  on(document, 'click', '#confirm-on', () => {
    setPowerUI('on');
  });

  on(document, 'click', '#not-on', async () => {
    // User indicates the board didn't turn on
    try {
      websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} }); // New command
    } catch (e) {
      console.error("Error sending STOP_ADAPTER command:", e);
    }
    if (notOnCountdownHandle) {
      notOnCountdownHandle.cancel();
      notOnCountdownHandle = null;
    }
    const modal = $('#scoreboard-connect');
    if (modal) Modals.hide(modal);
    setPowerUI('off');
  });

  // Retry through ports again
  on(document, 'click', '#retry-ports', async () => {
    const notOnBtn = $('#not-on') as HTMLButtonElement | null;
    const confirmBtn = $('#confirm-on');
    const retryBtn = $('#retry-ports');
    const giveUpBtn = $('#giveUpButton');
    if (retryBtn) retryBtn.style.display = 'none';
    if (giveUpBtn) giveUpBtn.style.display = 'none';
    if (notOnBtn) {
      notOnBtn.style.display = '';
      notOnBtn.disabled = true;
    }
    if (confirmBtn) {
      confirmBtn.style.display = '';
      confirmBtn.textContent = "It's On!";
      confirmBtn.className = 'btn btn-success';
    }
    // In the new architecture, the server manages port selection.
    // We just send a command to start the adapter.
    setPowerUI('assumed');
    try {
      websocketClient.sendCommand({ type: 'START_ADAPTER', payload: {} }); // New command
    } catch (e) {
      console.error("Error sending START_ADAPTER command:", e);
    }
  });

  // Give up: close port and dialog, reflect Off
  on(document, 'click', '#give-up', () => {
    const modal = $('#scoreboard-connect');
    try {
      websocketClient.sendCommand({ type: 'STOP_ADAPTER', payload: {} }); // New command
    } catch (e) {
      console.error("Error sending STOP_ADAPTER command:", e);
    }
    setPowerUI('off');
    if (modal) Modals.hide(modal);
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
  }));
  initClockSettingsDialog(() => currentGameState?.clock.timeRemainingMillis || 0);
  initPenaltyDialog(sendCommand, () => ({
    currentPeriod: currentGameState?.period || 0,
    currentTime: currentGameState?.clock.timeRemainingMillis || 0,
  }));
  initPenaltyDetailsPopup();
  initGameDialog(sendCommand, resetGameState);
  initEvents(goalDialog);
  initKeyboardShortcuts({ openGoalDialog: (team) => goalDialog.open(team) });
  initSocket();
});





