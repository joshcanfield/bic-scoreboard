export type UiMode = 'standard' | 'big-buttons' | 'compact';

export const UI_MODE_STORAGE_KEY = 'scoreboard.ui_mode';

const VALID_MODES: readonly UiMode[] = ['standard', 'big-buttons', 'compact'] as const;

export interface UiModeController {
  getMode: () => UiMode;
  setMode: (mode: UiMode) => void;
  cycleMode: () => UiMode;
  subscribe: (listener: (mode: UiMode) => void) => () => void;
}

const isValidMode = (val: unknown): val is UiMode => {
  return typeof val === 'string' && (VALID_MODES as readonly string[]).includes(val);
};

export const createUiModeController = (): UiModeController => {
  const listeners: Array<(mode: UiMode) => void> = [];

  const readStoredMode = (): UiMode => {
    try {
      const stored = localStorage.getItem(UI_MODE_STORAGE_KEY);
      if (isValidMode(stored)) {
        return stored;
      }
    } catch {
      // LocalStorage access may fail in certain browser security configurations
    }
    return 'standard';
  };

  let currentMode: UiMode = readStoredMode();

  const updateDom = (mode: UiMode) => {
    if (typeof document === 'undefined') return;

    if (document.body) {
      document.body.dataset.uiMode = mode;
    }

    const buttons = document.querySelectorAll<HTMLButtonElement>('[data-ui-mode]');
    buttons.forEach((btn) => {
      const btnMode = btn.dataset.uiMode;
      const isActive = btnMode === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  const setMode = (mode: UiMode) => {
    if (!isValidMode(mode)) return;
    currentMode = mode;

    try {
      localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }

    updateDom(mode);
    listeners.forEach((fn) => fn(mode));
  };

  const cycleMode = (): UiMode => {
    const currentIndex = VALID_MODES.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % VALID_MODES.length;
    const nextMode = VALID_MODES[nextIndex];
    setMode(nextMode);
    return nextMode;
  };

  const subscribe = (listener: (mode: UiMode) => void) => {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  };

  // Initial DOM sync and event delegation
  updateDom(currentMode);

  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-ui-mode]');
      if (!target) return;
      const mode = target.dataset.uiMode;
      if (isValidMode(mode)) {
        e.preventDefault();
        setMode(mode);
      }
    });
  }

  return {
    getMode: () => currentMode,
    setMode,
    cycleMode,
    subscribe,
  };
};

let defaultController: UiModeController | null = null;

export const initUiModes = (): UiModeController => {
  if (!defaultController) {
    defaultController = createUiModeController();
  }
  return defaultController;
};
