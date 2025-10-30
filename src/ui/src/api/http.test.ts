import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, gameApi } from './http';

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  json: ReturnType<typeof vi.fn>;
  text: ReturnType<typeof vi.fn>;
};

const createResponse = (overrides: Partial<FetchResponse>): FetchResponse => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn(),
  ...overrides,
});

describe('api http client', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('serializes JSON bodies and returns parsed JSON', async () => {
    const payload = { foo: 'bar' };
    const jsonResult = { ok: true };
    fetchMock.mockResolvedValue(
      createResponse({
        json: vi.fn().mockResolvedValue(jsonResult),
      })
    );

    const result = await api.post<typeof jsonResult>('test-endpoint', payload);

    expect(result).toEqual(jsonResult);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/game/test-endpoint');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(payload));
    const headers = init?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('returns text when non-JSON content-type is received', async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: vi.fn().mockResolvedValue('pong'),
      })
    );

    const result = await api.get<string>('ping');

    expect(result).toBe('pong');
    expect(fetchMock).toHaveBeenCalledWith('/api/game/ping', expect.any(Object));
  });

  it('throws when the response status is not ok', async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        ok: false,
        status: 500,
      })
    );

    await expect(api.get('fail')).rejects.toThrow('GET fail failed: 500');
  });

  it('exposes typed helpers for common game endpoints', async () => {
    const ports = { currentPort: 'COM1', portNames: ['COM1', 'COM2'] };
    fetchMock.mockResolvedValue(
      createResponse({
        json: vi.fn().mockResolvedValue(ports),
      })
    );

    const result = await gameApi.listPorts();

    expect(result).toEqual(ports);
    expect(fetchMock).toHaveBeenCalledWith('/api/game/portNames', expect.any(Object));
  });
});
