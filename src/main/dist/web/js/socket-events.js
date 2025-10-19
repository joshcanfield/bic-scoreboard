import { $ } from "./dom.js";
import { api } from "./api.js";
import { State } from "./state.js";
import { socket, transport } from "./transport.js";

export const initSocket = ({
  renderUpdate,
  setPowerUI,
  updatePowerFromServer,
}) => {
  const output = (html) => {
    const consoleBox = $("#console");
    if (!consoleBox) return;
    while (consoleBox.children.length > 20)
      consoleBox.removeChild(consoleBox.lastChild);
    const el = document.createElement("div");
    el.innerHTML = html;
    consoleBox.prepend(el);
  };

  const status = document.getElementById("conn-status");
  const overlay = document.getElementById("conn-overlay");
  const overlayText = document.getElementById("conn-overlay-text");

  const setStatus = (state, text) => {
    if (!status) return;
    status.dataset.state = state;
    status.textContent = text;
  };

  const setOverlay = (state, text) => {
    if (!overlay) return;
    overlay.dataset.state = state;
    overlay.style.display = state === "ok" ? "none" : "flex";
    if (overlayText) overlayText.textContent = text || "";
  };

  transport.onStatus({
    connect: async () => {
      setStatus("ok", "Connected");
      setOverlay("ok", "");
      output('<span class="connect-msg">Connected</span>');
      try {
        const data = await api.get("portNames");
        State.portNames = data.portNames || [];
        State.currentPort = data.currentPort || "";
        if (State.scoreboardOn) setPowerUI("on");
        else setPowerUI("off");
      } catch (_) {
        /* ignore */
      }
    },
    disconnect: () => {
      setStatus("down", "Disconnected");
      setOverlay("down", "Reconnecting...");
      output(
        '<span class="disconnect-msg">Disconnected! Make sure the app is running!</span>',
      );
    },
    reconnecting: () => {
      setStatus("reconnecting", "Reconnecting...");
      setOverlay("reconnecting", "Reconnecting...");
    },
    error: () => {
      setStatus("down", "Connect error");
      setOverlay("down", "Reconnecting...");
    },
  });

  socket.on("message", (data) =>
    output(`<pre>Message ${JSON.stringify(data)}</pre>`),
  );
  socket.on("power", (data) => {
    output(
      `<span class="disconnect-msg">The Scoreboard has been turned ${
        data.scoreboardOn ? "ON" : "OFF"
      }</span>`,
    );
    if (typeof updatePowerFromServer === "function") {
      updatePowerFromServer(!!data.scoreboardOn);
    }
  });
  socket.on("update", (data) => renderUpdate(data));
};
