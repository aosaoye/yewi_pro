import { useAuth, useClerk, useSignIn } from '@clerk/expo';
import { Link, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { useGoogleLogin, useLogin } from '@/api/hooks';
import { ClerkGoogleButton } from '@/components/ClerkGoogleButton';
import { CLERK_PUBLISHABLE_KEY } from '@/config';
import { biometricService } from '@/lib/biometricService';
import {
  extractClerkErrorCode,
  translateClerkError,
} from '@/lib/clerkErrorTranslator';
import {
  getLastClerkError,
  setClerkExchangeInFlight,
  setLastClerkError,
  subscribeClerkError,
} from '@/lib/clerkFlowLock';
import { resolveClerkSessionToken, withTimeout } from '@/lib/clerkSessionExchange';
import { loginSchema, otpSchema, zodErrorsToMap } from '@/lib/schemas';
import {
  Button,
  Divider,
  Field,
  FormScroll,
  NavHeader,
  Screen,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

type MfaVerifyKind = 'email_code' | 'phone_code' | 'totp';

interface LoginViewProps {
  mfaKind: MfaVerifyKind | null;
  mfaDestination: string;
  otpCode: string;
  onChangeOtpCode: (val: string) => void;
  onVerifyOtp: () => Promise<void>;
  onResendOtp: () => Promise<void>;
  onCancelOtp: () => void;
  onSubmitEmailPassword: (email: string, password: string) => Promise<void>;
  isBusy: boolean;
  externalError: string | null;
  onClearExternalError: () => void;
}

function LoginScreenView({
  mfaKind,
  mfaDestination,
  otpCode,
  onChangeOtpCode,
  onVerifyOtp,
  onResendOtp,
  onCancelOtp,
  onSubmitEmailPassword,
  isBusy,
  externalError,
  onClearExternalError,
}: LoginViewProps) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'email' | 'password' | 'otpCode', string>>
  >({});
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometría');

  const clearFieldError = (key: 'email' | 'password' | 'otpCode') => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    const initialErr = getLastClerkError();
    if (initialErr) {
      toast.error(initialErr);
    }
    const unsub = subscribeClerkError((err) => {
      if (err) toast.error(err);
    });
    return () => {
      unsub();
      setLastClerkError(null);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [avail, saved, label] = await Promise.all([
        biometricService.isAvailable(),
        biometricService.hasSavedCredentials(),
        biometricService.getBiometricLabel(),
      ]);
      if (mounted) {
        setBiometricReady(avail && saved);
        setBiometricLabel(label);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const externalFieldError = externalError || undefined;
  const emailError =
    fieldErrors.email ||
    (!mfaKind && externalFieldError && /correo|email|cuenta/i.test(externalFieldError)
      ? externalFieldError
      : undefined);
  const passwordError =
    fieldErrors.password ||
    (!mfaKind && externalFieldError && !emailError ? externalFieldError : undefined);
  const otpError =
    fieldErrors.otpCode || (mfaKind ? externalFieldError : undefined);

  const handleCredentialsSubmit = async () => {
    onClearExternalError();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(zodErrorsToMap<'email' | 'password'>(parsed.error));
      return;
    }
    setFieldErrors({});
    await onSubmitEmailPassword(
      parsed.data.email.toLowerCase(),
      parsed.data.password,
    );
  };

  const handleOtpSubmit = async () => {
    onClearExternalError();
    const parsed = otpSchema.safeParse({ otpCode });
    if (!parsed.success) {
      setFieldErrors(zodErrorsToMap<'otpCode'>(parsed.error));
      return;
    }
    setFieldErrors({});
    await onVerifyOtp();
  };

  const handleBiometric = async () => {
    onClearExternalError();
    const user = await biometricService.unlockWithBiometrics();
    if (user) {
      toast.success('Acceso biométrico verificado');
      router.replace('/(tabs)' as never);
    } else {
      toast.error('No se pudo validar la sesión biométrica guardada.');
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader
        title="Iniciar sesión"
        onBack={() => {
          if (mfaKind) {
            onCancelOtp();
          } else {
            router.replace('/(tabs)' as never);
          }
        }}
      />

      <FormScroll>
        <View style={{ gap: space.xs }}>
          {mfaKind ? (
            <Text variant="kicker" style={{ color: colors.accent }}>
              Verificación
            </Text>
          ) : null}
          <Text variant="display" style={{ color: colors.text }}>
            {mfaKind ? 'Confirma tu identidad' : 'Bienvenido'}
          </Text>
          <Text variant="body" tone="secondary">
            {mfaKind === 'totp'
              ? 'Introduce el código de tu app de autenticación.'
              : mfaKind
                ? `Código enviado a ${mfaDestination || email.trim()}.`
                : 'Entra con tu correo o Google.'}
          </Text>
        </View>

        {mfaKind ? (
          <View>
            <Field
              icon="key"
              label={
                mfaKind === 'totp'
                  ? 'Código de autenticación'
                  : 'Código de verificación'
              }
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={8}
              value={otpCode}
              error={otpError}
              onChangeText={(val) => {
                onChangeOtpCode(val);
                clearFieldError('otpCode');
                onClearExternalError();
              }}
            />
            <Button
              title="Verificar y entrar"
              icon="check"
              loading={isBusy}
              disabled={isBusy}
              onPress={() => void handleOtpSubmit()}
              style={{ marginTop: space.xs }}
            />
            {mfaKind !== 'totp' ? (
              <Button
                title="Reenviar código"
                variant="secondary"
                icon="refresh-cw"
                disabled={isBusy}
                onPress={() => void onResendOtp()}
                style={{ marginTop: space.sm }}
              />
            ) : null}
            <Button
              title="Volver al inicio de sesión"
              variant="ghost"
              disabled={isBusy}
              onPress={onCancelOtp}
              style={{ marginTop: space.xs }}
            />
          </View>
        ) : (
          <>
            <View>
              <Field
                icon="mail"
                label="Correo electrónico"
                placeholder="tu@correo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                error={emailError}
                onChangeText={(val) => {
                  setEmail(val);
                  clearFieldError('email');
                  onClearExternalError();
                }}
              />
              <Field
                icon="lock"
                label="Contraseña"
                placeholder="••••••••"
                secure
                value={password}
                error={passwordError}
                onChangeText={(val) => {
                  setPassword(val);
                  clearFieldError('password');
                  onClearExternalError();
                }}
              />
              <Button
                title="Entrar con correo"
                icon="log-in"
                loading={isBusy}
                disabled={isBusy}
                onPress={() => void handleCredentialsSubmit()}
                style={{ marginTop: space.xs }}
              />
            </View>

            <View style={s.orRow}>
              <View style={s.orLine}>
                <Divider />
              </View>
              <Text variant="caption" tone="muted">
                o
              </Text>
              <View style={s.orLine}>
                <Divider />
              </View>
            </View>

            <ClerkGoogleButton
              label="Continuar con Google"
              disabled={isBusy}
              onError={(msg) => {
                if (msg) toast.error(msg);
              }}
            />

            {biometricReady ? (
              <Button
                title={`Entrar con ${biometricLabel}`}
                variant="secondary"
                icon="fingerprint-pattern"
                disabled={isBusy}
                onPress={() => void handleBiometric()}
              />
            ) : null}
          </>
        )}

        <Divider />

        <View style={s.footerRow}>
          <Text variant="body" tone="secondary">
            ¿Todavía no tienes cuenta?
          </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text
                variant="label"
                style={{ color: colors.primary, fontWeight: '700' }}
              >
                Crear cuenta gratis
              </Text>
            </Pressable>
          </Link>
        </View>
      </FormScroll>
    </Screen>
  );
}

function ClerkLoginScreen() {
  const { signIn, errors: signInErrors, fetchStatus } = useSignIn();
  const { isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const loginMutation = useLogin();
  const { mutateAsync: googleLoginAsync } = useGoogleLogin();

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mfaKind, setMfaKind] = useState<MfaVerifyKind | null>(null);
  const [mfaDestination, setMfaDestination] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const finalizeAndExchangeClerk = async () => {
    const { error: finErr } = await signIn.finalize();
    if (finErr) {
      throw finErr;
    }

    const clerkToken = await withTimeout(
      resolveClerkSessionToken(getToken),
      8000,
      'Clerk inició sesión pero no devolvió el token de verificación a tiempo.',
    );

    if (!clerkToken) {
      throw new Error('No se pudo obtener el token de sesión de Clerk.');
    }

    const activeUser = clerk.user;
    await googleLoginAsync({
      idToken: clerkToken,
      name: activeUser?.fullName || activeUser?.firstName || undefined,
      avatarUrl: activeUser?.imageUrl || undefined,
    });

    setLastClerkError(null);
    toast.success('¡Bienvenido de nuevo a Yewi!');
    router.replace('/(tabs)' as never);
  };

  const handleClerkOrBackendPasswordLogin = async (
    normalizedEmail: string,
    pwd: string,
  ) => {
    setErrorMsg(null);
    setBusy(true);

    let backendAuthErr: unknown = null;
    try {
      await loginMutation.mutateAsync({
        email: normalizedEmail,
        password: pwd,
      });
      setLastClerkError(null);
      toast.success('¡Bienvenido de nuevo a Yewi!');
      router.replace('/(tabs)' as never);
      return;
    } catch (err) {
      const status =
        err instanceof ApiError
          ? err.status
          : (err as { status?: number })?.status;
      if (status !== 401) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No se pudo conectar con el servidor.',
        );
        setBusy(false);
        return;
      }
      backendAuthErr = err;
    }

    setClerkExchangeInFlight(true);

    try {
      if (isSignedIn) {
        try {
          await clerk.signOut();
        } catch {
          // noop
        }
      }

      if (signIn.status && !signIn.canBeDiscarded) {
        try {
          await signIn.reset();
        } catch {
          // noop
        }
      }

      const { error } = await signIn.password({
        emailAddress: normalizedEmail,
        password: pwd,
      });

      if (error) {
        const code = extractClerkErrorCode(error, signInErrors);
        const msgLower = (error.message || '').toLowerCase();

        if (
          code === 'form_identifier_not_found' ||
          msgLower.includes("couldn't find your account") ||
          msgLower.includes('identifier not found')
        ) {
          const backendMsg =
            backendAuthErr instanceof Error ? backendAuthErr.message : '';
          setErrorMsg(
            backendMsg === 'Credenciales inválidas'
              ? 'La contraseña introducida es incorrecta.'
              : 'No encontramos ninguna cuenta con este correo electrónico.',
          );
          return;
        }

        setErrorMsg(
          translateClerkError(
            error,
            'No se pudo iniciar sesión. Revisa tu correo y contraseña.',
            signInErrors,
          ),
        );
        return;
      }

      if (signIn.status === 'complete') {
        await finalizeAndExchangeClerk();
        return;
      }

      if (
        signIn.status === 'needs_second_factor' ||
        signIn.status === 'needs_client_trust'
      ) {
        const factors = signIn.supportedSecondFactors || [];
        const hasEmailFactor = factors.some(
          (f) => f.strategy === 'email_code',
        );
        const hasPhoneFactor = factors.some(
          (f) => f.strategy === 'phone_code',
        );
        const hasTotpFactor = factors.some((f) => f.strategy === 'totp');

        if (hasEmailFactor || (!hasPhoneFactor && !hasTotpFactor)) {
          const { error: sendErr } = await signIn.mfa.sendEmailCode();
          if (sendErr) {
            setErrorMsg(
              translateClerkError(
                sendErr,
                'No se pudo enviar el código de verificación.',
                signInErrors,
              ),
            );
            return;
          }
          setMfaDestination(normalizedEmail);
          setOtpCode('');
          setMfaKind('email_code');
          return;
        }

        if (hasPhoneFactor) {
          const { error: sendErr } = await signIn.mfa.sendPhoneCode();
          if (sendErr) {
            setErrorMsg(
              translateClerkError(
                sendErr,
                'No se pudo enviar el SMS de verificación.',
                signInErrors,
              ),
            );
            return;
          }
          setMfaDestination('tu teléfono registrado');
          setOtpCode('');
          setMfaKind('phone_code');
          return;
        }

        if (hasTotpFactor) {
          setMfaDestination('');
          setOtpCode('');
          setMfaKind('totp');
          return;
        }
      }

      setErrorMsg(
        'Tu cuenta requiere un paso adicional de verificación antes de entrar.',
      );
    } catch (err) {
      try {
        await clerk.signOut();
      } catch {
        // noop
      }
      setErrorMsg(
        translateClerkError(
          err,
          err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
          signInErrors,
        ),
      );
    } finally {
      setClerkExchangeInFlight(false);
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanCode = otpCode.trim();
    if (!cleanCode || !mfaKind) return;

    setErrorMsg(null);
    setBusy(true);
    setClerkExchangeInFlight(true);

    try {
      const { error } =
        mfaKind === 'email_code'
          ? await signIn.mfa.verifyEmailCode({ code: cleanCode })
          : mfaKind === 'phone_code'
            ? await signIn.mfa.verifyPhoneCode({ code: cleanCode })
            : await signIn.mfa.verifyTOTP({ code: cleanCode });

      if (error) {
        setErrorMsg(
          translateClerkError(
            error,
            'El código de verificación no es válido.',
            signInErrors,
          ),
        );
        return;
      }

      if (signIn.status === 'complete') {
        await finalizeAndExchangeClerk();
        return;
      }

      setErrorMsg('No se pudo completar la verificación de seguridad.');
    } catch (err) {
      setErrorMsg(
        translateClerkError(
          err,
          err instanceof Error
            ? err.message
            : 'No se pudo validar el código de verificación.',
          signInErrors,
        ),
      );
    } finally {
      setClerkExchangeInFlight(false);
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!mfaKind || mfaKind === 'totp') return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const { error } =
        mfaKind === 'email_code'
          ? await signIn.mfa.sendEmailCode()
          : await signIn.mfa.sendPhoneCode();
      if (error) {
        setErrorMsg(
          translateClerkError(
            error,
            'No se pudo reenviar el código.',
            signInErrors,
          ),
        );
        return;
      }
      toast.info('Hemos reenviado un nuevo código de verificación');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelOtp = () => {
    setErrorMsg(null);
    setOtpCode('');
    setMfaKind(null);
    void signIn.reset().catch(() => {});
  };

  return (
    <LoginScreenView
      mfaKind={mfaKind}
      mfaDestination={mfaDestination}
      otpCode={otpCode}
      onChangeOtpCode={setOtpCode}
      onVerifyOtp={handleVerifyOtp}
      onResendOtp={handleResendOtp}
      onCancelOtp={handleCancelOtp}
      onSubmitEmailPassword={handleClerkOrBackendPasswordLogin}
      isBusy={
        busy || fetchStatus === 'fetching' || loginMutation.isPending
      }
      externalError={errorMsg}
      onClearExternalError={() => setErrorMsg(null)}
    />
  );
}

function DirectLoginScreen() {
  const loginMutation = useLogin();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDirectLogin = async (normalizedEmail: string, pwd: string) => {
    setErrorMsg(null);
    try {
      await loginMutation.mutateAsync({
        email: normalizedEmail,
        password: pwd,
      });
      toast.success('¡Bienvenido de nuevo a Yewi!');
      router.replace('/(tabs)' as never);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
      );
    }
  };

  return (
    <LoginScreenView
      mfaKind={null}
      mfaDestination=""
      otpCode=""
      onChangeOtpCode={() => {}}
      onVerifyOtp={async () => {}}
      onResendOtp={async () => {}}
      onCancelOtp={() => {}}
      onSubmitEmailPassword={handleDirectLogin}
      isBusy={loginMutation.isPending}
      externalError={errorMsg}
      onClearExternalError={() => setErrorMsg(null)}
    />
  );
}

export default function LoginScreen() {
  if (CLERK_PUBLISHABLE_KEY) {
    return <ClerkLoginScreen />;
  }
  return <DirectLoginScreen />;
}

const s = StyleSheet.create({
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  orLine: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
