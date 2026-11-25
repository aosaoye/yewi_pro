import { getClerkInstance, useAuth, useClerk, useUser } from '@clerk/expo';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useGoogleLogin } from '@/api/hooks';
import { CLERK_PUBLISHABLE_KEY } from '@/config';
import {
  getLastClerkError,
  getPendingClerkRoles,
  isClerkExchangeInFlight,
  setClerkExchangeInFlight,
  setLastClerkError,
  subscribeClerkError,
} from '@/lib/clerkFlowLock';
import { getAccessToken } from '@/lib/session';
import { usePreferencesStore } from '@/lib/stores';
import { Banner, Button, Screen, Spinner, space } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

function SsoCallbackClerkHandler() {
  const params = useLocalSearchParams<{ rotating_token_nonce?: string }>();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { mutateAsync: googleLoginAsync } = useGoogleLogin();

  const [errorMsg, setErrorMsg] = useState<string | null>(() =>
    getLastClerkError(),
  );
  const [timedOut, setTimedOut] = useState(false);

  const authFnsRef = useRef({ getToken, googleLoginAsync, signOut });
  useEffect(() => {
    authFnsRef.current = { getToken, googleLoginAsync, signOut };
  }, [getToken, googleLoginAsync, signOut]);
  const nonceAttemptedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeClerkError((err) => {
      if (err) setErrorMsg(err);
    });
    const deadline = setTimeout(() => setTimedOut(true), 7000);
    return () => {
      unsub();
      clearTimeout(deadline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const completeCallback = async () => {
      if (completedRef.current) return;

      const existingToken = await getAccessToken();
      if (existingToken) {
        completedRef.current = true;
        if (!cancelled) {
          router.replace('/(tabs)' as never);
        }
        return;
      }

      if (!isLoaded) return;

      // Si Android abrió /sso-callback directamente vía intent con rotating_token_nonce
      // y startSSOFlow no completó reload, intentamos recargar signIn desde Clerk instance.
      const nonce =
        typeof params.rotating_token_nonce === 'string'
          ? params.rotating_token_nonce
          : '';
      if (!isSignedIn && nonce && !nonceAttemptedRef.current) {
        nonceAttemptedRef.current = true;
        try {
          const clerk = getClerkInstance({
            publishableKey: CLERK_PUBLISHABLE_KEY,
          });
          const signIn = clerk?.client?.signIn;
          if (signIn && typeof signIn.reload === 'function') {
            await signIn.reload({ rotatingTokenNonce: nonce });
            if (
              signIn.firstFactorVerification?.status === 'transferable' &&
              clerk?.client?.signUp
            ) {
              await clerk.client.signUp.create({ transfer: true });
            }
            const createdId =
              clerk?.client?.signUp?.createdSessionId ||
              signIn.createdSessionId;
            if (createdId && typeof clerk?.setActive === 'function') {
              await clerk.setActive({ session: createdId });
            }
          }
        } catch (e) {
          console.warn('[SSO Callback] Error procesando nonce:', e);
        }
      }

      if (!isSignedIn) return;

      // Si ClerkGoogleButton está procesando activamente el intercambio, esperamos
      // brevemente antes de tomar el relevo.
      if (isClerkExchangeInFlight()) {
        await new Promise((r) => setTimeout(r, 900));
        if (cancelled || completedRef.current) return;
        const tokenAfterWait = await getAccessToken();
        if (tokenAfterWait) {
          completedRef.current = true;
          router.replace('/(tabs)' as never);
          return;
        }
        if (isClerkExchangeInFlight()) return;
      }

      setClerkExchangeInFlight(true);
      try {
        const clerk = getClerkInstance({
          publishableKey: CLERK_PUBLISHABLE_KEY,
        });
        let clerkToken: string | null = null;
        for (let i = 0; i < 4; i++) {
          clerkToken =
            (await authFnsRef.current.getToken().catch(() => null)) ||
            (await clerk?.session?.getToken().catch(() => null)) ||
            null;
          if (clerkToken) break;
          await new Promise((r) => setTimeout(r, 250));
        }

        if (!clerkToken) {
          throw new Error(
            'Clerk no devolvió un token de sesión tras elegir tu cuenta.',
          );
        }

        const activeUser = user || clerk?.user;
        const pendingRoles = getPendingClerkRoles();
        const authRes = await authFnsRef.current.googleLoginAsync({
          idToken: clerkToken,
          name: activeUser?.fullName || activeUser?.firstName || undefined,
          avatarUrl: activeUser?.imageUrl || undefined,
          roles: pendingRoles,
        });

        completedRef.current = true;
        setLastClerkError(null);
        if (!cancelled) {
          const isProRole =
            Boolean(pendingRoles?.includes('PROFESSIONAL')) ||
            Boolean(authRes?.user?.roles?.includes('PROFESSIONAL'));
          const missingFiscal =
            isProRole && !authRes?.user?.professionalProfile?.taxId;
          if (isProRole) {
            usePreferencesStore.getState().setActiveRole('PROFESSIONAL');
          }
          router.replace(
            (missingFiscal ? '/(tabs)/profile/professional' : '/(tabs)') as never,
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'No se pudo completar la autenticación con Google.';
        console.warn('[SSO Callback] Error:', msg);
        setLastClerkError(msg);
        if (!cancelled) {
          setErrorMsg(msg);
        }
        try {
          await authFnsRef.current.signOut();
        } catch {
          // noop
        }
      } finally {
        setClerkExchangeInFlight(false);
      }
    };

    void completeCallback();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, params.rotating_token_nonce, user]);

  if (errorMsg || (timedOut && (!isLoaded || !isSignedIn))) {
    return (
      <View style={{ width: '100%', paddingHorizontal: space.xl, gap: space.md }}>
        <Banner
          tone={errorMsg ? 'danger' : 'warn'}
          title="Autenticación con Google"
          message={
            errorMsg ||
            'No recibimos confirmación completa de Google. Vuelve a intentarlo o accede con tu correo.'
          }
        />
        <Button
          title="Volver al inicio de sesión"
          onPress={() => {
            setLastClerkError(null);
            router.replace('/(auth)/login' as never);
          }}
        />
      </View>
    );
  }

  return <Spinner label="Completando inicio de sesión..." />;
}

export default function SsoCallbackScreen() {
  useEffect(() => {
    if (!CLERK_PUBLISHABLE_KEY) {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login' as never);
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {CLERK_PUBLISHABLE_KEY ? (
          <SsoCallbackClerkHandler />
        ) : (
          <Spinner label="Redirigiendo..." />
        )}
      </View>
    </Screen>
  );
}
