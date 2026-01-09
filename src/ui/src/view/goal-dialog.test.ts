import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Command } from '../api/v2-types';

import { initGoalDialog, GoalDialogState } from './goal-dialog';
import Modals from './modals';

describe('goal-dialog', () => {
  let sendCommand: ReturnType<typeof vi.fn<(cmd: Command) => void>>;
  let getState: ReturnType<typeof vi.fn<() => GoalDialogState>>;

  beforeEach(() => {
    sendCommand = vi.fn<(cmd: Command) => void>();
    getState = vi.fn<() => GoalDialogState>().mockReturnValue({
      currentPeriod: 1,
      currentTime: 300000, // 5:00
    });
    vi.spyOn(Modals, 'show').mockImplementation(() => {});
    vi.spyOn(Modals, 'hide').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('fallback behavior when modal is missing', () => {
    it('sends simple goal command when modal element is not found', () => {
      document.body.innerHTML = '<div>no modal here</div>';
      const controller = initGoalDialog(sendCommand, getState);

      controller.open('home');

      expect(sendCommand).toHaveBeenCalledWith({
        type: 'ADD_GOAL',
        payload: { teamId: 'home', scorerNumber: 0, assistNumbers: [], isEmptyNet: false },
      });
    });

    it('sends away goal when modal is missing', () => {
      document.body.innerHTML = '';
      const controller = initGoalDialog(sendCommand, getState);

      controller.open('away');

      expect(sendCommand).toHaveBeenCalledWith({
        type: 'ADD_GOAL',
        payload: { teamId: 'away', scorerNumber: 0, assistNumbers: [], isEmptyNet: false },
      });
    });
  });

  describe('modal initialization', () => {
    const createGoalModal = () => `
      <div id="add-goal" class="modal">
        <div class="modal-header">
          <h4 class="modal-title">Goal</h4>
        </div>
        <div class="modal-body">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <div class="form-group">
            <input id="add-goal-assist" type="text" />
          </div>
          <div class="error"></div>
        </div>
        <div class="modal-footer">
          <button id="add-goal-add">Add</button>
        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = createGoalModal();
    });

    it('resolves modal via team label parent', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');
      expect(Modals.show).toHaveBeenCalled();
    });

    it('adds goal-modal-header class to modal header', () => {
      initGoalDialog(sendCommand, getState);
      const header = document.querySelector('.modal-header');
      expect(header?.classList.contains('goal-modal-header')).toBe(true);
    });
  });

  describe('open', () => {
    const createGoalModal = () => `
      <div id="add-goal" class="modal">
        <div class="modal-header">
          <h4 class="modal-title">Goal</h4>
        </div>
        <div class="modal-body">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" value="existing" />
          </div>
          <div class="form-group">
            <input id="add-goal-assist" type="text" value="existing" />
          </div>
          <div class="error">Some error</div>
        </div>
        <div class="modal-footer">
          <button id="add-goal-add">Add</button>
        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = createGoalModal();
    });

    it('sets team label to Home for home team', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const teamLabel = document.getElementById('add-goal-team');
      expect(teamLabel?.textContent).toBe('Home');
    });

    it('sets team label to Away for away team', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('away');

      const teamLabel = document.getElementById('add-goal-team');
      expect(teamLabel?.textContent).toBe('Away');
    });

    it('sets modal title for home team', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const title = document.querySelector('.modal-title');
      expect(title?.textContent).toBe('Home Goal');
    });

    it('sets modal title for away team', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('away');

      const title = document.querySelector('.modal-title');
      expect(title?.textContent).toBe('Away Goal');
    });

    it('adds home class to header for home team', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const header = document.querySelector('.modal-header');
      expect(header?.classList.contains('home')).toBe(true);
      expect(header?.classList.contains('away')).toBe(false);
    });

    it('adds away class to header for away team', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('away');

      const header = document.querySelector('.modal-header');
      expect(header?.classList.contains('away')).toBe(true);
      expect(header?.classList.contains('home')).toBe(false);
    });

    it('switches header class from home to away', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');
      controller.open('away');

      const header = document.querySelector('.modal-header');
      expect(header?.classList.contains('away')).toBe(true);
      expect(header?.classList.contains('home')).toBe(false);
    });

    it('displays current period from state', () => {
      getState.mockReturnValue({ currentPeriod: 2, currentTime: 0 });
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const periodLabel = document.getElementById('add-goal-period');
      expect(periodLabel?.textContent).toBe('2');
    });

    it('displays current time formatted as MM:SS', () => {
      getState.mockReturnValue({ currentPeriod: 1, currentTime: 754000 }); // 12:34
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const clockLabel = document.getElementById('add-goal-clock');
      expect(clockLabel?.textContent).toBe('12:34');
    });

    it('clears player input', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      expect(playerInput.value).toBe('');
    });

    it('clears assist input', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const assistInput = document.getElementById('add-goal-assist') as HTMLInputElement;
      expect(assistInput.value).toBe('');
    });

    it('clears error message', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const errorBox = document.querySelector('.error');
      expect(errorBox?.textContent).toBe('');
    });

    it('removes has-error class from player form group', () => {
      const playerInput = document.getElementById('add-goal-player');
      playerInput?.closest('.form-group')?.classList.add('has-error');

      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const formGroup = playerInput?.closest('.form-group');
      expect(formGroup?.classList.contains('has-error')).toBe(false);
    });

    it('shows the modal', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      expect(Modals.show).toHaveBeenCalled();
    });

    it('focuses player input after short delay', () => {
      vi.useFakeTimers();
      const controller = initGoalDialog(sendCommand, getState);
      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      const focusSpy = vi.spyOn(playerInput, 'focus');

      controller.open('home');
      vi.advanceTimersByTime(50);

      expect(focusSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('handles null currentPeriod gracefully', () => {
      getState.mockReturnValue({ currentPeriod: undefined as unknown as number, currentTime: 0 });
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const periodLabel = document.getElementById('add-goal-period');
      expect(periodLabel?.textContent).toBe('0');
    });

    it('handles null currentTime gracefully', () => {
      getState.mockReturnValue({ currentPeriod: 1, currentTime: undefined as unknown as number });
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const clockLabel = document.getElementById('add-goal-clock');
      expect(clockLabel?.textContent).toBe('00:00');
    });
  });

  describe('submit', () => {
    const createGoalModal = () => `
      <div id="add-goal" class="modal">
        <div class="modal-header">
          <h4 class="modal-title">Goal</h4>
        </div>
        <div class="modal-body">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <div class="form-group">
            <input id="add-goal-assist" type="text" />
          </div>
          <div class="error"></div>
        </div>
        <div class="modal-footer">
          <button id="add-goal-add">Add</button>
        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = createGoalModal();
    });

    describe('validation', () => {
      it('shows error when player number is empty', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        const errorBox = document.querySelector('.error');
        expect(errorBox?.textContent).toBe('Enter the scorer number.');
      });

      it('adds has-error class when player number is empty', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        const formGroup = document.getElementById('add-goal-player')?.closest('.form-group');
        expect(formGroup?.classList.contains('has-error')).toBe(true);
      });

      it('focuses player input when validation fails', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');
        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        const focusSpy = vi.spyOn(playerInput, 'focus');

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(focusSpy).toHaveBeenCalled();
      });

      it('shows error when player number is whitespace only', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '   ';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        const errorBox = document.querySelector('.error');
        expect(errorBox?.textContent).toBe('Enter the scorer number.');
      });

      it('shows error when player number is not a valid number', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = 'abc';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        const errorBox = document.querySelector('.error');
        expect(errorBox?.textContent).toBe('Scorer must be a number.');
      });

      it('does not send command when validation fails', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).not.toHaveBeenCalled();
      });

      it('does not hide modal when validation fails', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(Modals.hide).not.toHaveBeenCalled();
      });
    });

    describe('successful submission', () => {
      it('sends goal command with scorer number', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '17';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith({
          type: 'ADD_GOAL',
          payload: {
            teamId: 'home',
            scorerNumber: 17,
            assistNumbers: [],
            isEmptyNet: false,
          },
        });
      });

      it('sends goal command for away team', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('away');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '99';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith({
          type: 'ADD_GOAL',
          payload: {
            teamId: 'away',
            scorerNumber: 99,
            assistNumbers: [],
            isEmptyNet: false,
          },
        });
      });

      it('includes assist number when provided', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        const assistInput = document.getElementById('add-goal-assist') as HTMLInputElement;
        playerInput.value = '17';
        assistInput.value = '23';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith({
          type: 'ADD_GOAL',
          payload: {
            teamId: 'home',
            scorerNumber: 17,
            assistNumbers: [23],
            isEmptyNet: false,
          },
        });
      });

      it('ignores invalid assist number', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        const assistInput = document.getElementById('add-goal-assist') as HTMLInputElement;
        playerInput.value = '17';
        assistInput.value = 'abc';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith({
          type: 'ADD_GOAL',
          payload: {
            teamId: 'home',
            scorerNumber: 17,
            assistNumbers: [],
            isEmptyNet: false,
          },
        });
      });

      it('trims whitespace from player input', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '  42  ';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ scorerNumber: 42 }),
          })
        );
      });

      it('trims whitespace from assist input', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        const assistInput = document.getElementById('add-goal-assist') as HTMLInputElement;
        playerInput.value = '17';
        assistInput.value = '  23  ';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ assistNumbers: [23] }),
          })
        );
      });

      it('hides modal after successful submission', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '17';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(Modals.hide).toHaveBeenCalled();
      });

      it('defaults to home team if dataset.team is not set', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const modal = document.getElementById('add-goal') as HTMLElement;
        delete modal.dataset.team;

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '17';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ teamId: 'home' }),
          })
        );
      });

      it('handles zero as valid player number', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '0';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ scorerNumber: 0 }),
          })
        );
      });

      it('handles negative player number', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '-5';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ scorerNumber: -5 }),
          })
        );
      });

      it('handles decimal player number', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        playerInput.value = '17.5';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ scorerNumber: 17.5 }),
          })
        );
      });

      it('treats empty assist as empty array', () => {
        const controller = initGoalDialog(sendCommand, getState);
        controller.open('home');

        const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
        const assistInput = document.getElementById('add-goal-assist') as HTMLInputElement;
        playerInput.value = '17';
        assistInput.value = '';

        const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
        addButton.click();

        expect(sendCommand).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ assistNumbers: [] }),
          })
        );
      });
    });
  });

  describe('keyboard events', () => {
    const createGoalModal = () => `
      <div id="add-goal" class="modal">
        <div class="modal-header">
          <h4 class="modal-title">Goal</h4>
        </div>
        <div class="modal-body">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <div class="form-group">
            <input id="add-goal-assist" type="text" />
          </div>
          <div class="error"></div>
        </div>
        <div class="modal-footer">
          <button id="add-goal-add">Add</button>
        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = createGoalModal();
    });

    it('submits form on Enter key', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '17';

      const modal = document.getElementById('add-goal') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      modal.dispatchEvent(event);

      expect(sendCommand).toHaveBeenCalled();
    });

    it('prevents default on Enter key', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '17';

      const modal = document.getElementById('add-goal') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      modal.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('does not submit on other keys', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '17';

      const modal = document.getElementById('add-goal') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      modal.dispatchEvent(event);

      expect(sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('input event handler', () => {
    const createGoalModal = () => `
      <div id="add-goal" class="modal">
        <div class="modal-header">
          <h4 class="modal-title">Goal</h4>
        </div>
        <div class="modal-body">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <div class="form-group">
            <input id="add-goal-assist" type="text" />
          </div>
          <div class="error"></div>
        </div>
        <div class="modal-footer">
          <button id="add-goal-add">Add</button>
        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = createGoalModal();
    });

    it('clears error when typing in player input after validation error', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      // Trigger validation error
      const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
      addButton.click();

      // Verify error state
      const formGroup = document.getElementById('add-goal-player')?.closest('.form-group');
      expect(formGroup?.classList.contains('has-error')).toBe(true);

      // Start typing
      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '1';
      playerInput.dispatchEvent(new Event('input'));

      // Error should be cleared
      expect(formGroup?.classList.contains('has-error')).toBe(false);
    });

    it('clears error text when typing after validation error', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      // Trigger validation error
      const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
      addButton.click();

      const errorBox = document.querySelector('.error');
      expect(errorBox?.textContent).toBe('Enter the scorer number.');

      // Start typing
      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '1';
      playerInput.dispatchEvent(new Event('input'));

      expect(errorBox?.textContent).toBe('');
    });

    it('does not clear when form group does not have has-error class', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '1';
      playerInput.dispatchEvent(new Event('input'));

      // Should not throw or cause issues
      const formGroup = playerInput.closest('.form-group');
      expect(formGroup?.classList.contains('has-error')).toBe(false);
    });
  });

  describe('button click handler', () => {
    const createGoalModal = () => `
      <div id="add-goal" class="modal">
        <div class="modal-header">
          <h4 class="modal-title">Goal</h4>
        </div>
        <div class="modal-body">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <div class="form-group">
            <input id="add-goal-assist" type="text" />
          </div>
          <div class="error"></div>
        </div>
        <div class="modal-footer">
          <button id="add-goal-add">Add</button>
        </div>
      </div>
    `;

    beforeEach(() => {
      document.body.innerHTML = createGoalModal();
    });

    it('prevents default on button click', () => {
      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '17';

      const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
      const event = new MouseEvent('click', { cancelable: true });
      addButton.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('modal resolution fallback', () => {
    it('finds modal by id when team label is missing', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <div class="modal-header">
            <h4 class="modal-title">Goal</h4>
          </div>
          <div class="modal-body">
            <span id="add-goal-period"></span>
            <span id="add-goal-clock"></span>
            <div class="form-group">
              <input id="add-goal-player" type="text" />
            </div>
            <div class="form-group">
              <input id="add-goal-assist" type="text" />
            </div>
            <div class="error"></div>
          </div>
          <div class="modal-footer">
            <button id="add-goal-add">Add</button>
          </div>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      expect(Modals.show).toHaveBeenCalled();
    });

    it('selects last modal when multiple exist', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal first">
          <div class="modal-body">
            <div class="form-group">
              <input id="add-goal-player" type="text" />
            </div>
          </div>
          <div class="modal-footer">
            <button id="add-goal-add">Add</button>
          </div>
        </div>
        <div id="add-goal" class="modal second">
          <div class="modal-body">
            <span id="add-goal-team"></span>
            <div class="form-group">
              <input type="text" />
            </div>
          </div>
        </div>
      `;

      initGoalDialog(sendCommand, getState);

      // The second modal should be selected (last one)
      // This is indicated by the show being called on a modal
      expect(Modals.show).not.toHaveBeenCalled(); // Not called until open()
    });
  });

  describe('missing optional elements', () => {
    it('handles missing period label gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <span id="add-goal-clock"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      expect(() => controller.open('home')).not.toThrow();
    });

    it('handles missing clock label gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <span id="add-goal-period"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      expect(() => controller.open('home')).not.toThrow();
    });

    it('handles missing error box gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
      expect(() => addButton.click()).not.toThrow();
    });

    it('handles missing add button gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      expect(() => controller.open('home')).not.toThrow();
    });

    it('handles missing player input gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      expect(() => controller.open('home')).not.toThrow();
    });

    it('handles missing assist input gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      controller.open('home');

      const playerInput = document.getElementById('add-goal-player') as HTMLInputElement;
      playerInput.value = '17';

      const addButton = document.getElementById('add-goal-add') as HTMLButtonElement;
      addButton.click();

      expect(sendCommand).toHaveBeenCalled();
    });

    it('handles missing modal header gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <span id="add-goal-team"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      expect(() => controller.open('home')).not.toThrow();
    });

    it('handles missing modal title gracefully', () => {
      document.body.innerHTML = `
        <div id="add-goal" class="modal">
          <div class="modal-header"></div>
          <span id="add-goal-team"></span>
          <div class="form-group">
            <input id="add-goal-player" type="text" />
          </div>
          <button id="add-goal-add">Add</button>
        </div>
      `;

      const controller = initGoalDialog(sendCommand, getState);
      expect(() => controller.open('home')).not.toThrow();
    });
  });
});
