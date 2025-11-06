import type { components } from '../api/game.types';

import { createNativeTransport, type Transport } from './native-ws';

export type TeamCode = 'home' | 'away';

export type UpdateEventPayload = components['schemas']['UpdateEventPayload'];
export type PowerEventPayload = components['schemas']['PowerEventPayload'];

export interface ServerInboundEvents {
  update: UpdateEventPayload;
  power: PowerEventPayload;
  message: unknown;
}

export interface TeamCommandPayload {
  team: TeamCode;
}

export interface GoalCommandPayload extends TeamCommandPayload {
  player?: number | string | null;
  assist?: number | string | null;
}

export interface ShotCommandPayload extends TeamCommandPayload {}

export interface SetPeriodPayload {
  period: number;
}

export interface CreateGamePayload {
  periodLengths?: number[];
  intermissionDurationMinutes?: number;
  buzzerIntervalSeconds?: number;
}

export interface ServerOutboundEvents {
  clock_start: undefined;
  clock_pause: undefined;
  goal: GoalCommandPayload;
  undo_goal: TeamCommandPayload;
  shot: ShotCommandPayload;
  undo_shot: ShotCommandPayload;
  buzzer: undefined;
  power_on: undefined;
  power_off: undefined;
  power_state: undefined;
  set_period: SetPeriodPayload;
  exit_intermission: undefined;
  createGame: CreateGamePayload;
}

type KeysWithPayload = {
  [K in keyof ServerOutboundEvents]: ServerOutboundEvents[K] extends undefined ? never : K;
}[keyof ServerOutboundEvents];

type KeysWithoutPayload = {
  [K in keyof ServerOutboundEvents]: ServerOutboundEvents[K] extends undefined ? K : never;
}[keyof ServerOutboundEvents];

export interface ServerSocket {
  on<E extends keyof ServerInboundEvents>(event: E, cb: (payload: ServerInboundEvents[E]) => void): void;
  emit<E extends KeysWithPayload>(event: E, payload: ServerOutboundEvents[E]): void;
  emit<E extends KeysWithoutPayload>(event: E): void;
}

export interface ServerActions {
  startClock(): void;
  pauseClock(): void;
  goal(payload: GoalCommandPayload): void;
  undoGoal(payload: TeamCommandPayload): void;
  shot(payload: ShotCommandPayload): void;
  undoShot(payload: ShotCommandPayload): void;
  buzzer(): void;
  powerOn(): void;
  powerOff(): void;
  powerState(): void;
  setPeriod(period: number): void;
  exitIntermission(): void;
  createGame(payload: CreateGamePayload): void;
}

export interface ServerRuntime {
  transport: Transport;
  socket: ServerSocket;
  server: ServerActions;
}

export interface ServerRuntimeOptions {
  transport?: Transport;
}

export const createServerRuntime = (options: ServerRuntimeOptions = {}): ServerRuntime => {
  const transport = options.transport ?? createNativeTransport();

  const socket: ServerSocket = {
    on: (event, cb) => {
      transport.on(event, cb);
    },
    emit: (event: keyof ServerOutboundEvents, payload?: ServerOutboundEvents[keyof ServerOutboundEvents]) => {
      transport.emit(event, payload);
    },
  };

  const server: ServerActions = {
    startClock: () => socket.emit('clock_start'),
    pauseClock: () => socket.emit('clock_pause'),
    goal: (payload) => socket.emit('goal', payload),
    undoGoal: (payload) => socket.emit('undo_goal', payload),
    shot: (payload) => socket.emit('shot', payload),
    undoShot: (payload) => socket.emit('undo_shot', payload),
    buzzer: () => socket.emit('buzzer'),
    powerOn: () => socket.emit('power_on'),
    powerOff: () => socket.emit('power_off'),
    powerState: () => socket.emit('power_state'),
    setPeriod: (period) => socket.emit('set_period', { period }),
    exitIntermission: () => socket.emit('exit_intermission'),
    createGame: (payload) => socket.emit('createGame', payload),
  };

  return { transport, socket, server };
};
