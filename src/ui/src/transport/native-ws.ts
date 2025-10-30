export type StatusHandler = () => void | Promise<void>;

export interface StatusHandlers {
  connect?: StatusHandler;
  disconnect?: StatusHandler;
  error?: StatusHandler;
  reconnecting?: StatusHandler;
}

export interface Transport {
  kind: 'ws';
  on<T = unknown>(event: string, cb: (data: T) => void): void;
  emit(event: string, data?: unknown): void;
  onStatus(handlers: StatusHandlers): void;
  close(): void;
}

export interface NativeTransportOptions {
  defaultPort?: string;
  reconnectDelayInitial?: number;
  reconnectDelayMax?: number;
  location?: Pick<Location, 'href' | 'hostname' | 'protocol'>;
  webSocketImpl?: typeof WebSocket;
}

const DEFAULT_PORT = '8082';
const DEFAULT_RECONNECT_INITIAL = 500;
const DEFAULT_RECONNECT_MAX = 5000;

export const buildBaseHost = (
  defPort: string,
  location: Pick<Location, 'href' | 'hostname' | 'protocol'>
) => {
  const url = new URL(location.href);
  const host = url.searchParams.get('socketHost') || location.hostname;
  const port = url.searchParams.get('socketPort') || defPort;
  return { host, port, isHttps: location.protocol === 'https:' };
};

export const createNativeTransport = (options: NativeTransportOptions = {}): Transport => {
  const {
    defaultPort = DEFAULT_PORT,
    reconnectDelayInitial = DEFAULT_RECONNECT_INITIAL,
    reconnectDelayMax = DEFAULT_RECONNECT_MAX,
    location = window.location,
    webSocketImpl = WebSocket,
  } = options;

  const { host, port, isHttps } = buildBaseHost(defaultPort, location);
  const wsUrl = `${isHttps ? 'wss' : 'ws'}://${host}:${port}/ws`;

  const listeners = new Map<string, (data: unknown) => void>();
  const statusHandlers: StatusHandlers = {};
  const pending: string[] = [];
  let shouldReconnect = true;
  let reconnectDelay = reconnectDelayInitial;
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const flushPending = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (pending.length > 0) {
      const payload = pending.shift();
      if (payload) socket.send(payload);
    }
  };

  const connect = () => {
    statusHandlers.reconnecting?.();
    socket = new webSocketImpl(wsUrl);

    socket.addEventListener('open', () => {
      reconnectDelay = reconnectDelayInitial;
      statusHandlers.connect?.();
      flushPending();
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        const cb = listeners.get(msg.event);
        if (cb) cb(msg.data);
      } catch (_) {
        // ignore malformed payloads to preserve legacy behaviour
      }
    });

    socket.addEventListener('close', () => {
      statusHandlers.disconnect?.();
      if (!shouldReconnect) return;
      const delay = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * 2, reconnectDelayMax);
      clearReconnectTimer();
      reconnectTimer = setTimeout(connect, delay);
    });

    socket.addEventListener('error', () => {
      statusHandlers.error?.();
      // close handler will schedule reconnect when needed
    });
  };

  connect();

  return {
    kind: 'ws' as const,
    on: (event, cb) => {
      listeners.set(event, cb as (data: unknown) => void);
    },
    emit: (event, data) => {
      const payload = JSON.stringify({ event, data });
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else {
        pending.push(payload);
      }
    },
    onStatus: (handlers) => {
      Object.assign(statusHandlers, handlers);
    },
    close: () => {
      shouldReconnect = false;
      clearReconnectTimer();
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
      socket = null;
    },
  };
};
