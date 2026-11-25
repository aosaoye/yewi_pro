import {
  API_CANDIDATES,
  getActiveApiUrl,
  REQUEST_TIMEOUT_MS,
  setActiveApiUrl,
} from '@/config';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/lib/session';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  referenceId?: string;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    referenceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.referenceId = referenceId;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function unwrapEnvelope<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

let inflightRefresh: Promise<string | null> | null = null;
let inflightProbe: Promise<string | null> | null = null;
let hasLockedHost = false;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeWorkingHost(): Promise<string | null> {
  if (hasLockedHost || API_CANDIDATES.length <= 1) {
    return getActiveApiUrl();
  }
  if (inflightProbe) return inflightProbe;

  inflightProbe = (async () => {
    try {
      const winner = await Promise.any(
        API_CANDIDATES.map(async (candidate) => {
          const res = await fetchWithTimeout(
            `${candidate}/health`,
            { method: 'GET' },
            2500,
          );
          if (res.status > 0) {
            return candidate;
          }
          throw new Error('unreachable');
        }),
      );
      setActiveApiUrl(winner);
      hasLockedHost = true;
      return winner;
    } catch {
      return null;
    } finally {
      inflightProbe = null;
    }
  })();

  return inflightProbe;
}

async function refreshAccessToken(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetchWithTimeout(
        `${getActiveApiUrl()}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (!res.ok) {
        await clearSession();
        return null;
      }

      const raw = await res.json();
      const unwrapped = unwrapEnvelope<{
        accessToken?: string;
        refreshToken?: string;
      }>(raw);

      if (unwrapped?.accessToken) {
        await saveTokens(unwrapped.accessToken, unwrapped.refreshToken ?? null);
        return unwrapped.accessToken;
      }

      await clearSession();
      return null;
    } catch {
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
}

export interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipAuth?: boolean;
}

async function rawRequest<T>(
  path: string,
  options: RequestOptions = {},
  attempt = 0,
): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (!options.skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (!hasLockedHost && API_CANDIDATES.length > 1) {
    await probeWorkingHost();
  }

  const currentBase = getActiveApiUrl();
  const baseTargets = hasLockedHost
    ? [currentBase]
    : [currentBase, ...API_CANDIDATES.filter((c) => c !== currentBase)];

  const requestedTimeout = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const perCandidateTimeout =
    !hasLockedHost && baseTargets.length > 1 && !options.timeoutMs
      ? Math.min(requestedTimeout, 3000)
      : requestedTimeout;

  let res: Response | null = null;
  let lastNetErr: unknown = null;

  for (const base of baseTargets) {
    try {
      res = await fetchWithTimeout(
        `${base}${cleanPath}`,
        { ...options, headers },
        perCandidateTimeout,
      );
      setActiveApiUrl(base);
      hasLockedHost = true;
      break;
    } catch (err) {
      lastNetErr = err;
    }
  }

  if (!res) {
    if ((lastNetErr as Error)?.name === 'AbortError') {
      throw new ApiError(
        'Tiempo de espera agotado al conectar con el servidor',
        408,
      );
    }
    throw new ApiError(
      (lastNetErr as Error)?.message ||
        'No se pudo conectar con el servidor Yewi',
      0,
    );
  }

  if (
    res.status === 401 &&
    !options.skipAuth &&
    attempt === 0 &&
    !cleanPath.startsWith('/auth/login') &&
    !cleanPath.startsWith('/auth/refresh')
  ) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return rawRequest<T>(path, options, attempt + 1);
    }
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const errObj = parsed as { message?: string | string[]; error?: string } | null;
    const msg = Array.isArray(errObj?.message)
      ? errObj.message.join('. ')
      : errObj?.message || errObj?.error || `Error HTTP ${res.status}`;
    throw new ApiError(msg, res.status, parsed);
  }

  return unwrapEnvelope<T>(parsed);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    rawRequest<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    rawRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    rawRequest<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    rawRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    rawRequest<T>(path, {
      ...options,
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
