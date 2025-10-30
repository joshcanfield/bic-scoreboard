import { millisToMinSec, pad } from '../utils/time';
import type { GoalCommandPayload, ServerActions, TeamCode } from '../transport/server';
import Modals from './modals';

export interface GoalDialogState {
  currentPeriod: number;
  currentTime: number;
}

export interface GoalDialogController {
  open(team: TeamCode): void;
}

const formatClock = (millis: number): string => {
  const { minutes, seconds } = millisToMinSec(millis);
  return `${pad(minutes, 2)}:${pad(seconds, 2)}`;
};

export const initGoalDialog = (
  server: ServerActions,
  getState: () => GoalDialogState
): GoalDialogController => {
  const modal = document.getElementById('add-goal') as (HTMLElement & { __trigger?: HTMLElement }) | null;
  if (!modal) {
    // Fallback: if modal is missing, fall back to simple goal increment.
    return {
      open(team: TeamCode) {
        const payload: GoalCommandPayload = { team };
        server.goal(payload);
      },
    };
  }

  const playerInput = modal.querySelector<HTMLInputElement>('#add-goal-player');
  const assistInput = modal.querySelector<HTMLInputElement>('#add-goal-assist');
  const periodLabel = modal.querySelector<HTMLElement>('#add-goal-period');
  const clockLabel = modal.querySelector<HTMLElement>('#add-goal-clock');
  const teamLabel = modal.querySelector<HTMLElement>('#add-goal-team');
  const errorBox = modal.querySelector<HTMLElement>('.error');
  const addButton = modal.querySelector<HTMLButtonElement>('#add-goal-add');

  const clearErrors = () => {
    errorBox && (errorBox.textContent = '');
    playerInput?.closest('.form-group')?.classList.remove('has-error');
  };

  const setTeam = (team: TeamCode) => {
    modal.dataset.team = team;
    if (teamLabel) teamLabel.textContent = team === 'home' ? 'Home' : 'Away';
    const title = modal.querySelector<HTMLElement>('.modal-title');
    if (title) title.textContent = `${team === 'home' ? 'Home' : 'Away'} Goal`;
  };

  const open = (team: TeamCode) => {
    const state = getState();
    setTeam(team);
    clearErrors();
    if (playerInput) playerInput.value = '';
    if (assistInput) assistInput.value = '';
    if (periodLabel) periodLabel.textContent = String(state.currentPeriod ?? 0);
    if (clockLabel) clockLabel.textContent = formatClock(state.currentTime ?? 0);
    Modals.show(modal);
    window.setTimeout(() => playerInput?.focus(), 50);
  };

  const submit = () => {
    clearErrors();
    const team = (modal.dataset.team as TeamCode) || 'home';
    const playerValue = (playerInput?.value || '').trim();
    if (!playerValue) {
      playerInput?.closest('.form-group')?.classList.add('has-error');
      if (errorBox) errorBox.textContent = 'Enter the scorer number.';
      playerInput?.focus();
      return;
    }
    const assistValue = (assistInput?.value || '').trim();
    const payload: GoalCommandPayload = { team };
    if (playerValue) payload.player = playerValue;
    if (assistValue) payload.assist = assistValue;
    server.goal(payload);
    Modals.hide(modal);
  };

  addButton?.addEventListener('click', (event) => {
    event.preventDefault();
    submit();
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });

  playerInput?.addEventListener('input', () => {
    if (playerInput.closest('.form-group')?.classList.contains('has-error')) {
      clearErrors();
    }
  });

  return {
    open,
  };
};
