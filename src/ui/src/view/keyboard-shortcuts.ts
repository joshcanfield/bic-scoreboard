import { TeamLayout } from './team-layout';

type TeamKey = 'home' | 'away';

// Extend Window to include test hooks
interface WindowWithTestHooks extends Window {
  __test?: Record<string, unknown>;
}

export interface KeyboardShortcutOptions {
  openGoalDialog: (team: TeamKey) => void;
}

interface ShortcutSpec {
  code?: string;
  key?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  preventDefault?: boolean;
  exposeAs?: string;
}

type BindingMap = Record<string, string[]>;

const latestBindings: BindingMap = {};

const cloneBindings = (): BindingMap =>
  Object.fromEntries(Object.entries(latestBindings).map(([name, bindings]) => [name, [...bindings]]));

const updateShortcutTestHooks = () => {
  const win = window as WindowWithTestHooks;
  const existingTestHooks = win.__test ?? {};
  win.__test = {
    ...existingTestHooks,
    shortcutsReady: () => Promise.resolve(),
    shortcutsLoadError: () => false,
    shortcuts: () => cloneBindings(),
  };
};

const getTeamLabel = (team: TeamKey) => (team === 'home' ? 'Home' : 'Away');

const isTypingContext = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  const isInput =
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    el.isContentEditable ||
    (tag === 'SELECT' && !(el as HTMLSelectElement).disabled);
  if (isInput) return true;
  // Ignore when inside bootstrap modals or when body is in modal-open state
  if (document.body.classList.contains('modal-open')) return true;
  return false;
};

const matchesShortcut = (event: KeyboardEvent, spec: ShortcutSpec): boolean => {
  const expectedCtrl = spec.ctrlKey ?? false;
  const expectedShift = spec.shiftKey ?? false;
  const expectedAlt = spec.altKey ?? false;
  const expectedMeta = spec.metaKey ?? false;

  if (event.ctrlKey !== expectedCtrl) return false;
  if (event.shiftKey !== expectedShift) return false;
  if (event.altKey !== expectedAlt) return false;
  if (event.metaKey !== expectedMeta) return false;

  if (spec.code && event.code !== spec.code) return false;
  if (spec.key && event.key !== spec.key) return false;

  return true;
};

