import { getClerkInstance } from '@clerk/expo';
import { CLERK_PUBLISHABLE_KEY } from '@/config';

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Obtiene el JWT activo de Clerk tras `finalize()` o `setActive()`,
 * reintentando brevemente mientras el cliente propaga la sesión.
 */
export async function resolveClerkSessionToken(
  getToken: () => Promise<string | null>,
  attempts = 6,
  delayMs = 250,
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const clerk = CLERK_PUBLISHABLE_KEY
      ? getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY })
      : null;
    const token =
      (await getToken().catch(() => null)) ||
      (await clerk?.session?.getToken().catch(() => null)) ||
      null;
    if (token) return token;
    if (attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

/**
 * Espera brevemente hasta que Clerk termine su inicialización inicial (`loaded === true`)
 * antes de lanzar un flujo interactivo OAuth/Google.
 */
export async function waitForClerkReady(
  isLoadedNow: boolean,
  timeoutMs = 6000,
): Promise<boolean> {
  if (isLoadedNow || !CLERK_PUBLISHABLE_KEY) {
    return Boolean(isLoadedNow);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const clerk = getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY });
      if (clerk?.loaded) {
        return true;
      }
    } catch {
      // Clerk aún montando instancia inicial
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  try {
    return Boolean(
      getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY })?.loaded,
    );
  } catch {
    return false;
  }
}
