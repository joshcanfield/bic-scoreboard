// Native WebSocket transport for server communication
const buildBaseHost = (defPort) => {
  const url = new URL(window.location.href);
  const host = url.searchParams.get("socketHost") || window.location.hostname;
  const port = url.searchParams.get("socketPort") || defPort;
  return { host, port, isHttps: window.location.protocol === "https:" };
};

export const createTransport = () => {
  const defaultPort = "8082";
  const { host, port, isHttps } = buildBaseHost(defaultPort);
  const wsUrl = `${isHttps ? "wss" : "ws"}://${host}:${port}/ws`;

  const listeners = new Map();
  const statusHandlers = {
    connect: null,
    disconnect: null,
    error: null,
    reconnecting: null,
  };
  let ws = null;
  let shouldReconnect = true;
  let reconnectDelay = 500;
  const reconnectDelayMax = 5000;
  const pending = [];

  const flushPending = () => {
    while (pending.length && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(pending.shift());
    }
  };

  const connect = () => {
    if (statusHandlers.reconnecting) statusHandlers.reconnecting();
    ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => {
      reconnectDelay = 500;
      if (statusHandlers.connect) statusHandlers.connect();
      flushPending();
    });
    ws.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse(e.data);
        const cb = listeners.get(msg.event);
        if (cb) cb(msg.data);
      } catch (_) {
        /* ignore parse issues */
      }
    });
    ws.addEventListener("close", () => {
      if (statusHandlers.disconnect) statusHandlers.disconnect();
      if (shouldReconnect) {
        const delay = reconnectDelay;
        reconnectDelay = Math.min(reconnectDelay * 2, reconnectDelayMax);
        setTimeout(connect, delay);
      }
    });
    ws.addEventListener("error", () => {
      if (statusHandlers.error) statusHandlers.error();
      // close handler will schedule reconnect
    });
  };

  connect();

  return {
    kind: "ws",
    on: (event, cb) => listeners.set(event, cb),
    emit: (event, data) => {
      const payload = JSON.stringify({ event, data });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        pending.push(payload);
      }
    },
    onStatus: (handlers) => Object.assign(statusHandlers, handlers),
    disconnect: () => {
      shouldReconnect = false;
      if (ws) ws.close();
    },
  };
};

export const transport = createTransport();

export const socket = {
  on: transport.on,
  emit: transport.emit,
};

export const Server = {
  startClock: () => socket.emit("clock_start"),
  pauseClock: () => socket.emit("clock_pause"),
  goal: (data) => socket.emit("goal", data),
  undoGoal: (data) => socket.emit("undo_goal", data),
  shot: (data) => socket.emit("shot", data),
  undoShot: (data) => socket.emit("undo_shot", data),
  buzzer: () => socket.emit("buzzer"),
  powerOn: () => socket.emit("power_on"),
  powerOff: () => socket.emit("power_off"),
  powerState: () => socket.emit("power_state"),
  setPeriod: (p) => socket.emit("set_period", { period: p }),
  createGame: (cfg) => socket.emit("createGame", cfg),
};
