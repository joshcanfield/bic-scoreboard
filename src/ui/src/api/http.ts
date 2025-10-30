import type { components } from './game.types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const DEFAULT_BASE = '/api/game';
const JSON_CONTENT_TYPE = 'application/json';

const sanitizeEndpoint = (endpoint = ''): string => {
  if (!endpoint) return `${DEFAULT_BASE}/`;
  const trimmed = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${DEFAULT_BASE}/${trimmed}`;
};

const mergeInit = (init: RequestInit | undefined, method: HttpMethod): RequestInit => {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', JSON_CONTENT_TYPE);
  return {
    ...init,
    method,
    headers,
  };
};

async function request<TResponse = unknown>(
  method: HttpMethod,
  endpoint?: string,
  body?: unknown,
  init?: RequestInit
): Promise<TResponse> {
  const url = sanitizeEndpoint(endpoint);
  const finalInit = mergeInit(
    body === undefined
      ? init
      : {
          ...init,
          body: JSON.stringify(body),
        },
    method
  );

  const response = await fetch(url, finalInit);
  if (!response.ok) {
    throw new Error(`${method} ${endpoint ?? ''} failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes(JSON_CONTENT_TYPE)) {
    return response.json() as Promise<TResponse>;
  }

  return (response.text() as unknown) as TResponse;
}

export const api = {
  request,
  get: <T = unknown>(endpoint = '', init?: RequestInit) => request<T>('GET', endpoint, undefined, init),
  post: <T = unknown>(endpoint: string, body?: unknown, init?: RequestInit) =>
    request<T>('POST', endpoint, body, init),
  put: <T = unknown>(endpoint: string, body?: unknown, init?: RequestInit) =>
    request<T>('PUT', endpoint, body, init),
  del: <T = unknown>(endpoint: string, init?: RequestInit) => request<T>('DELETE', endpoint, undefined, init),
};

export type GameState = components['schemas']['GameState'];
export type GameUpdateRequest = components['schemas']['GameUpdateRequest'];
export type PortList = components['schemas']['PortList'];
export type PortSelection = components['schemas']['PortSelection'];
export type Team = components['schemas']['Team'];

export const gameApi = {
  getState: () => api.get<GameState>(''),
  reset: () => api.post<GameState>(''),
  update: (payload: GameUpdateRequest) => api.put<GameState>('', payload),
  listPorts: () => api.get<PortList>('portNames'),
  setPort: (payload: PortSelection) => api.post<PortList>('portName', payload),
  deletePenalty: (team: Team, penaltyId: string | number) =>
    api.del<void>(`${team}/penalty/${penaltyId}`),
  addPenalty: (team: Team, payload: unknown) => api.post<void>(`${team}/penalty`, payload),
};

export default api;
