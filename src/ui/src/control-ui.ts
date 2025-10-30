/**
 * Main entry point for the Control UI.
 * Orchestrates all UI components and manages application state.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */

import api from './api/http';
import { type ControlState, deriveControlState, buildControlView } from './state/control-state';
import { createServerRuntime, type ServerActions, type TeamCode } from './transport/server';
import { initClockSettingsDialog } from './view/clock-settings';
import { initGameDialog } from './view/game-dialog';
import { initGoalDialog, type GoalDialogController } from './view/goal-dialog';
import Modals from './view/modals';
import { buildPenaltyTable } from './view/penalties';
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

// DOM helpers
const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  document.querySelector<T>(sel);
const $$ = (sel: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(sel));

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

// Application state
const State: ControlState & {
  portNames: string[];
  currentPort: string;
  penaltyDetails: {
    home: Array<{ period: string; player: string; duration: string; off: string; start: string; remaining: string }>;
    away: Array<{ period: string; player: string; duration: string; off: string; start: string; remaining: string }>;
  };
} = {
  time: 0,
  running: false,
  period: 0,
  periodLengthMillis: 0,
  home: { score: 0, shots: 0, penalties: [] },
  away: { score: 0, shots: 0, penalties: [] },
  scoreboardOn: false,
  buzzerOn: false,
  portNames: [],
  currentPort: '',
  penaltyDetails: {
    home: [],
    away: [],
  },
};

// Transport
const { transport, socket, server: Server } = createServerRuntime();

// Rendering
const renderPenaltyTable = (teamElem: HTMLElement | null, teamKey: 'home' | 'away', penalties: any[]) => {
  const listTBody = teamElem && teamElem.querySelector<HTMLElement>('tbody.list');
  const phTBody = teamElem && teamElem.querySelector<HTMLElement>('tbody.placeholders');
  const { rowsHtml, placeholderHtml, details } = buildPenaltyTable(teamKey, penalties || []);
  if (listTBody) listTBody.innerHTML = rowsHtml;
  if (phTBody) phTBody.innerHTML = placeholderHtml;
  if (State.penaltyDetails && State.penaltyDetails[teamKey] !== undefined) {
    State.penaltyDetails[teamKey] = details;
  }
};

const renderUpdate = (data: any) => {
  const nextState = deriveControlState(data);
  Object.assign(State, nextState);
  const view = buildControlView(nextState);

  const home = $('#home');
  const away = $('#away');

  renderPenaltyTable(home, 'home', view.homePenalties);
  renderPenaltyTable(away, 'away', view.awayPenalties);

  const clockText = document.getElementById('clock-text');
  if (clockText) clockText.textContent = view.clockText;

  const clockMoment = $('#clock-moment');
  if (clockMoment) clockMoment.innerHTML = view.elapsedText;

  const periodDigit = $('#period .digit');
  if (periodDigit) periodDigit.textContent = view.periodText;

  const toggle = document.getElementById('clock-toggle');
  if (toggle) {
    const icon = toggle.querySelector('.glyphicon');
    const label = toggle.querySelector('.cta-text');
    if (nextState.running) {
      if (icon) icon.className = 'glyphicon glyphicon-pause';
      if (label) label.textContent = 'Pause';
    } else {
      if (icon) icon.className = 'glyphicon glyphicon-play';
      if (label) label.textContent = 'Start';
    }
  }

  const homeScoreText = document.getElementById('home-score');
  const awayScoreText = document.getElementById('away-score');
  if (homeScoreText) homeScoreText.textContent = view.homeScoreText;
  if (awayScoreText) awayScoreText.textContent = view.awayScoreText;

  const homeShots = document.getElementById('home-shots');
  const awayShots = document.getElementById('away-shots');
  if (homeShots) homeShots.textContent = view.homeShotsText;
  if (awayShots) awayShots.textContent = view.awayShotsText;

  const updatePowerFn = (window as any).updatePowerFromServer;
  if (typeof updatePowerFn === 'function') {
    updatePowerFn(view.scoreboardOn);
  }

  document.body.classList.toggle('buzzer', view.buzzerOn);
};

