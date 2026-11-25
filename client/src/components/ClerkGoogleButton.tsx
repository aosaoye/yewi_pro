import { getClerkInstance, useAuth, useUser } from '@clerk/expo';
import { useSignInWithGoogle } from '@clerk/expo/google';
import { requireOptionalNativeModule } from 'expo';
import * as Linking from 'expo-linking';
import { router, usePathname } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useGoogleLogin } from '@/api/hooks';
import { qk } from '@/api/keys';
import { authApi } from '@/api/services';
import type { AuthResponse, UserRole } from '@/api/types';
import { CLERK_PUBLISHABLE_KEY, getActiveApiUrl } from '@/config';
import { translateClerkError } from '@/lib/clerkErrorTranslator';
import {
  setClerkExchangeInFlight,
  setLastClerkError,
  setPendingClerkRoles,
} from '@/lib/clerkFlowLock';
import {
  resolveClerkSessionToken,
  waitForClerkReady,
  withTimeout,
} from '@/lib/clerkSessionExchange';
import { queryClient } from '@/lib/queryClient';
import { getAccessToken, saveCachedUser, saveTokens } from '@/lib/session';
import { usePreferencesStore } from '@/lib/stores';
import { Button, toast } from '@/ui';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID?.trim() || '';
const GOOGLE_IOS_URL_SCHEME =
  process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME?.trim() || '';

function isNativeGoogleSignInSupported(): boolean {
  if (Platform.OS === 'web' || !GOOGLE_WEB_CLIENT_ID) return false;
  if (Platform.OS === 'ios' && !GOOGLE_IOS_URL_SCHEME) return false;
  try {
    return Boolean(requireOptionalNativeModule('ClerkGoogleSignIn'));
  } catch {
    return false;
  }
}

function extractNonce(url: string): string {
  const parsed = Linking.parse(url);
  const raw = parsed.queryParams?.rotating_token_nonce;
  if (typeof raw === 'string') return raw;
  const match = /[?&]rotating_token_nonce=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : '';
}

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#EA4335"
        d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.19 14.97 0 12 0 7.31 0 3.26 2.69 1.29 6.61l3.68 2.85C5.84 6.91 8.67 5 12 5z"
      />
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.17-2 3.71-4.94 3.71-8.7z"
      />
      <Path
        fill="#FBBC05"
        d="M4.97 14.54c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L1.29 7.51C.47 9.15 0 10.99 0 12.45c0 1.46.47 3.3 1.29 4.94l3.68-2.85z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.08.72-2.45 1.16-4.22 1.16-3.33 0-6.16-2.24-7.03-5.26L1.29 16.96C3.26 21.31 7.31 24 12 24z"
      />
    </Svg>
  );
}

export interface ClerkGoogleButtonProps {
  label?: string;
  roles?: UserRole[];
  disabled?: boolean;
  onError?: (msg: string | null) => void;
}

interface SessionCandidate {
  createdSessionId?: string | null;
  preExchangedAuth?: AuthResponse | null;
  setActive?: ((params: { session: string }) => Promise<void>) | null;
  authSessionResult?: unknown;
  signIn?: { createdSessionId?: string | null } | null;
  signUp?: { createdSessionId?: string | null; missingFields?: string[] } | null;
}

async function persistWatcherAuth(authRes: AuthResponse): Promise<void> {
  await saveTokens(authRes.accessToken, authRes.refreshToken);
  await saveCachedUser(authRes.user);
  queryClient.setQueryData(qk.me(), authRes.user);
}

