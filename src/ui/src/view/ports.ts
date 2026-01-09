/**
 * Port UI utilities - helper functions for the scoreboard connection dialog.
 * Port selection itself is handled via WebSocket commands (START_ADAPTER/STOP_ADAPTER).
 */

export interface CountdownHandle {
  cancel: () => void;
}

export const setPortMessage = (el: HTMLElement | null, msg: string) => {
  if (el) el.textContent = msg;
};
