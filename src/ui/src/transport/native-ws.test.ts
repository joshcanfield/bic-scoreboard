import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildBaseHost, createNativeTransport } from './native-ws';

class MockWebSocket implements Partial<WebSocket> {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public sent: string[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatch('close', {});
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatch('open', {});
  }

  emitMessage(data: unknown) {
    this.dispatch('message', { data: JSON.stringify(data) });
  }

  emitError() {
    this.dispatch('error', new Event('error'));
  }

  private dispatch(type: string, event: unknown) {
    (this.listeners[type] || []).forEach((handler) => handler(event));
  }
}

describe('native websocket transport', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds host information using search parameter overrides', () => {
    const location = {
      href: 'https://example.test/control?socketHost=ws.dev&socketPort=9000',
      hostname: 'example.test',
      protocol: 'https:',
    } as const;

    const info = buildBaseHost('8082', location);
    expect(info).toEqual({ host: 'ws.dev', port: '9000', isHttps: true });
  });

  it('queues outgoing events until the socket is open and flushes after connect', () => {
    const location = {
      href: 'http://localhost/control',
      hostname: 'localhost',
      protocol: 'http:',
    } as const;

    const transport = createNativeTransport({
      location,
      webSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      reconnectDelayInitial: 100,
    });

    expect(MockWebSocket.instances).toHaveLength(1);
    const instance = MockWebSocket.instances[0];
    expect(instance.url).toBe('ws://localhost:8082/ws');

    transport.emit('goal', { team: 'home' });
    expect(instance.sent).toHaveLength(0);

    transport.on('update', (data) => {
      expect(data).toEqual({ time: 1000 });
    });

    instance.open();
    expect(instance.sent).toEqual([JSON.stringify({ event: 'goal', data: { team: 'home' } })]);

    instance.emitMessage({ event: 'update', data: { time: 1000 } });
  });

  it('reconnects with backoff and notifies status handlers', () => {
    const location = {
      href: 'http://localhost/control',
      hostname: 'localhost',
      protocol: 'http:',
    } as const;

    const transport = createNativeTransport({
      location,
      reconnectDelayInitial: 200,
      reconnectDelayMax: 400,
      webSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    const status = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      error: vi.fn(),
      reconnecting: vi.fn(),
    };
    transport.onStatus(status);

    const instance = MockWebSocket.instances[0];
    instance.open();
    expect(status.connect).toHaveBeenCalledTimes(1);

    instance.emitError();
    expect(status.error).toHaveBeenCalledTimes(1);

    instance.close();
    expect(status.disconnect).toHaveBeenCalledTimes(1);

    // Expect a reconnect scheduled after initial delay
    expect(status.reconnecting).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(status.reconnecting).toHaveBeenCalledTimes(1);
  });

  it('stops reconnecting when closed', () => {
    const location = {
      href: 'http://localhost/control',
      hostname: 'localhost',
      protocol: 'http:',
    } as const;

    const transport = createNativeTransport({
      location,
      reconnectDelayInitial: 200,
      reconnectDelayMax: 400,
      webSocketImpl: MockWebSocket as unknown as typeof WebSocket,
    });

    const instance = MockWebSocket.instances[0];
    transport.close();
    instance.close();

    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
