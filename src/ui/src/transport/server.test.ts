import { describe, expect, it, vi } from 'vitest';

import type { Transport } from './native-ws';
import { createServerRuntime, type GoalCommandPayload, type ServerOutboundEvents } from './server';

const createMockTransport = () => {
  const emit = vi.fn() as Transport['emit'];
  const on = vi.fn() as Transport['on'];
  const onStatus = vi.fn();
  const close = vi.fn();

  const transport: Transport = {
    kind: 'ws',
    emit,
    on,
    onStatus,
    close,
  };

  return { transport, emit, on, onStatus, close };
};

describe('createServerRuntime', () => {
  it('provides typed server actions backed by transport emits', () => {
    const { transport, emit } = createMockTransport();
    const { server } = createServerRuntime({ transport });

    const goalPayload: GoalCommandPayload = { team: 'home', player: 12 };
    server.goal(goalPayload);
    expect(emit).toHaveBeenCalledWith('goal', goalPayload);

    server.startClock();
    expect(emit).toHaveBeenCalledWith('clock_start', undefined);

    server.setPeriod(3);
    expect(emit).toHaveBeenCalledWith('set_period', { period: 3 });
  });

  it('exposes socket helpers that delegate to the underlying transport', () => {
    const { transport, on, emit } = createMockTransport();
    const { socket } = createServerRuntime({ transport });
    const updateHandler = vi.fn();

    socket.on('update', updateHandler);
    expect(on).toHaveBeenCalledWith('update', updateHandler);

    const shotPayload: ServerOutboundEvents['shot'] = { team: 'away' };
    socket.emit('shot', shotPayload);
    expect(emit).toHaveBeenCalledWith('shot', shotPayload);

    socket.emit('power_state');
    expect(emit).toHaveBeenCalledWith('power_state', undefined);
  });
});
