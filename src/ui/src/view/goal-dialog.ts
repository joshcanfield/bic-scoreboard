import type { Command, Penalty } from '../api/v2-types';
import { millisToMinSec, pad } from '../utils/time';

import Modals from './modals';

export interface GoalDialogState {
  currentPeriod: number;
  currentTime: number;
  homePenalties?: Penalty[];
  awayPenalties?: Penalty[];
}

type TeamCode = 'home' | 'away';

export interface GoalDialogController {
  open(team: TeamCode): void;
}

type GoalCommand = Command;
type CommandSender = (command: GoalCommand) => void;

const formatClock = (millis: number): string => {
  const { minutes, seconds } = millisToMinSec(millis);
  return `${pad(minutes, 2)}:${pad(seconds, 2)}`;
};

export const initGoalDialog = (
  sendCommand: CommandSender,
  getState: () => GoalDialogState
): GoalDialogController => {
  const resolveGoalModal = (): (HTMLElement & { __trigger?: HTMLElement }) | null => {
    const teamLabel = document.querySelector<HTMLElement>('#add-goal-team');
    if (teamLabel) {
      const target = teamLabel.closest<HTMLElement>('#add-goal');
      if (target) {
        return target as HTMLElement & { __trigger?: HTMLElement };
      }
    }

    const candidates = document.querySelectorAll<HTMLElement>('#add-goal');
    if (candidates.length > 0) {
      return candidates[candidates.length - 1] as HTMLElement & { __trigger?: HTMLElement };
    }

    return null;
  };

  const modal = resolveGoalModal();
  if (!modal) {
    // Fallback: if modal is missing, fall back to simple goal increment.
    return {
      open(team: TeamCode) {
        sendCommand({
          type: 'ADD_GOAL',
          payload: { teamId: team, scorerNumber: 0, assistNumbers: [], isEmptyNet: false },
        });
      },
    };
  }

  const playerInput = modal.querySelector<HTMLInputElement>('#add-goal-player');
  const assist1Input = modal.querySelector<HTMLInputElement>('#add-goal-assist1');
  const assist2Input = modal.querySelector<HTMLInputElement>('#add-goal-assist2');
  // Legacy fallback for old single assist field
  const legacyAssistInput = modal.querySelector<HTMLInputElement>('#add-goal-assist');
  const periodLabel = modal.querySelector<HTMLElement>('#add-goal-period');
  const clockLabel = modal.querySelector<HTMLElement>('#add-goal-clock');
  const teamLabel = modal.querySelector<HTMLElement>('#add-goal-team');
  const errorBox = modal.querySelector<HTMLElement>('.error');
  const addButton = modal.querySelector<HTMLButtonElement>('#add-goal-add');
  const goalHeader = modal.querySelector<HTMLElement>('.modal-header');
  const penaltyReleaseGroup = modal.querySelector<HTMLElement>('#add-goal-penalty-release-group');
  const penaltyReleaseSelect = modal.querySelector<HTMLSelectElement>('#add-goal-release-penalty');
  goalHeader?.classList.add('goal-modal-header');

  const clearErrors = () => {
    errorBox && (errorBox.textContent = '');
    playerInput?.closest('.form-group')?.classList.remove('has-error');
  };

  const setTeam = (team: TeamCode) => {
    modal.dataset.team = team;
    if (teamLabel) teamLabel.textContent = team === 'home' ? 'Home' : 'Away';
    const title = modal.querySelector<HTMLElement>('.modal-title');
    if (title) title.textContent = `${team === 'home' ? 'Home' : 'Away'} Goal`;
    if (goalHeader) {
      goalHeader.classList.add('goal-modal-header');
      goalHeader.classList.remove('home', 'away');
      goalHeader.classList.add(team === 'home' ? 'home' : 'away');
    }
  };

  const open = (team: TeamCode) => {
    const state = getState();
    setTeam(team);
    clearErrors();
    if (playerInput) playerInput.value = '';
    if (assist1Input) assist1Input.value = '';
    if (assist2Input) assist2Input.value = '';
    if (legacyAssistInput) legacyAssistInput.value = '';
    if (periodLabel) periodLabel.textContent = String(state.currentPeriod ?? 0);
    if (clockLabel) clockLabel.textContent = formatClock(state.currentTime ?? 0);

    // Populate penalty release dropdown with opposing team's 2-minute minors
    const opposingTeam = team === 'home' ? 'away' : 'home';
    const opposingPenalties = opposingTeam === 'home' ? state.homePenalties : state.awayPenalties;
    const releasablePenalties = (opposingPenalties || []).filter(
      (p) => p.durationMillis === 2 * 60 * 1000 && p.timeRemainingMillis > 0
    );

    if (penaltyReleaseSelect && penaltyReleaseGroup) {
      penaltyReleaseSelect.innerHTML = '<option value="">-- None --</option>';
      if (releasablePenalties.length > 0) {
        releasablePenalties.forEach((p) => {
          const option = document.createElement('option');
          option.value = p.penaltyId;
          const timeRemaining = formatClock(p.timeRemainingMillis);
          option.textContent = `#${p.playerNumber} - ${timeRemaining} remaining`;
          penaltyReleaseSelect.appendChild(option);
        });
        penaltyReleaseGroup.style.display = '';
      } else {
        penaltyReleaseGroup.style.display = 'none';
      }
    }

    Modals.show(modal);
    window.setTimeout(() => playerInput?.focus(), 50);
  };

  const submit = () => {
    clearErrors();
    const team = (modal.dataset.team as TeamCode) || 'home';
    const playerValue = (playerInput?.value || '').trim();
    // Scorer is optional - 0 means unspecified (scoreboard only tracks count)
    let scorerNumber = 0;
    if (playerValue) {
      const parsed = Number(playerValue);
      if (!Number.isFinite(parsed)) {
        playerInput?.closest('.form-group')?.classList.add('has-error');
        if (errorBox) errorBox.textContent = 'Scorer must be a number.';
        playerInput?.focus();
        return;
      }
      scorerNumber = parsed;
    }
    // Parse assists - support new dual fields or legacy single field
    const assistNumbers: number[] = [];
    const assist1Value = (assist1Input?.value || legacyAssistInput?.value || '').trim();
    const assist2Value = (assist2Input?.value || '').trim();
    if (assist1Value) {
      const parsed = Number(assist1Value);
      if (Number.isFinite(parsed)) assistNumbers.push(parsed);
    }
    if (assist2Value) {
      const parsed = Number(assist2Value);
      if (Number.isFinite(parsed)) assistNumbers.push(parsed);
    }

    // Get selected penalty to release (if any)
    const releasePenaltyId = penaltyReleaseSelect?.value || null;

    sendCommand({
      type: 'ADD_GOAL',
      payload: {
        teamId: team,
        scorerNumber,
        assistNumbers,
        isEmptyNet: false,
        releasePenaltyId,
      },
    });
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
