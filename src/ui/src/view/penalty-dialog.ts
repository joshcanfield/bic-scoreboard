/**
 * Penalty dialog management for adding penalties and handling 2+10 combinations.
 */

import type { Command } from '../api/v2-types';
import { parseClockMillis, millisToMinSec, formatClock, formatTime } from '../utils/time';

import Modals from './modals';

export interface PenaltyDialogState {
  currentPeriod: number;
  currentTime: number;
}

type TeamCode = 'home' | 'away';
type CommandSender = (command: Command) => void;

export const initPenaltyDialog = (sendCommand: CommandSender, getState: () => PenaltyDialogState) => {
  const on = (
    el: HTMLElement | Document,
    type: string,
    selector: string,
    handler: (e: Event, t: HTMLElement) => void
  ) => {
    el.addEventListener(type, (e) => {
      const target = (e.target as HTMLElement).closest(selector);
      if (target && el.contains(target)) {
        handler(e, target as HTMLElement);
      }
    });
  };

  const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
    document.querySelector<T>(sel);

  const $$ = (sel: string, root: HTMLElement): HTMLElement[] =>
    Array.from(root.querySelectorAll<HTMLElement>(sel));

  // Penalty dialog open
  on(document, 'click', 'a[href="#add-penalty"][data-toggle="modal"]', (e, t) => {
    const team = t.dataset.team || 'home';
    const dlg = $('#add-penalty');
    if (!dlg) return;
    dlg.dataset.team = team;
    const friendlyTeam = team === 'home' ? 'Home' : 'Away';
    const titleEl = dlg.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = `${friendlyTeam} Penalty`;
    const header = dlg.querySelector<HTMLElement>('.modal-header');
    if (header) {
      header.classList.add('penalty-modal-header');
      header.classList.remove('home', 'away');
      header.classList.add(team === 'home' ? 'home' : 'away');
    }
    const state = getState();
    const { minutes, seconds } = millisToMinSec(state.currentTime);
    const offIceInput = $('#add-penalty-off_ice') as HTMLInputElement | null;
    if (offIceInput) offIceInput.value = formatClock(minutes, seconds);
    // Default penalty duration to 2 minutes on open
    const timeInput = $('#add-penalty-time') as HTMLInputElement | null;
    if (timeInput) timeInput.value = '2:00';
    const servingInput = $('#add-penalty-serving') as HTMLInputElement | null;
    if (servingInput) servingInput.value = '';
    const playerInput = $('#add-penalty-player') as HTMLInputElement | null;
    if (playerInput) playerInput.value = '';
    const groups = $$(`.modal-body .form-group`, dlg);
    groups.forEach((g) => g.classList.remove('has-error'));
    window.setTimeout(() => {
      playerInput?.focus();
    }, 50);
  });

  // Add penalty submit
  const addButton = $('#add-penalty-add');
  if (addButton) {
    addButton.addEventListener('click', () => {
      const dlg = $('#add-penalty');
      if (!dlg) return;
      const team = (dlg.dataset.team as TeamCode) || 'home';
      const header = dlg.querySelector<HTMLElement>('.modal-header');
      if (header) {
        header.classList.add('penalty-modal-header');
        header.classList.remove('home', 'away');
        header.classList.add(team === 'home' ? 'home' : 'away');
      }
      const playerField = $('#add-penalty-player') as HTMLInputElement | null;
      const servingField = $('#add-penalty-serving') as HTMLInputElement | null;
      const timeField = $('#add-penalty-time') as HTMLInputElement | null;
      const groups = $$(`.modal-body .form-group`, dlg);
      groups.forEach((g) => g.classList.remove('has-error'));

      let error = false;
      const playerValue = (playerField?.value || '').trim();
      const playerNumber = Number(playerValue);
      if (!playerValue || !Number.isFinite(playerNumber)) {
        playerField?.closest('.form-group')?.classList.add('has-error');
        error = true;
      }
      const timeValue = (timeField?.value || '').trim();
      const durationMillis = parseClockMillis(timeValue);
      if (durationMillis == null) {
        timeField?.closest('.form-group')?.classList.add('has-error');
        error = true;
      }
      if (error || durationMillis == null) return;
      const durationMinutes = Math.max(1, Math.ceil(durationMillis / 60_000));
      let servingNumber = Number((servingField?.value || '').trim());
      if (!Number.isFinite(servingNumber)) {
        servingNumber = playerNumber;
      }
      sendCommand({
        type: 'ADD_PENALTY',
        payload: {
          teamId: team,
          playerNumber,
          servingPlayerNumber: servingNumber,
          durationMinutes,
        },
      });
      Modals.hide(dlg);
    });
  }

  // Add 2+10 (minor + misconduct) helper
  const add2plus10 = () => {
    const dlg = $('#add-penalty');
    if (!dlg) return;
    const team = (dlg.dataset.team as TeamCode) || 'home';
    const playerField = $('#add-penalty-player') as HTMLInputElement | null;
    const servingField = $('#add-penalty-serving') as HTMLInputElement | null;
    const groups = $$(`.modal-body .form-group`, dlg);
    groups.forEach((g) => g.classList.remove('has-error'));

    let error = false;
    const playerValue = (playerField?.value || '').trim();
    const playerNumber = Number(playerValue);
    if (!playerValue || !Number.isFinite(playerNumber)) {
      playerField?.closest('.form-group')?.classList.add('has-error');
      error = true;
    }
    const servingValue = (servingField?.value || '').trim();
    if (!servingValue) {
      servingField?.closest('.form-group')?.classList.add('has-error');
      error = true;
    }
    if (error) return;

    const servingNumber = Number(servingValue);
    const teamPlayer = Number.isFinite(servingNumber) ? servingNumber : playerNumber;
    const sendPenalty = (durationMinutes: number, serving: number) => {
      sendCommand({
        type: 'ADD_PENALTY',
        payload: {
          teamId: team,
          playerNumber,
          servingPlayerNumber: serving,
          durationMinutes,
        },
      });
    };
    sendPenalty(2, teamPlayer);
    sendPenalty(10, playerNumber);
    Modals.hide(dlg);
  };

  const btn2plus10 = document.getElementById('add-penalty-2plus10');
  if (btn2plus10) {
    btn2plus10.addEventListener('click', (e) => {
      e.preventDefault();
      add2plus10();
    });
  }
};

export const initPenaltyDetailsPopup = () => {
  const on = (
    el: HTMLElement | Document,
    type: string,
    selector: string,
    handler: (e: Event, t: HTMLElement) => void
  ) => {
    el.addEventListener(type, (e) => {
      const target = (e.target as HTMLElement).closest(selector);
      if (target && el.contains(target)) {
        handler(e, target as HTMLElement);
      }
    });
  };

  // Penalty details popup (delegated)
  on(document, 'click', 'a[data-action="penalty-details"]', (e, t) => {
    e.preventDefault();
    const dlg = document.getElementById('penalty-details');
    if (!dlg) return;
    const set = (sel: string, val: string) => {
      const el = sel ? dlg.querySelector(sel) : null;
      if (el) el.textContent = String(val || '');
    };
    set('#pd-team', (t.dataset.team || '').toUpperCase());
    set('#pd-period', t.dataset.period || '—');
    set('#pd-player', t.dataset.player || '—');
    set('#pd-duration', t.dataset.duration ? formatTime(Number(t.dataset.duration)) : '—');
    set('#pd-off', t.dataset.off || '—');
    set('#pd-start', t.dataset.start || '—');
    set('#pd-remaining', t.dataset.remaining ? formatTime(Number(t.dataset.remaining)) : '—');
    Modals.show(dlg);
  });
};