// Ports UI
let portStepper: PortStepperState = defaultPortStepperState();
let notOnCountdownHandle: CountdownHandle | null = null;

const refreshPortDialog = () => {
  const wrap = $('#connect-portNames');
  if (wrap) wrap.innerHTML = '';
};

const renderPortChips = (activeIndex = 0) => {
  renderPortPills($('#connect-portNames'), portStepper.ports || [], activeIndex);
};

const setConnectMessage = (msg: string) => {
  setPortMessage($('#connect-message'), msg || '');
};

const getPortDialogElements = () => {
  const modal = $('#scoreboard-connect');
  return {
    container: $('#connect-portNames'),
    progress: modal ? modal.querySelector<HTMLElement>('.progress') : null,
    notOnButton: $('#not-on') as HTMLButtonElement | null,
    confirmButton: $('#confirm-on') as HTMLButtonElement | null,
    retryButton: $('#retry-ports') as HTMLButtonElement | null,
    giveUpButton: $('#give-up') as HTMLButtonElement | null,
    messageEl: $('#connect-message'),
  };
};

const resetConnectDialogUI = () => {
  const elements = getPortDialogElements();
  resetPortDialog(elements, notOnCountdownHandle);
  notOnCountdownHandle = null;
  renderPortChips(0);
};

const updatePortStateFromResponse = (resp: any, fallbackPort: string) => {
  if (resp) {
    State.portNames = resp.portNames || State.portNames;
    State.currentPort = resp.currentPort || fallbackPort;
  } else {
    State.currentPort = fallbackPort;
  }
};

const tryPortAtIndex = async (i: number) => {
  const elements = getPortDialogElements();
  const name = portStepper.ports[i];
  const notOnBtn = elements.notOnButton;
  const confirmBtn = elements.confirmButton;
  const retryBtn = elements.retryButton;

  if (!name) {
    if (elements.progress) elements.progress.style.display = 'none';
    setConnectMessage('No more ports to try. Check USB/power and cables.');
    portStepper.active = false;
    try {
      Server.powerOff();
    } catch {}
    setPowerUI('off');
    renderPortChips(portStepper.ports.length);
    if (notOnBtn) resetNotOnButton(notOnBtn);
    if (notOnCountdownHandle) {
      notOnCountdownHandle.cancel();
      notOnCountdownHandle = null;
    }
    if (retryBtn) retryBtn.style.display = '';
    if (confirmBtn) confirmBtn.textContent = "It's On!";
    return;
  }

  renderPortChips(i);
  try {
    await tryPortSelection(
      name,
      elements,
      (resp, attemptedPort) => updatePortStateFromResponse(resp, attemptedPort)
    );
  } catch (err: any) {
    const message = err && err.message ? err.message : String(err || 'Unknown error');
    setConnectMessage(`Unable to communicate with ${name}: ${message}`);
    if (notOnCountdownHandle) {
      notOnCountdownHandle.cancel();
      notOnCountdownHandle = null;
    }
    if (notOnBtn) {
      resetNotOnButton(notOnBtn);
      notOnBtn.style.display = '';
      notOnBtn.disabled = false;
    }
    if (retryBtn) retryBtn.style.display = '';
    if (confirmBtn) {
      confirmBtn.style.display = '';
      confirmBtn.textContent = 'Retry';
      confirmBtn.className = 'btn btn-warning';
    }
    return;
  }

  try {
    Server.powerOff();
  } catch {}
  try {
    Server.powerOn();
  } catch {}

  if (notOnCountdownHandle) notOnCountdownHandle.cancel();
  const nextName = portStepper.ports[i + 1] || '';
  notOnCountdownHandle = startNotOnCountdown(notOnBtn, 5, nextName);
};

const beginPortStepper = async () => {
  portStepper = defaultPortStepperState();
  initializeStepper(portStepper, State.portNames || [], State.currentPort, $('#connect-portNames'));
  resetConnectDialogUI();
  Modals.showById('#scoreboard-connect');
  await tryPortAtIndex(portStepper.index);
};

// Power control
let powerState: 'off' | 'connecting' | 'assumed' | 'on' | 'error' = 'off';

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

