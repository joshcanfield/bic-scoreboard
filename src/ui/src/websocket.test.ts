import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Types for testing - these mirror the module's internal types
interface ScoreboardWindow extends Window {
  __SCOREBOARD_WS_URL__?: string;
  __SCOREBOARD_WS_PORT__?: number | string;
  __SCOREBOARD_WS_PATH__?: string;
  __test?: Record<string, unknown>;
}

// Mock GameState for testing
const createMockGameState = (overrides: Record<string, unknown> = {}) => ({
  gameId: 'test-game-1',
  config: {
    templateId: 'standard',
    warmupLengthMinutes: 5,
    warmupLengthMillis: 300000,
    periodLengthMinutes: 15,
    periodLengthMillis: 900000,
    intermissionLengthMinutes: 3,
    intermissionLengthMillis: 180000,
    periods: 3,
    clockType: 'STOP_TIME',
    shiftLengthSeconds: null,
  },
  status: 'PRE_GAME',
  period: 1,
  clock: {
    timeRemainingMillis: 900000,
    isRunning: false,
    startTimeWallClock: 0,
  },
  home: { goals: [], shots: 0, penalties: [] },
  away: { goals: [], shots: 0, penalties: [] },
  buzzerOn: false,
  eventHistory: [],
  ...overrides,
});

// MockWebSocket that simulates native WebSocket behavior
class MockWebSocket implements Partial<WebSocket> {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public sent: string[] = [];

