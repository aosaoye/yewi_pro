import { useAuth, useClerk, useUser } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { useGoogleLogin } from '@/api/hooks';
import { isClerkExchangeInFlight, setClerkExchangeInFlight } from '@/lib/clerkFlowLock';
import { getAccessToken } from '@/lib/session';

/**
 * Sincroniza sesiones OAuth/Google provenientes de Clerk con el backend Yewi.
 * Solo se monta cuando EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY está configurada.
 */
export function ClerkAuthSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { mutateAsync: syncGoogleLogin } = useGoogleLogin();
  const attemptedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      attemptedUserIdRef.current = null;
      return;
    }
    if (isClerkExchangeInFlight()) return;
    if (attemptedUserIdRef.current === user.id) return;

    let cancelled = false;
    (async () => {
      // Pequeña espera para no competir con ClerkGoogleButton si acaba de activar sesión
      await new Promise((r) => setTimeout(r, 350));
      if (cancelled || isClerkExchangeInFlight()) return;

      const existingJwt = await getAccessToken();
      if (existingJwt || cancelled) return;

      attemptedUserIdRef.current = user.id;
      setClerkExchangeInFlight(true);
      try {
        const clerkToken = await getToken();
        if (!clerkToken || cancelled) return;

        await syncGoogleLogin({
          idToken: clerkToken,
          name: user.fullName || user.firstName || undefined,
          avatarUrl: user.imageUrl || undefined,
        });
      } catch {
        try {
          await signOut();
        } catch {
          // noop
        }
      } finally {
        setClerkExchangeInFlight(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, signOut, syncGoogleLogin, user]);

  return null;
}