function useClerkGoogleController({
  roles,
  disabled,
  onError,
}: ClerkGoogleButtonProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { mutateAsync: googleLoginAsync } = useGoogleLogin();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (Platform.OS !== 'web') {
      void WebBrowser.warmUpAsync().catch(() => {});
    }
    return () => {
      mountedRef.current = false;
      if (Platform.OS !== 'web') {
        void WebBrowser.coolDownAsync().catch(() => {});
      }
    };
  }, []);

  const safeSetBusy = (val: boolean) => {
    if (mountedRef.current) setBusy(val);
  };

  const navigateAfterAuth = (authUser?: AuthResponse['user'] | null) => {
    const isProRole =
      Boolean(roles?.includes('PROFESSIONAL')) ||
      Boolean(authUser?.roles?.includes('PROFESSIONAL'));
    const missingFiscal = isProRole && !authUser?.professionalProfile?.taxId;
    if (isProRole) {
      usePreferencesStore.getState().setActiveRole('PROFESSIONAL');
    }
    if (missingFiscal) {
      toast.info('Completa tus datos fiscales y actividad profesional');
      router.replace('/(tabs)/profile/professional' as never);
      return;
    }
    toast.success('¡Bienvenido a Yewi!');
    router.replace('/(tabs)' as never);
  };

  const exchangeAndNavigate = async (clerkJwt: string) => {
    const clerk = getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY });
    const activeUser = user || clerk?.user;
    const authRes = await googleLoginAsync({
      idToken: clerkJwt,
      name: activeUser?.fullName || activeUser?.firstName || undefined,
      avatarUrl: activeUser?.imageUrl || undefined,
      roles,
    });
    setLastClerkError(null);
    navigateAfterAuth(authRes?.user);
  };

  const runDirectClerkGoogleOAuth = async (
    appRedirectUrl: string,
  ): Promise<SessionCandidate> => {
    const clerk = getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY });
    const signIn = clerk?.client?.signIn;
    const signUp = clerk?.client?.signUp;
    if (!signIn) {
      throw new Error('Cliente SSO de Clerk no inicializado.');
    }

    const apiBase = getActiveApiUrl();
    const canUseHttpBounce =
      Platform.OS === 'android' &&
      /^https?:\/\//i.test(apiBase) &&
      !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiBase);
    const bounceUrl = canUseHttpBounce
      ? `${apiBase.replace(/\/+$/, '')}/auth/clerk/oauth-callback`
      : undefined;

    const ensured = await withTimeout(
      authApi.ensureClerkRedirectUrl(
        bounceUrl || appRedirectUrl,
        appRedirectUrl,
        bounceUrl,
      ),
      6000,
      'timeout',
    ).catch(() => null);

    const effectiveRedirectUrl =
      bounceUrl && ensured?.registered ? bounceUrl : appRedirectUrl;

    await signIn.create({
      strategy: 'oauth_google',
      redirectUrl: effectiveRedirectUrl,
    });

    const verificationUrl =
      signIn.firstFactorVerification?.externalVerificationRedirectURL;
    if (!verificationUrl) {
      throw new Error('Clerk no devolvió la URL de verificación de Google.');
    }

    const deepLinkState: { url: string | null } = { url: null };
    let browserDone = false;
    const watchedState: {
      result: {
        completed: boolean;
        sessionId: string | null;
        rotatingTokenNonce: string | null;
        auth: AuthResponse | null;
      } | null;
    } = { result: null };

    const buildWatchedCandidate = async (
      watched: NonNullable<typeof watchedState.result>,
    ): Promise<SessionCandidate> => {
      if (watched.auth) {
        await persistWatcherAuth(watched.auth);
      }
      if (watched.sessionId && clerk.setActive) {
        void clerk.setActive({ session: watched.sessionId }).catch(() => {});
      }
      return {
        createdSessionId: watched.sessionId || 'watched',
        preExchangedAuth: watched.auth,
        authSessionResult: { type: 'success' },
        signIn,
        signUp,
        setActive: clerk.setActive?.bind(clerk),
      };
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (
        url &&
        (url.includes('sso-callback') || url.includes('rotating_token_nonce'))
      ) {
        deepLinkState.url = url;
        if (Platform.OS !== 'android') {
          try {
            WebBrowser.dismissAuthSession();
          } catch {
            // noop
          }
        }
      }
    });

    const clerkClientId = clerk?.client?.id;
    const signInAttemptId = signIn.id || undefined;
    if (clerkClientId && Platform.OS !== 'web') {
      void (async () => {
        while (!browserDone) {
          try {
            const res = await authApi.watchClerkOAuth({
              clientId: clerkClientId,
              signInId: signInAttemptId,
              roles,
            });
            if (res?.completed) {
              watchedState.result = res;
              if (Platform.OS !== 'android') {
                try {
                  WebBrowser.dismissAuthSession();
                } catch {
                  // noop
                }
              }
              return;
            }
          } catch {
            // El navegador sigue abierto; reintentar brevemente
          }
          if (!browserDone) {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      })();
    }

    let authSessionResult: WebBrowser.WebBrowserAuthSessionResult;
    try {
      authSessionResult = await WebBrowser.openAuthSessionAsync(
        verificationUrl.toString(),
        appRedirectUrl,
        Platform.OS === 'android'
          ? { createTask: false, showInRecents: false }
          : undefined,
      );
      if (
        authSessionResult.type !== 'success' &&
        !deepLinkState.url &&
        !watchedState.result
      ) {
        await new Promise((r) => setTimeout(r, 450));
      }
    } finally {
      browserDone = true;
      sub.remove();
    }

    if (watchedState.result?.auth) {
      return await buildWatchedCandidate(watchedState.result);
    }

    const callbackUrl =
      authSessionResult.type === 'success' && authSessionResult.url
        ? authSessionResult.url
        : deepLinkState.url;

    if (
      !callbackUrl &&
      !watchedState.result &&
      clerkClientId &&
      Platform.OS !== 'web'
    ) {
      const finalWatch = await withTimeout(
        authApi.watchClerkOAuth({
          clientId: clerkClientId,
          signInId: signInAttemptId,
          roles,
        }),
        1800,
        'timeout',
      ).catch(() => null);

      if (finalWatch?.completed) {
        watchedState.result = finalWatch;
        if (finalWatch.auth) {
          return await buildWatchedCandidate(finalWatch);
        }
      }
    }

    const effectiveNonce =
      (callbackUrl ? extractNonce(callbackUrl) : '') ||
      watchedState.result?.rotatingTokenNonce ||
      '';

    if (!callbackUrl && !effectiveNonce) {
      return {
        createdSessionId: null,
        authSessionResult,
        signIn,
        signUp,
        setActive: clerk.setActive?.bind(clerk),
      };
    }

    await signIn.reload(
      effectiveNonce ? { rotatingTokenNonce: effectiveNonce } : undefined,
    );

    if (signIn.firstFactorVerification?.status === 'transferable' && signUp) {
      await signUp.create({ transfer: true });
    }

    return {
      createdSessionId: signUp?.createdSessionId ?? signIn.createdSessionId ?? null,
      authSessionResult: {
        type: 'success',
        url: callbackUrl || appRedirectUrl,
      },
      signIn,
      signUp,
      setActive: clerk.setActive?.bind(clerk),
    };
  };

  const runOAuthFlow = async (): Promise<SessionCandidate> => {
    if (Platform.OS !== 'web' && Platform.OS !== 'android') {
      try {
        WebBrowser.dismissAuthSession();
      } catch {
        // noop
      }
    }

    const redirectUrl = Linking.createURL('sso-callback');
    return await withTimeout(
      runDirectClerkGoogleOAuth(redirectUrl),
      45000,
      'La autorización con Google tardó demasiado en regresar a la app.',
    );
  };

  const executeAuth = async (runner: () => Promise<SessionCandidate>) => {
    if (busy || disabled) return;
    onError?.(null);
    setLastClerkError(null);
    setPendingClerkRoles(roles);

    safeSetBusy(true);

    try {
      await waitForClerkReady(isLoaded, 6000);

      if (isSignedIn) {
        setClerkExchangeInFlight(true);
        const existingJwt = await withTimeout(
          resolveClerkSessionToken(getToken),
          8000,
          'No se pudo obtener el token de sesión activa en Clerk.',
        );
        if (existingJwt) {
          await exchangeAndNavigate(existingJwt);
          return;
        }
        setClerkExchangeInFlight(false);
      }

      const res = await runner();
      if (res.preExchangedAuth) {
        await persistWatcherAuth(res.preExchangedAuth);
        setLastClerkError(null);
        navigateAfterAuth(res.preExchangedAuth.user);
        return;
      }

      const authType = (res.authSessionResult as { type?: string } | null)?.type;
      const sessionId =
        res.createdSessionId ??
        res.signIn?.createdSessionId ??
        res.signUp?.createdSessionId;

      if ((authType === 'cancel' || authType === 'dismiss') && !sessionId) {
        const alreadyJwt = await getAccessToken();
        if (alreadyJwt) {
          setLastClerkError(null);
          toast.success('¡Bienvenido a Yewi!');
          router.replace('/(tabs)' as never);
          return;
        }

        const resolvedLater = await resolveClerkSessionToken(getToken, 2, 200);
        if (resolvedLater) {
          setClerkExchangeInFlight(true);
          await exchangeAndNavigate(resolvedLater);
          return;
        }

        toast.info('Inicio de sesión con Google cancelado');
        if (pathnameRef.current === '/sso-callback') {
          router.replace('/(auth)/login' as never);
        }
        return;
      }

      if (!sessionId || !res.setActive) {
        const missing = res.signUp?.missingFields;
        const msg =
          Array.isArray(missing) && missing.length > 0
            ? `Clerk solicita campos adicionales (${missing.join(', ')}) antes de completar el alta.`
            : 'No se pudo completar la autorización con Google en Clerk.';
        setLastClerkError(msg);
        onError?.(msg);
        toast.error(msg);
        if (pathnameRef.current === '/sso-callback') {
          router.replace('/(auth)/login' as never);
        }
        return;
      }

      setClerkExchangeInFlight(true);
      await withTimeout(
        res.setActive({ session: sessionId }),
        12000,
        'Clerk tardó demasiado en activar la sesión.',
      );

      const clerkToken = await withTimeout(
        resolveClerkSessionToken(getToken),
        8000,
        'Clerk activó la sesión pero no devolvió el JWT a tiempo.',
      );

      if (!clerkToken) {
        throw new Error('Clerk no devolvió un token de sesión válido.');
      }

      await exchangeAndNavigate(clerkToken);
    } catch (err) {
      const msg = translateClerkError(
        err,
        'No se pudo iniciar sesión con Google en Yewi.',
      );
      setLastClerkError(msg);
      onError?.(msg);
      toast.error(msg);
      try {
        await getClerkInstance({
          publishableKey: CLERK_PUBLISHABLE_KEY,
        })?.signOut();
      } catch {
        // noop
      }
      if (pathnameRef.current === '/sso-callback') {
        router.replace('/(auth)/login' as never);
      }
    } finally {
      setClerkExchangeInFlight(false);
      safeSetBusy(false);
    }
  };

  return { busy, executeAuth, runOAuthFlow };
}

