import {
  minutesStepForShift,
  normalizeMinutes,
  parseClockMillis,
  formatClock,
  millisToMinSec,
  pad,
  roundToSecond,
} from "./time-utils.js";
import { api } from "./api.js";
import { State } from "./state.js";
import { TeamLayout } from "./team-layout.js";
import { Server } from "./transport.js";
import { $, $$, on, createModalManager } from "./dom.js";
import { createButtonFocusManager } from "./button-behavior.js";
import { initTeamColorControls } from "./team-colors.js";
import { initNavbarControls } from "./navbar-controls.js";
import { initScoreControls } from "./score-controls.js";
import { initPenaltyControls } from "./penalty-controls.js";
import { initPowerControls } from "./power-controls.js";
import { initClockDialog } from "./clock-dialog.js";
import { initStandardGameForm } from "./standard-game-form.js";
import { initRecGameForm } from "./rec-game-form.js";
import { initGameDialogUi } from "./game-dialog-ui.js";
import { createKeyboardShortcuts } from "./keyboard-shortcuts.js";
import { createRenderer } from "./rendering.js";
import { initSocket } from "./socket-events.js";

const focusManager = createButtonFocusManager();
const Modals = createModalManager({
  suppressHover: focusManager.suppressHover,
  restoreHover: focusManager.restoreHover,
});

try {
  window.__test = Object.assign(window.__test || {}, {
    minutesStepForShift,
    normalizeMinutes,
  });
} catch (_) {
  /* ignore test exposure failures */
}

document.addEventListener("DOMContentLoaded", () => {
  focusManager.init();
  Modals.init();
  TeamLayout.init();

  initTeamColorControls();
  initNavbarControls({ Server, State });

  const { openGoalModal } = initScoreControls({
    api,
    Server,
    State,
    Modals,
    millisToMinSec,
    formatClock,
    parseClockMillis,
    scheduleBlur: focusManager.scheduleBlur,
  });

  initPenaltyControls({
    api,
    State,
    Modals,
    millisToMinSec,
    formatClock,
    parseClockMillis,
    roundToSecond,
  });

  const powerControls = initPowerControls({ api, State, Server, Modals });

  initClockDialog({
    api,
    Modals,
    State,
    parseClockMillis,
    millisToMinSec,
    formatClock,
  });

  const standardForm = initStandardGameForm({ Server, Modals });

  initRecGameForm({
    api,
    Server,
    State,
    Modals,
    parseClockMillis,
    formatClock,
    millisToMinSec,
    minutesStepForShift,
    pad,
    roundToSecond,
    clearStandardErrors: standardForm.clearStandardErrors,
    loadStoredStandardValues: standardForm.loadStoredStandardValues,
  });

  const keyboardShortcuts = createKeyboardShortcuts({
    Server,
    State,
    openGoalModal,
  });

  initGameDialogUi(keyboardShortcuts);

  const renderer = createRenderer({
    onPowerStateChange: powerControls.updatePowerFromServer,
  });

  initSocket({
    renderUpdate: renderer.renderUpdate,
    setPowerUI: powerControls.setPowerUI,
    updatePowerFromServer: powerControls.updatePowerFromServer,
  });

  keyboardShortcuts.init();

  try {
    window.__test = Object.assign(window.__test || {}, {
      shortcuts: () => keyboardShortcuts.getShortcuts(),
      shortcutsReady: () => keyboardShortcuts.whenReady(),
      shortcutsLoadError: () => keyboardShortcuts.hadError(),
    });
  } catch (_) {
    /* ignore */
  }
});
