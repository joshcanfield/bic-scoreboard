/**
 * Handles swapping Home/Away columns without mutating score data.
 * Mirrors legacy behavior by reordering the DOM and tracking layout state.
 */

type TeamKey = 'home' | 'away';

interface TeamSides {
  left: TeamKey;
  right: TeamKey;
}

const STORAGE_KEY = 'scoreboard.layout.leftTeam';

const readStoredLeft = (): TeamKey => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'away' ? 'away' : 'home';
  } catch (_) {
    return 'home';
  }
};

const persistLeft = (leftTeam: TeamKey) => {
  try {
    localStorage.setItem(STORAGE_KEY, leftTeam);
  } catch (_) {
    // Ignore storage errors (incognito, disabled storage, etc.)
  }
};

const applyDomOrder = (sides: TeamSides) => {
  const row = document.querySelector('.container > .row');
  const home = document.getElementById('home');
  const away = document.getElementById('away');
  const clock = document.getElementById('clock_box');
  if (!row || !home || !away || !clock) return;

  const leftEl = sides.left === 'home' ? home : away;
  const rightEl = sides.left === 'home' ? away : home;
  [leftEl, clock, rightEl].forEach((el) => {
    if (el && el.parentElement === row) {
      row.appendChild(el);
    }
  });
};

const updateBodyDataset = (sides: TeamSides) => {
  if (!document.body) return;
  document.body.dataset.homeSide = sides.left === 'home' ? 'left' : 'right';
  document.body.dataset.leftTeam = sides.left;
  document.body.dataset.rightTeam = sides.right;
};

const updateToggleButton = (button: HTMLButtonElement | null, sides: TeamSides) => {
  if (!button) return;
  const homeSide = sides.left === 'home' ? 'left' : 'right';
  const status =
    homeSide === 'left'
      ? 'Home currently on left. Swap sides.'
      : 'Home currently on right. Swap sides.';
  button.setAttribute('aria-pressed', homeSide === 'right' ? 'true' : 'false');
  button.setAttribute('aria-label', status);
  button.setAttribute('title', status);
};

const dispatchLayoutChanged = (sides: TeamSides) => {
  document.dispatchEvent(
    new CustomEvent('scoreboard:layout-changed', {
      detail: { ...sides },
    })
  );
};

const updateCssVariables = (sides: TeamSides) => {
  const root = document.documentElement;
  if (!root) return;

  const oldHomeColor = getComputedStyle(root).getPropertyValue('--home-color');
  const oldAwayColor = getComputedStyle(root).getPropertyValue('--away-color');

  root.style.setProperty(`--${sides.left}-color`, oldHomeColor);
  root.style.setProperty(`--${sides.right}-color`, oldAwayColor);
};

export const TeamLayout = (() => {
  let sides: TeamSides = { left: 'home', right: 'away' };
  let toggleButton: HTMLButtonElement | null = null;

  const apply = (leftTeam: TeamKey) => {
    const normalizedLeft: TeamKey = leftTeam === 'away' ? 'away' : 'home';
    if (sides.left !== normalizedLeft) {
      sides = {
        left: normalizedLeft,
        right: normalizedLeft === 'home' ? 'away' : 'home',
      };
      updateCssVariables(sides);
      applyDomOrder(sides);
      persistLeft(sides.left);
      updateBodyDataset(sides);
      updateToggleButton(toggleButton, sides);
      dispatchLayoutChanged(sides);
      return;
    }
    applyDomOrder(sides);
    updateBodyDataset(sides);
    updateToggleButton(toggleButton, sides);
  };

  const toggle = () => {
    apply(sides.right);
  };

  const init = () => {
    toggleButton = document.getElementById('swap-teams-btn') as HTMLButtonElement | null;
    if (toggleButton) {
      toggleButton.addEventListener('click', (event) => {
        event.preventDefault();
        toggle();
        toggleButton?.blur();
      });
    }
    apply(readStoredLeft());
  };

  const getTeamForSide = (side: 'left' | 'right'): TeamKey => {
    if (side === 'left' || side === 'right') return sides[side];
    return 'home';
  };

  const getSides = (): TeamSides => ({ ...sides });

  return { init, toggle, getTeamForSide, getSides };
})();

export default TeamLayout;