function ClerkNativeGoogleInner(props: ClerkGoogleButtonProps) {
  const { busy, executeAuth, runOAuthFlow } = useClerkGoogleController(props);
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const label = props.label || 'Continuar con Google';

  const handlePress = () =>
    void executeAuth(async () => {
      try {
        const nativeRes = await withTimeout(
          startGoogleAuthenticationFlow(),
          30000,
          'El selector nativo de Google tardó demasiado.',
        );
        if (nativeRes?.createdSessionId) {
          return nativeRes;
        }
      } catch (err) {
        const errCode = (err as { code?: string })?.code;
        const msg = err instanceof Error ? err.message : String(err);
        if (errCode === 'SIGN_IN_CANCELLED' || /cancel/i.test(msg)) {
          return {
            createdSessionId: null,
            authSessionResult: { type: 'cancel' },
          };
        }
        // Si Credential Manager / One Tap no está disponible en este dispositivo, fallback a OAuth
      }
      return runOAuthFlow();
    });

  return (
    <Button
      variant="outline"
      title={busy ? 'Conectando con Google...' : label}
      leftSlot={!busy ? <GoogleLogo /> : undefined}
      loading={busy}
      disabled={props.disabled || busy}
      onPress={handlePress}
    />
  );
}

function ClerkOAuthGoogleInner(props: ClerkGoogleButtonProps) {
  const { busy, executeAuth, runOAuthFlow } = useClerkGoogleController(props);
  const label = props.label || 'Continuar con Google';

  return (
    <Button
      variant="outline"
      title={busy ? 'Conectando con Google...' : label}
      leftSlot={!busy ? <GoogleLogo /> : undefined}
      loading={busy}
      disabled={props.disabled || busy}
      onPress={() => void executeAuth(runOAuthFlow)}
    />
  );
}

export function ClerkGoogleButton(props: ClerkGoogleButtonProps) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <Button
        variant="outline"
        title={props.label || 'Continuar con Google'}
        leftSlot={<GoogleLogo />}
        disabled={props.disabled}
        onPress={() =>
          props.onError?.(
            'Configura EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY en .env para iniciar sesión con Google.',
          )
        }
      />
    );
  }

  if (isNativeGoogleSignInSupported()) {
    return <ClerkNativeGoogleInner {...props} />;
  }

  return <ClerkOAuthGoogleInner {...props} />;
}
