import { TeamLayout } from './team-layout';

type TeamKey = 'home' | 'away';

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
}

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
    },
    {
      key: 'ArrowDown',
      ctrlKey: true,
      action: () => adjustPeriod('down'),
      preventDefault: true,
    },
    // Clock controls
    {
      key: 'ArrowUp',
      action: () => triggerButton('#clock-start'),
      preventDefault: true,
    },
    {
      code: 'KeyW',
      action: () => triggerButton('#clock-start'),
      preventDefault: true,
    },
    {
      key: 'ArrowDown',
      action: () => triggerButton('#clock-pause'),
      preventDefault: true,
    },
    {
      code: 'KeyS',
      action: () => triggerButton('#clock-pause'),
      preventDefault: true,
    },
    {
      code: 'Space',
      action: () => triggerButton('#clock-toggle'),
      preventDefault: true,
    },
    // Buzzer
    {
      code: 'KeyB',
      action: () => triggerButton('#buzzer'),
      preventDefault: true,
    },
    // Shots - left column
    {
      code: 'KeyQ',
      action: () => addShot(getTeamForSide('left')),
      preventDefault: true,
    },
    {
      code: 'KeyQ',
      shiftKey: true,
      action: () => undoShot(getTeamForSide('left')),
      preventDefault: true,
    },
    // Shots - right column
    {
      code: 'KeyE',
      action: () => addShot(getTeamForSide('right')),
      preventDefault: true,
    },
    {
      code: 'KeyE',
      shiftKey: true,
      action: () => undoShot(getTeamForSide('right')),
      preventDefault: true,
    },
    // Goals
    {
      key: 'ArrowLeft',
      action: () => openGoalDialog(getTeamForSide('left')),
      preventDefault: true,
    },
    {
      code: 'KeyA',
      action: () => openGoalDialog(getTeamForSide('left')),
      preventDefault: true,
    },
    {
      key: 'ArrowRight',
      action: () => openGoalDialog(getTeamForSide('right')),
      preventDefault: true,
    },
    {
      code: 'KeyD',
      action: () => openGoalDialog(getTeamForSide('right')),
      preventDefault: true,
    },
    // Penalties
    {
      code: 'KeyP',
      action: () => openPenaltyDialog(getTeamForSide('left')),
      preventDefault: true,
    },
    {
      code: 'KeyP',
      shiftKey: true,
      action: () => openPenaltyDialog(getTeamForSide('right')),
      preventDefault: true,
    },
  ];

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
