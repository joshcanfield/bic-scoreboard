import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../api/http';

import {
  defaultPortStepperState,
  initializeStepper,
  renderPortPills,
  reorderPorts,
  resetNotOnButton,
  resetPortDialog,
  setPortMessage,
  startNotOnCountdown,
  tryPortSelection
} from './ports';

vi.mock('../api/http', () => ({
  default: {
    post: vi.fn()
  }
}));

const getMockedApi = () => (apiClient as unknown as { post: ReturnType<typeof vi.fn> });

describe('port UI helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getMockedApi().post.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reorders ports to prioritize the current one', () => {
    expect(reorderPorts(['A', 'B', 'C'], 'B')).toEqual(['B', 'A', 'C']);
    expect(reorderPorts(['A', 'B', 'C'], undefined)).toEqual(['A', 'B', 'C']);
  });

  it('renders port chips with active and tried classes', () => {
    const container = document.createElement('div');
    renderPortPills(container, ['A', 'B', 'C'], 1);
    expect(container.children).toHaveLength(3);
    expect(container.children[0].className).toContain('tried');
    expect(container.children[1].className).toContain('active');
  });

  it('starts and cancels the not-on countdown', () => {
    const button = document.createElement('button');
    const handle = startNotOnCountdown(button, 2, 'Next');
    expect(button.disabled).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(button.textContent).toContain('Waiting (1)');
    handle?.cancel();
    expect(button.style.display).toBe('none');
    expect(button.disabled).toBe(false);
  });

  it('resets the not-on button', () => {
    const button = document.createElement('button');
    button.style.display = '';
    button.disabled = true;
    button.textContent = 'Waiting';
    resetNotOnButton(button);
    expect(button.style.display).toBe('none');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Not On');
  });

  it('resets the port dialog elements', () => {
    const elements = {
      container: document.createElement('div'),
      progress: document.createElement('div'),
      notOnButton: document.createElement('button'),
      confirmButton: document.createElement('button'),
      retryButton: document.createElement('button'),
      giveUpButton: document.createElement('button'),
      messageEl: document.createElement('div'),
    };
    const cancel = vi.fn();
    resetPortDialog(elements, { cancel });
    expect(cancel).toHaveBeenCalled();
    expect(elements.messageEl?.textContent).toBe('');
    expect(elements.confirmButton?.textContent).toBe("It's On!");
  });

  it('initializes the stepper state and renders pills', () => {
    const state = defaultPortStepperState();
    const container = document.createElement('div');
    initializeStepper(state, ['A', 'B'], 'B', container);
    expect(state.ports[0]).toBe('B');
    expect(container.children[0].textContent).toBe('B');
  });

  it('sets the port message text', () => {
    const el = document.createElement('div');
    setPortMessage(el, 'Hello');
    expect(el.textContent).toBe('Hello');
  });

  it('tries a port selection and updates state', async () => {
    const postMock = getMockedApi().post;
    postMock.mockResolvedValue({ portNames: ['COM1'], currentPort: 'COM1' });
    const elements = {
      container: document.createElement('div'),
      progress: document.createElement('div'),
      notOnButton: document.createElement('button'),
      confirmButton: document.createElement('button'),
      retryButton: document.createElement('button'),
      giveUpButton: document.createElement('button'),
      messageEl: document.createElement('div'),
    };
    const update = vi.fn();
    const result = await tryPortSelection('COM1', elements, update);
    expect(postMock).toHaveBeenCalledWith('portName', { portName: 'COM1' });
    expect(result?.currentPort).toBe('COM1');
    expect(update).toHaveBeenCalledWith(result, 'COM1');
    expect(elements.notOnButton?.style.display).toBe('');
  });
});
