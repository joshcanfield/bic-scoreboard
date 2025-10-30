/**
 * Clock setting dialog management with preset times and custom input.
 */

import api from '../api/http';
import { parseClockMillis, millisToMinSec, formatClock } from '../utils/time';

import Modals from './modals';

export const initClockSettingsDialog = (currentTimeMillis: () => number) => {
  const setClockDialog = document.getElementById('set-clock');
  if (!setClockDialog) return;

  // Handle preset time buttons
  setClockDialog.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button.time') as HTMLButtonElement | null;
    if (!btn) return;
    const time = String(btn.dataset.time || '');
    const millis = parseClockMillis(time);
    if (millis == null) return;
    const errorEl = setClockDialog.querySelector('.error');
    api
      .put('', { time: millis })
      .then(() => {
        Modals.hide(setClockDialog);
        if (errorEl) errorEl.textContent = '';
      })
      .catch(() => {
        if (errorEl) errorEl.textContent = 'Failed to update the time';
      });
  });

  // Handle custom time save
  const saveCustomButton = document.getElementById('save-custom-time');
  if (saveCustomButton) {
    saveCustomButton.addEventListener('click', async () => {
      const customInput = document.getElementById('custom-time') as HTMLInputElement | null;
      if (!customInput) return;
      const custom = customInput.value;
      const millis = parseClockMillis(custom);
      const err = setClockDialog.querySelector('.error');
      if (millis == null) {
        if (err) err.textContent = 'Invalid time. Example 20:00';
        return;
      }
      try {
        await api.put('', { time: millis });
        Modals.hide(setClockDialog);
        if (err) err.textContent = '';
      } catch {
        if (err) err.textContent = 'Failed to update the time';
      }
    });
  }

  // When opening set-clock (via data-toggle), prefill value
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

  on(document, 'click', 'a[href="#set-clock"][data-toggle="modal"]', () => {
    const { minutes, seconds } = millisToMinSec(currentTimeMillis());
    const customInput = document.getElementById('custom-time') as HTMLInputElement | null;
    if (customInput) {
      customInput.value = formatClock(minutes, seconds);
    }
    const errorEl = setClockDialog.querySelector('.error');
    if (errorEl) errorEl.textContent = '';
  });
};