// Expose for legacy compatibility
(window as any).updatePowerFromServer = (on: boolean) => {
  // If server reports a boolean, reflect it unless we're mid-assumed confirmation
  if (powerState === 'connecting' || powerState === 'assumed') return;
  setPowerUI(on ? 'on' : 'off');
};

// Event handlers
const initEvents = (goalDialog: GoalDialogController) => {
  // Navbar buttons
  const buzzerBtn = $('#buzzer');
  if (buzzerBtn) buzzerBtn.addEventListener('click', () => Server.buzzer());

  const clockStartBtn = $('#clock-start');
  if (clockStartBtn) clockStartBtn.addEventListener('click', () => Server.startClock());

  const clockPauseBtn = $('#clock-pause');
  if (clockPauseBtn) clockPauseBtn.addEventListener('click', () => Server.pauseClock());

  // Period controls
  const periodUp = $('.period-up');
  const periodDown = $('.period-down');
  if (periodUp) periodUp.addEventListener('click', () => Server.setPeriod(State.period + 1));
  if (periodDown) periodDown.addEventListener('click', () => Server.setPeriod(Math.max(0, State.period - 1)));

  // Score buttons
  $$('.score-up').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const team = (e.currentTarget as HTMLElement).dataset.team as TeamCode;
      goalDialog.open(team);
    })
  );
  $$('.score-down').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const team = (e.currentTarget as HTMLElement).dataset.team as 'home' | 'away';
      Server.undoGoal({ team });
    })
  );

  // Shot buttons
  $$('.shots-up').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const team = (e.currentTarget as HTMLElement).dataset.team as 'home' | 'away';
      Server.shot({ team });
    })
  );
  $$('.shots-down').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const team = (e.currentTarget as HTMLElement).dataset.team as 'home' | 'away';
      Server.undoShot({ team });
    })
  );

  // Delete penalty (delegated)
  on(document, 'click', 'a[data-action="delete-penalty"]', (e, t) => {
    e.preventDefault();
    const team = t.dataset.team;
    const pid = t.dataset.pid;
    api.del(`${team}/penalty/${pid}`).catch(() => {});
  });

  // Big clock toggle
  const clockToggle = document.getElementById('clock-toggle');
  if (clockToggle) {
    clockToggle.addEventListener('click', () => {
      if (State.running) Server.pauseClock();
      else Server.startClock();
    });
  }

  // Power button
  const powerBtn = $('#power-btn');
  if (powerBtn) {
    powerBtn.addEventListener('click', async () => {
      if (powerState === 'on') {
        // Turn off
        setPowerUI('connecting', 'Turning off…');
        try {
          Server.powerOff();
        } catch {}
        // Assume quick off
        setTimeout(() => setPowerUI('off'), 500);
        return;
      }
      // Turn on flow
      setPowerUI('connecting', 'Opening port…');
      // Prepare ports list
      try {
        const data = await api.get<any>('portNames');
        State.portNames = data.portNames || [];
        State.currentPort = data.currentPort || '';
        refreshPortDialog();
      } catch {}
      // Step through ports if available, otherwise show modal with message
      if (State.portNames && State.portNames.length) {
        setPowerUI('assumed');
        await beginPortStepper();
      } else {
        setPowerUI('error', 'No serial ports found');
        resetConnectDialogUI();
        Modals.showById('#scoreboard-connect');
        setConnectMessage('No serial ports detected. Check USB/power and try again.');
      }
    });
  }

  // Confirmation from modal
  on(document, 'click', '#confirm-on', () => {
    setPowerUI('on');
  });

  on(document, 'click', '#not-on', async () => {
    // User indicates the board didn't turn on
    try {
      Server.powerOff();
    } catch {}
    if (notOnCountdownHandle) {
      notOnCountdownHandle.cancel();
      notOnCountdownHandle = null;
    }
    const confirmBtn = $('#confirm-on') as HTMLButtonElement | null;
    const retryBtn = $('#retry-ports') as HTMLButtonElement | null;
    const giveUpBtn = $('#give-up') as HTMLButtonElement | null;
    const notOnBtn = $('#not-on') as HTMLButtonElement | null;
    if (portStepper.active) {
      const isLast = portStepper.index >= portStepper.ports.length - 1;
      if (!isLast) {
        portStepper.index += 1;
        await tryPortAtIndex(portStepper.index);
      } else {
        // Last port: show Retry + Give Up, hide confirm
        setConnectMessage('No more ports to try. You can Retry or Give Up.');
        if (confirmBtn) confirmBtn.style.display = '';
        if (retryBtn) retryBtn.style.display = '';
        if (giveUpBtn) giveUpBtn.style.display = '';
        if (notOnBtn) resetNotOnButton(notOnBtn);
      }
    } else {
      const modal = $('#scoreboard-connect');
      if (modal) Modals.hide(modal);
      setPowerUI('off');
    }
  });

  // Retry through ports again
  on(document, 'click', '#retry-ports', async () => {
    const notOnBtn = $('#not-on') as HTMLButtonElement | null;
    const confirmBtn = $('#confirm-on');
    const retryBtn = $('#retry-ports');
    const giveUpBtn = $('#give-up');
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
    // Refresh port list
    try {
      const data = await api.get<any>('portNames');
      State.portNames = data.portNames || [];
      State.currentPort = data.currentPort || '';
    } catch {}
    setPowerUI('assumed');
    await beginPortStepper();
  });

  // Give up: close port and dialog, reflect Off
  on(document, 'click', '#give-up', () => {
    const modal = $('#scoreboard-connect');
    try {
      Server.powerOff();
    } catch {}
    setPowerUI('off');
    if (modal) Modals.hide(modal);
  });

  // Initialize power UI
  setPowerUI(State.scoreboardOn ? 'on' : 'off');
};

