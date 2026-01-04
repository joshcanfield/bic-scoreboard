// src/ui/src/websocket.ts

import { GameState, Command } from './api/v2-types';
import { applyPatch } from './utils/state-patch'; // A helper to apply patches

type ScoreboardWindow = Window & {
    __SCOREBOARD_WS_URL__?: string;
    __SCOREBOARD_WS_PORT__?: number | string;
    __SCOREBOARD_WS_PATH__?: string;
    __test?: Record<string, unknown>;
};

const DEFAULT_WS_PORT = 8082;

const resolveWebSocketUrl = (): string => {
    if (typeof window === 'undefined') {
        return `ws://localhost:${DEFAULT_WS_PORT}/`;
    }

    const scoreboardWindow = window as ScoreboardWindow;
    const explicitUrl = scoreboardWindow.__SCOREBOARD_WS_URL__;
    if (explicitUrl && explicitUrl.trim().length > 0) {
        return explicitUrl;
    }

    const { protocol, hostname } = window.location;
    const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';

    const portOverride = scoreboardWindow.__SCOREBOARD_WS_PORT__;
    const parsedPort =
        typeof portOverride === 'number'
            ? portOverride
            : typeof portOverride === 'string' && portOverride.trim().length > 0
                ? Number(portOverride)
                : undefined;
    const port = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_WS_PORT;

    const rawPath = scoreboardWindow.__SCOREBOARD_WS_PATH__ ?? '/';
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

    const formattedHost = hostname.includes(':') ? `[${hostname}]` : hostname || 'localhost';

    return `${wsProtocol}://${formattedHost}:${port}${normalizedPath}`;
};

// Define the shape of our internal state
interface AppState {
    gameState: GameState | null;
    // Add any other UI-specific state here if needed
}

// Callback function type for state updates
type StateUpdateCallback = (newState: GameState) => void;
type ConnectionState = 'connecting' | 'open' | 'closed';
type ConnectionUpdateCallback = (state: ConnectionState) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private state: AppState = { gameState: null };
    private subscribers: StateUpdateCallback[] = [];
    private reconnectInterval: ReturnType<typeof setInterval> | null = null;
    private connectionState: ConnectionState = 'connecting';
    private connectionSubscribers: ConnectionUpdateCallback[] = [];

    constructor(private url: string) {
        this.connect();
    }

    private connect(): void {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }

        this.setConnectionState('connecting');
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            // Clear any reconnect attempts on successful connection
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
            this.setConnectionState('open');
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "INITIAL_STATE") {
                    this.state.gameState = message.data;
                    this.notifySubscribers();
                } else if (message.type === "STATE_PATCH") {
                    if (this.state.gameState) {
                        // Cast through unknown to apply patch to GameState
                        const patched = applyPatch(
                            this.state.gameState as unknown as Record<string, unknown>,
                            message.data as Record<string, unknown>
                        );
                        this.state.gameState = patched as unknown as GameState;
                        this.notifySubscribers();
                    }
                    // Silently ignore patches without initial state - will resync on reconnect
                }
            } catch (e) {
                console.error("Error parsing WebSocket message:", e);
            }
        };

        this.ws.onclose = () => {
            this.setConnectionState('closed');
            // Attempt to reconnect after some delay
            if (!this.reconnectInterval) {
                this.reconnectInterval = setInterval(() => this.connect(), 3000);
            }
        };

        this.ws.onerror = (event) => {
            console.error("WebSocket error:", event);
            this.setConnectionState('closed');
            this.ws?.close(); // Force close to trigger onclose and reconnect logic
        };
    }

    public subscribe(callback: StateUpdateCallback): () => void {
        this.subscribers.push(callback);
        // Immediately send current state if available
        if (this.state.gameState) {
            callback(this.state.gameState);
        }
        return () => {
            this.subscribers = this.subscribers.filter(sub => sub !== callback);
        };
    }

    private notifySubscribers(): void {
        if (this.state.gameState) {
            this.subscribers.forEach(callback => callback(this.state.gameState!));
        }
    }

    private setConnectionState(state: ConnectionState) {
        if (this.connectionState === state) return;
        this.connectionState = state;
        this.connectionSubscribers.forEach(cb => cb(this.connectionState));
    }

    public subscribeConnection(callback: ConnectionUpdateCallback): () => void {
        this.connectionSubscribers.push(callback);
        callback(this.connectionState);
        return () => {
            this.connectionSubscribers = this.connectionSubscribers.filter(cb => cb !== callback);
        };
    }

    public sendCommand(command: Command): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ type: "COMMAND", command: command.type, payload: command.payload }));
                const win = window as ScoreboardWindow;
                const testHooks = win.__test ?? {};
                win.__test = { ...testHooks, lastCommand: command.type };
            } catch {
                // Command send failed - connection will handle reconnect
            }
        }
        // Silently drop commands when not connected - UI shows connection status
    }

    public getGameState(): GameState | null {
        return this.state.gameState;
    }
}

// Export a singleton instance. This ensures only one WebSocket connection is managed.
export const websocketClient = new WebSocketClient(resolveWebSocketUrl());
