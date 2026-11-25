const DEFAULT_PORT = 3000;
const DEFAULT_PREFIX = '/api/v1';

export function isLoopbackUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url.trim());
}

export function extractHostFromUri(rawUri?: string | null): string | null {
  if (!rawUri) return null;
  const cleaned = rawUri.trim().replace(/^[a-zA-Z]+:\/\//, '');
  const hostPort = cleaned.split('/')[0] ?? '';
  const host = hostPort.split(':')[0]?.trim();
  return host || null;
}

export function toRealtimeOrigin(apiUrl: string): string {
  return apiUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');
}

/**
 * Construye candidatos ordenados para conectar con la API según entorno:
 * - En Web o URL remota explícita: usa directamente `configuredUrl`.
 * - En Android con `configuredUrl` apuntando a localhost/vacío: evita usar
 *   `localhost` como primer intento (en Android `localhost` es el propio móvil),
 *   priorizando la IP LAN del bundler Expo (`packagerHost`) y `10.0.2.2` para emulador.
 */
export function buildApiUrlCandidates(params: {
  configuredUrl?: string | null;
  packagerHost?: string | null;
  platformOs: string;
}): string[] {
  const configured = params.configuredUrl?.trim().replace(/\/+$/, '') || '';
  const os = params.platformOs;

  if (configured && (os === 'web' || !isLoopbackUrl(configured))) {
    return [configured];
  }

  if (os === 'web') {
    return [`http://localhost:${DEFAULT_PORT}${DEFAULT_PREFIX}`];
  }

  const candidates: string[] = [];
  const host = params.packagerHost?.trim();

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    candidates.push(`http://${host}:${DEFAULT_PORT}${DEFAULT_PREFIX}`);
  }

  if (os === 'android') {
    candidates.push(`http://10.0.2.2:${DEFAULT_PORT}${DEFAULT_PREFIX}`);
  }

  if (configured) {
    candidates.push(configured);
  }

  candidates.push(`http://localhost:${DEFAULT_PORT}${DEFAULT_PREFIX}`);
  candidates.push(`http://127.0.0.1:${DEFAULT_PORT}${DEFAULT_PREFIX}`);

  return Array.from(new Set(candidates));
}