// Socket events
const output = (html: string) => {
  const consoleBox = $('#console');
  if (!consoleBox) return;
  // Prune old messages (keep ~10 seconds worth visually)
  while (consoleBox.children.length > 20) consoleBox.removeChild(consoleBox.lastChild!);
  const el = document.createElement('div');
  el.innerHTML = html;
  consoleBox.prepend(el);
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
  transport.onStatus({
    connect: async () => {
      setStatus('ok', 'Connected');
      setOverlay('ok', '');
      output('<span class="connect-msg">Connected</span>');
      try {
        const data = await api.get<any>('portNames');
        State.portNames = data.portNames || [];
        State.currentPort = data.currentPort || '';
        // Refresh power label with port if already on
        if (State.scoreboardOn) setPowerUI('on');
        else setPowerUI('off');
      } catch {}
    },
    disconnect: () => {
      setStatus('down', 'Disconnected');
      setOverlay('down', 'Reconnecting...');
      output('<span class="disconnect-msg">Disconnected! Make sure the app is running!</span>');
    },
    reconnecting: () => {
      setStatus('reconnecting', 'Reconnecting...');
      setOverlay('reconnecting', 'Reconnecting...');
    },
    error: () => {
      setStatus('down', 'Connect error');
      setOverlay('down', 'Reconnecting...');
    },
  });
  socket.on('message', (data) => output(`<pre>Message ${JSON.stringify(data)}</pre>`));
  socket.on('power', (data) => {
    output(
      `<span class="disconnect-msg">The Scoreboard has been turned ${data.scoreboardOn ? 'ON' : 'OFF'}</span>`
    );
    if (typeof (window as any).updatePowerFromServer === 'function') {
      (window as any).updatePowerFromServer(!!data.scoreboardOn);
    }
  });
  socket.on('update', (data) => renderUpdate(data));
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  Modals.init();
  initTeamColorPickers();
  TeamLayout.init();
  const goalDialog = initGoalDialog(Server as ServerActions, () => ({
    currentPeriod: State.period,
    currentTime: State.time,
  }));
  initClockSettingsDialog(() => State.time);
  initPenaltyDialog(() => ({ currentPeriod: State.period, currentTime: State.time }));
  initPenaltyDetailsPopup();
  initGameDialog(Server as ServerActions);
  initEvents(goalDialog);
  initKeyboardShortcuts({ openGoalDialog: (team) => goalDialog.open(team) });
  initSocket();
});





