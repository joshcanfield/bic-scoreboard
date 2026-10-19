import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createUiModeController, UI_MODE_STORAGE_KEY, type UiMode } from './ui-modes';

describe('UiModeController', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute('data-ui-mode');
    document.body.innerHTML = `
      <div id="header-ui-modes">
        <button id="mode-standard-btn" data-ui-mode="standard">Standard</button>
        <button id="mode-big-buttons-btn" data-ui-mode="big-buttons">Big Buttons</button>
        <button id="mode-compact-btn" data-ui-mode="compact">Compact</button>
      </div>
    `;
  });

  it('defaults to standard mode when localStorage is empty', () => {
    const controller = createUiModeController();
    expect(controller.getMode()).toBe('standard');
    expect(document.body.dataset.uiMode).toBe('standard');
    const stdBtn = document.getElementById('mode-standard-btn');
    expect(stdBtn?.classList.contains('active')).toBe(true);
    expect(stdBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('restores stored mode from localStorage', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'big-buttons');
    const controller = createUiModeController();
    expect(controller.getMode()).toBe('big-buttons');
    expect(document.body.dataset.uiMode).toBe('big-buttons');
    const bigBtn = document.getElementById('mode-big-buttons-btn');
    expect(bigBtn?.classList.contains('active')).toBe(true);
    expect(bigBtn?.getAttribute('aria-pressed')).toBe('true');
    const stdBtn = document.getElementById('mode-standard-btn');
    expect(stdBtn?.classList.contains('active')).toBe(false);
    expect(stdBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches mode when setMode is called and updates DOM and storage', () => {
    const controller = createUiModeController();
    controller.setMode('compact');

    expect(controller.getMode()).toBe('compact');
    expect(document.body.dataset.uiMode).toBe('compact');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('compact');

    const compactBtn = document.getElementById('mode-compact-btn');
    const stdBtn = document.getElementById('mode-standard-btn');
    expect(compactBtn?.classList.contains('active')).toBe(true);
    expect(compactBtn?.getAttribute('aria-pressed')).toBe('true');
    expect(stdBtn?.classList.contains('active')).toBe(false);
    expect(stdBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('notifies subscribers on mode change', () => {
    const controller = createUiModeController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.setMode('big-buttons');
    expect(listener).toHaveBeenCalledWith('big-buttons');

    unsubscribe();
    controller.setMode('standard');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cycles through modes in sequence', () => {
    const controller = createUiModeController();
    expect(controller.getMode()).toBe('standard');

    expect(controller.cycleMode()).toBe('big-buttons');
    expect(controller.getMode()).toBe('big-buttons');

    expect(controller.cycleMode()).toBe('compact');
    expect(controller.getMode()).toBe('compact');

    expect(controller.cycleMode()).toBe('standard');
    expect(controller.getMode()).toBe('standard');
  });

  it('wires up click events on mode buttons', () => {
    const controller = createUiModeController();
    const bigBtn = document.getElementById('mode-big-buttons-btn')!;

    bigBtn.click();
    expect(controller.getMode()).toBe('big-buttons');
    expect(document.body.dataset.uiMode).toBe('big-buttons');
  });

  it('ignores invalid stored mode and falls back to standard', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'invalid-mode' as UiMode);
    const controller = createUiModeController();
    expect(controller.getMode()).toBe('standard');
    expect(document.body.dataset.uiMode).toBe('standard');
  });

  it('does not prevent default on clicks outside mode buttons', () => {
    createUiModeController();
    const link = document.createElement('a');
    link.href = '#';
    document.body.appendChild(link);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const notCancelled = link.dispatchEvent(event);
    expect(notCancelled).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
});
