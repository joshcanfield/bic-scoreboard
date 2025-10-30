import apiClient, { type PortList, type PortSelection } from '../api/http';

export interface PortStepperState {
  ports: string[];
  index: number;
  active: boolean;
}

export interface PortDialogElements {
  container: HTMLElement | null;
  progress: HTMLElement | null;
  notOnButton: HTMLButtonElement | null;
  confirmButton: HTMLButtonElement | null;
  retryButton: HTMLButtonElement | null;
  giveUpButton: HTMLButtonElement | null;
  messageEl: HTMLElement | null;
}

export interface CountdownHandle {
  cancel: () => void;
}

export const defaultPortStepperState = (): PortStepperState => ({
  ports: [],
  index: 0,
  active: false,
});

export const reorderPorts = (ports: string[], currentPort?: string | null): string[] => {
  if (!currentPort) return [...ports];
  const list = [...ports];
  const idx = list.indexOf(currentPort);
  if (idx > 0) {
    list.splice(idx, 1);
    list.unshift(currentPort);
  }
  return list;
};

export const renderPortPills = (container: HTMLElement | null, ports: string[], activeIndex = 0) => {
  if (!container) return;
  container.innerHTML = '';
  ports.forEach((name, i) => {
    const pill = document.createElement('span');
    pill.className = 'port-pill' + (i === activeIndex ? ' active' : '') + (i < activeIndex ? ' tried' : '');
    pill.textContent = name;
    container.appendChild(pill);
  });
};

export const setPortMessage = (el: HTMLElement | null, msg: string) => {
  if (el) el.textContent = msg;
};

export const resetNotOnButton = (button: HTMLButtonElement | null) => {
  if (!button) return;
  button.style.display = 'none';
  button.disabled = false;
  button.textContent = 'Not On';
};

export const startNotOnCountdown = (
  button: HTMLButtonElement | null,
  seconds = 5,
  nextPortLabel = ''
): CountdownHandle | null => {
  if (!button) return null;
  let finished = false;
  let remaining = seconds;
  button.disabled = true;
  button.style.display = '';
  button.textContent = `Waiting (${remaining})`;
  const timer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timer);
      finished = true;
      button.disabled = false;
      button.textContent = nextPortLabel ? `Try ${nextPortLabel}` : 'Not On';
    } else {
      button.textContent = `Waiting (${remaining})`;
    }
  }, 1000);

  return {
    cancel: () => {
      clearInterval(timer);
      if (!finished) resetNotOnButton(button);
    },
  };
};

export const resetPortDialog = (
  elements: PortDialogElements,
  countdownHandle: CountdownHandle | null
) => {
  countdownHandle?.cancel();
  const { notOnButton, confirmButton, retryButton, giveUpButton, messageEl, container } = elements;
  setPortMessage(messageEl, '');
  if (retryButton) retryButton.style.display = 'none';
  if (giveUpButton) giveUpButton.style.display = 'none';
  if (confirmButton) {
    confirmButton.style.display = '';
    confirmButton.textContent = "It's On!";
    confirmButton.className = 'btn btn-success';
  }
  resetNotOnButton(notOnButton);
  if (container) container.innerHTML = '';
};

export const initializeStepper = (
  state: PortStepperState,
  ports: string[],
  currentPort: string | undefined,
  container: HTMLElement | null
) => {
  state.active = true;
  state.ports = reorderPorts(ports, currentPort);
  state.index = 0;
  renderPortPills(container, state.ports, 0);
};

export const tryPortSelection = async (
  portName: string,
  elements: PortDialogElements,
  updateState: (resp: PortList | null, attemptedPort: string) => void
): Promise<PortList | null> => {
  const { progress, notOnButton, confirmButton, retryButton, messageEl } = elements;
  if (progress) progress.style.display = '';
  setPortMessage(messageEl, `Trying ${portName}… Did the scoreboard turn on?`);
  try {
    const resp = await apiClient.post<PortList>('portName', { portName } satisfies PortSelection);
    updateState(resp ?? null, portName);
    if (notOnButton) notOnButton.style.display = '';
    if (confirmButton) {
      confirmButton.textContent = "It's On!";
      confirmButton.className = 'btn btn-success';
    }
    if (retryButton) retryButton.style.display = 'none';
    return resp ?? null;
  } finally {
    if (progress) {
      setTimeout(() => {
        progress.style.display = 'none';
      }, 400);
    }
  }
};