  // Event handler properties (matches native WebSocket)
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  static reset() {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// Since websocket.ts exports a singleton that connects immediately,
// we need to mock WebSocket globally before importing
describe('websocket module', () => {
  let originalWebSocket: typeof WebSocket;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    // Save originals
    originalWebSocket = global.WebSocket;
    originalWindow = global.window;

    // Set up mock WebSocket globally
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    // Mock window.location
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
        },
      } as ScoreboardWindow,
      writable: true,
      configurable: true,
    });

    MockWebSocket.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore originals
    global.WebSocket = originalWebSocket;
    global.window = originalWindow;
    vi.useRealTimers();
    vi.resetModules();
  });

  describe('resolveWebSocketUrl', () => {
    it('returns default localhost URL when window is undefined', async () => {
      // Remove window to test server-side scenario
      (global as { window: Window | undefined }).window = undefined;

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:8082/');
    });

    it('uses explicit URL override when set', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_URL__ = 'wss://custom.server:9000/custom';

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('wss://custom.server:9000/custom');
    });

    it('ignores empty string URL override', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_URL__ = '   ';

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:8082/');
    });

    it('uses port override when set as number', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_PORT__ = 9999;

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:9999/');
    });

    it('uses port override when set as string', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_PORT__ = '7777';

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:7777/');
    });

    it('ignores invalid port string', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_PORT__ = 'invalid';

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:8082/');
    });

    it('uses path override when set', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_PATH__ = '/ws/v2';

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:8082/ws/v2');
    });

    it('normalizes path without leading slash', async () => {
      (window as ScoreboardWindow).__SCOREBOARD_WS_PATH__ = 'ws/v2';

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:8082/ws/v2');
    });

    it('uses wss protocol when page is served over https', async () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            protocol: 'https:',
            hostname: 'secure.example.com',
          },
        } as ScoreboardWindow,
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('wss://secure.example.com:8082/');
    });

    it('wraps IPv6 addresses in brackets', async () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            protocol: 'http:',
            hostname: '::1',
          },
        } as ScoreboardWindow,
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://[::1]:8082/');
    });

    it('falls back to localhost for empty hostname', async () => {
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            protocol: 'http:',
            hostname: '',
          },
        } as ScoreboardWindow,
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      const { resolveWebSocketUrl } = await import('./websocket');
      expect(resolveWebSocketUrl()).toBe('ws://localhost:8082/');
    });
  });

  describe('WebSocketClient', () => {
    it('creates WebSocket connection on instantiation', async () => {
      vi.resetModules();
      await import('./websocket');

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8082/');
    });

    describe('connection state', () => {
      it('notifies connection subscribers of connecting state initially', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        websocketClient.subscribeConnection(callback);

        // Should be called immediately with current state
        expect(callback).toHaveBeenCalledWith('connecting');
      });

      it('notifies connection subscribers when connection opens', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        websocketClient.subscribeConnection(callback);
        callback.mockClear(); // Clear the initial call

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        expect(callback).toHaveBeenCalledWith('open');
      });

      it('notifies connection subscribers when connection closes', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        websocketClient.subscribeConnection(callback);
        callback.mockClear();

        ws.close();

        expect(callback).toHaveBeenCalledWith('closed');
      });

      it('allows unsubscribing from connection updates', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        const unsubscribe = websocketClient.subscribeConnection(callback);
        callback.mockClear();

        unsubscribe();

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        expect(callback).not.toHaveBeenCalled();
      });

      it('does not notify if connection state has not changed', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        websocketClient.subscribeConnection(callback);
        expect(callback).toHaveBeenCalledTimes(1); // Initial 'connecting'

        // Subscribe again - should get same 'connecting' state
        const callback2 = vi.fn();
        websocketClient.subscribeConnection(callback2);
        expect(callback2).toHaveBeenCalledWith('connecting');
      });
    });

    describe('message handling', () => {
      it('handles INITIAL_STATE message and notifies subscribers', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        websocketClient.subscribe(callback);

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState();
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        expect(callback).toHaveBeenCalledWith(gameState);
        expect(websocketClient.getGameState()).toEqual(gameState);
      });

      it('provides current state immediately to new subscribers', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState();
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        // Subscribe after state is received
        const callback = vi.fn();
        websocketClient.subscribe(callback);

        expect(callback).toHaveBeenCalledWith(gameState);
      });

      it('handles STATE_PATCH message by applying patch', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState();
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        const callback = vi.fn();
        websocketClient.subscribe(callback);
        callback.mockClear();

        // Send a patch to update shots
        ws.simulateMessage({ type: 'STATE_PATCH', data: { 'home.shots': 5 } });

        expect(callback).toHaveBeenCalledTimes(1);
        const updatedState = callback.mock.calls[0][0];
        expect(updatedState.home.shots).toBe(5);
      });

      it('applies nested patches correctly', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState();
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        ws.simulateMessage({
          type: 'STATE_PATCH',
          data: { 'clock.timeRemainingMillis': 450000, 'clock.isRunning': true },
        });

        const state = websocketClient.getGameState()!;
        expect(state.clock.timeRemainingMillis).toBe(450000);
        expect(state.clock.isRunning).toBe(true);
      });

      it('ignores STATE_PATCH when no initial state exists', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const callback = vi.fn();
        websocketClient.subscribe(callback);

        // Send patch without initial state
        ws.simulateMessage({ type: 'STATE_PATCH', data: { 'home.shots': 5 } });

        expect(callback).not.toHaveBeenCalled();
        expect(websocketClient.getGameState()).toBeNull();
      });

      it('handles malformed JSON gracefully', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        // Simulate malformed message
        if (ws.onmessage) {
          ws.onmessage(new MessageEvent('message', { data: 'not valid json' }));
        }

        expect(consoleSpy).toHaveBeenCalled();
        expect(websocketClient.getGameState()).toBeNull();

        consoleSpy.mockRestore();
      });
    });

    describe('subscribe/unsubscribe', () => {
      it('allows unsubscribing from state updates', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback = vi.fn();
        const unsubscribe = websocketClient.subscribe(callback);

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        unsubscribe();

        ws.simulateMessage({ type: 'INITIAL_STATE', data: createMockGameState() });

        expect(callback).not.toHaveBeenCalled();
      });

      it('supports multiple subscribers', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback1 = vi.fn();
        const callback2 = vi.fn();
        websocketClient.subscribe(callback1);
        websocketClient.subscribe(callback2);

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState();
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        expect(callback1).toHaveBeenCalledWith(gameState);
        expect(callback2).toHaveBeenCalledWith(gameState);
      });

      it('does not affect other subscribers when one unsubscribes', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const callback1 = vi.fn();
        const callback2 = vi.fn();
        const unsubscribe1 = websocketClient.subscribe(callback1);
        websocketClient.subscribe(callback2);

        unsubscribe1();

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState();
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).toHaveBeenCalledWith(gameState);
      });
    });

    describe('sendCommand', () => {
      it('sends command when connection is open', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        websocketClient.sendCommand({ type: 'START_CLOCK' });

        expect(ws.sent).toHaveLength(1);
        expect(JSON.parse(ws.sent[0])).toEqual({
          type: 'COMMAND',
          command: 'START_CLOCK',
          payload: undefined,
        });
      });

      it('sends command with payload', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        websocketClient.sendCommand({
          type: 'ADD_GOAL',
          payload: { teamId: 'home', playerNumber: 10 },
        });

        expect(ws.sent).toHaveLength(1);
        expect(JSON.parse(ws.sent[0])).toEqual({
          type: 'COMMAND',
          command: 'ADD_GOAL',
          payload: { teamId: 'home', playerNumber: 10 },
        });
      });

      it('stores last command type in window.__test', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        websocketClient.sendCommand({ type: 'BUZZER_ON' });

        expect((window as ScoreboardWindow).__test?.lastCommand).toBe('BUZZER_ON');
      });

      it('silently drops command when connection is not open', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        // Connection not opened

        websocketClient.sendCommand({ type: 'START_CLOCK' });

        expect(ws.sent).toHaveLength(0);
      });

      it('handles send errors gracefully', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        // Override send to throw
        ws.send = () => {
          throw new Error('Network error');
        };

        // Should not throw
        expect(() => websocketClient.sendCommand({ type: 'START_CLOCK' })).not.toThrow();
      });
    });

    describe('reconnection', () => {
      it('attempts reconnection after connection closes', async () => {
        vi.resetModules();
        const { websocketClient: _client } = await import('./websocket');

        expect(MockWebSocket.instances).toHaveLength(1);

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();
        ws.close();

        // Should schedule reconnect
        vi.advanceTimersByTime(3000);

        expect(MockWebSocket.instances).toHaveLength(2);
      });

      it('clears reconnect interval on successful connection', async () => {
        vi.resetModules();
        const { websocketClient: _client } = await import('./websocket');

        const ws1 = MockWebSocket.getLastInstance()!;
        ws1.simulateOpen();
        ws1.close();

        vi.advanceTimersByTime(3000);
        expect(MockWebSocket.instances).toHaveLength(2);

        const ws2 = MockWebSocket.getLastInstance()!;
        ws2.simulateOpen();

        // Should not create more connections
        vi.advanceTimersByTime(6000);
        expect(MockWebSocket.instances).toHaveLength(2);
      });

      it('sets connection state to closed on error', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const callback = vi.fn();
        websocketClient.subscribeConnection(callback);

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();
        callback.mockClear();

        ws.simulateError();

        expect(callback).toHaveBeenCalledWith('closed');
      });

      it('closes socket on error to trigger reconnect', async () => {
        vi.resetModules();
        const { websocketClient: _client } = await import('./websocket');

        vi.spyOn(console, 'error').mockImplementation(() => {});

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const closeSpy = vi.spyOn(ws, 'close');
        ws.simulateError();

        expect(closeSpy).toHaveBeenCalled();
      });

      it('clears reconnect interval on new connection attempt', async () => {
        vi.resetModules();
        const { websocketClient: _client } = await import('./websocket');

        const ws1 = MockWebSocket.getLastInstance()!;
        ws1.simulateOpen();
        ws1.close();

        vi.advanceTimersByTime(3000);
        expect(MockWebSocket.instances).toHaveLength(2);

        // Close second connection before it opens
        const ws2 = MockWebSocket.getLastInstance()!;
        ws2.close();

        // Only one more reconnect attempt should happen
        vi.advanceTimersByTime(3000);
        expect(MockWebSocket.instances).toHaveLength(3);

        // Opening should clear the interval
        const ws3 = MockWebSocket.getLastInstance()!;
        ws3.simulateOpen();

        vi.advanceTimersByTime(10000);
        expect(MockWebSocket.instances).toHaveLength(3);
      });
    });

    describe('getGameState', () => {
      it('returns null when no state received', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        expect(websocketClient.getGameState()).toBeNull();
      });

      it('returns current game state after INITIAL_STATE', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        const gameState = createMockGameState({ gameId: 'unique-id' });
        ws.simulateMessage({ type: 'INITIAL_STATE', data: gameState });

        expect(websocketClient.getGameState()).toEqual(gameState);
      });

      it('returns updated state after patches', async () => {
        vi.resetModules();
        const { websocketClient } = await import('./websocket');

        const ws = MockWebSocket.getLastInstance()!;
        ws.simulateOpen();

        ws.simulateMessage({ type: 'INITIAL_STATE', data: createMockGameState() });
        ws.simulateMessage({ type: 'STATE_PATCH', data: { period: 2, 'away.shots': 10 } });

        const state = websocketClient.getGameState()!;
        expect(state.period).toBe(2);
        expect(state.away.shots).toBe(10);
      });
    });
  });
});