const triggerButton = (selector: string) => {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

const openPenaltyDialog = (team: TeamKey) => {
  triggerButton(`#${team} .penalties a.penalty`);
};

const addShot = (team: TeamKey) => {
  triggerButton(`#${team} .shots-up`);
};

const undoShot = (team: TeamKey) => {
  triggerButton(`#${team} .shots-down`);
};

const getTeamForSide = (side: 'left' | 'right'): TeamKey => TeamLayout.getTeamForSide(side);

const updateShortcutTeamLabels = () => {
  const leftTeam = getTeamLabel(getTeamForSide('left'));
  const rightTeam = getTeamLabel(getTeamForSide('right'));
  document.querySelectorAll<HTMLElement>('[data-shortcut-team="left"]').forEach((el) => {
    el.textContent = leftTeam;
  });
  document.querySelectorAll<HTMLElement>('[data-shortcut-team="right"]').forEach((el) => {
    el.textContent = rightTeam;
  });
};

const adjustPeriod = (direction: 'up' | 'down') => {
  const selector = direction === 'up' ? '.period-up' : '.period-down';
  triggerButton(selector);
};

export const initKeyboardShortcuts = ({ openGoalDialog }: KeyboardShortcutOptions) => {
  updateShortcutTeamLabels();
  document.addEventListener('scoreboard:layout-changed', updateShortcutTeamLabels as EventListener);

  const shortcuts: ShortcutSpec[] = [
    // Period adjustments (require Ctrl)
    {
      key: 'ArrowUp',
      ctrlKey: true,
      action: () => adjustPeriod('up'),
      preventDefault: true,
      exposeAs: 'periodUp',
    },
    {
      key: 'ArrowDown',
      ctrlKey: true,
      action: () => adjustPeriod('down'),
      preventDefault: true,
      exposeAs: 'periodDown',
    },
    // Clock controls
    {
      key: 'ArrowUp',
      action: () => triggerButton('#clock-start'),
      preventDefault: true,
      exposeAs: 'clockStart',
    },
    {
      code: 'KeyW',
      action: () => triggerButton('#clock-start'),
      preventDefault: true,
      exposeAs: 'clockStart',
    },
    {
      key: 'ArrowDown',
      action: () => triggerButton('#clock-pause'),
      preventDefault: true,
      exposeAs: 'clockPause',
    },
    {
      code: 'KeyS',
      action: () => triggerButton('#clock-pause'),
      preventDefault: true,
      exposeAs: 'clockPause',
    },
    {
      code: 'Space',
      action: () => triggerButton('#clock-toggle'),
      preventDefault: true,
      exposeAs: 'clockToggle',
    },
    // Buzzer
    {
      code: 'KeyB',
      action: () => triggerButton('#buzzer'),
      preventDefault: true,
      exposeAs: 'buzzer',
    },
    // Shots - left column
    {
      code: 'KeyQ',
      action: () => addShot(getTeamForSide('left')),
      preventDefault: true,
      exposeAs: 'leftShot',
    },
    {
      code: 'KeyQ',
      shiftKey: true,
      action: () => undoShot(getTeamForSide('left')),
      preventDefault: true,
      exposeAs: 'leftShotUndo',
    },
    // Shots - right column
    {
      code: 'KeyE',
      action: () => addShot(getTeamForSide('right')),
      preventDefault: true,
      exposeAs: 'rightShot',
    },
    {
      code: 'KeyE',
      shiftKey: true,
      action: () => undoShot(getTeamForSide('right')),
      preventDefault: true,
      exposeAs: 'rightShotUndo',
    },
    // Goals
    {
      key: 'ArrowLeft',
      action: () => openGoalDialog(getTeamForSide('left')),
      preventDefault: true,
      exposeAs: 'homeGoal',
    },
    {
      code: 'KeyA',
      action: () => openGoalDialog(getTeamForSide('left')),
      preventDefault: true,
      exposeAs: 'homeGoal',
    },
    {
      key: 'ArrowRight',
      action: () => openGoalDialog(getTeamForSide('right')),
      preventDefault: true,
      exposeAs: 'awayGoal',
    },
    {
      code: 'KeyD',
      action: () => openGoalDialog(getTeamForSide('right')),
      preventDefault: true,
      exposeAs: 'awayGoal',
    },
    // Penalties
    {
      code: 'KeyP',
      action: () => openPenaltyDialog(getTeamForSide('left')),
      preventDefault: true,
      exposeAs: 'leftPenalty',
    },
    {
      code: 'KeyP',
      shiftKey: true,
      action: () => openPenaltyDialog(getTeamForSide('right')),
      preventDefault: true,
      exposeAs: 'rightPenalty',
    },
  ];

  const describeBinding = (spec: ShortcutSpec): string | null => {
    const parts: string[] = [];
    if (spec.ctrlKey) parts.push('Ctrl');
    if (spec.altKey) parts.push('Alt');
    if (spec.shiftKey) parts.push('Shift');
    if (spec.metaKey) parts.push('Meta');

    const fromKey = spec.key ?? '';
    const fromCode = spec.code ?? '';

    let keyLabel = '';
    if (fromKey) {
      keyLabel = fromKey.length === 1 ? fromKey.toLowerCase() : fromKey;
    } else if (fromCode.startsWith('Key')) {
      keyLabel = fromCode.slice(3).toLowerCase();
    } else if (fromCode.startsWith('Digit')) {
      keyLabel = fromCode.slice(5);
    } else if (fromCode) {
      keyLabel = fromCode;
    }

    if (!keyLabel) return null;
    parts.push(keyLabel);
    return parts.join('+');
  };

  Object.keys(latestBindings).forEach((key) => delete latestBindings[key]);

  const recordBinding = (spec: ShortcutSpec) => {
    if (!spec.exposeAs) return;
    const binding = describeBinding(spec);
    if (!binding) return;
    const list = latestBindings[spec.exposeAs] ?? (latestBindings[spec.exposeAs] = []);
    if (!list.includes(binding)) {
      list.push(binding);
    }
  };

  shortcuts.forEach(recordBinding);
  updateShortcutTestHooks();

  document.addEventListener(
    'keydown',
    (event) => {
      if (isTypingContext(event.target)) return;
      for (const shortcut of shortcuts) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.action();
          break;
        }
      }
    },
    true
  );
};

export default initKeyboardShortcuts;
updateShortcutTestHooks();
