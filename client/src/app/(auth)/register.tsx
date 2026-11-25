import { Link, router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRegister } from '@/api/hooks';
import { authApi } from '@/api/services';
import type { UserRole } from '@/api/types';
import { AddressAutocomplete, type AddressFields } from '@/components/AddressAutocomplete';
import { ClerkGoogleButton } from '@/components/ClerkGoogleButton';
import { PhoneInput } from '@/components/PhoneInput';
import {
  getLastClerkError,
  setLastClerkError,
  subscribeClerkError,
} from '@/lib/clerkFlowLock';
import {
  buildRegisterLocationSchema,
  otpSchema,
  registerBusinessSchema,
  registerCredentialsSchema,
  registerNameSchema,
  zodErrorsToMap,
} from '@/lib/schemas';
import { usePreferencesStore } from '@/lib/stores';
import {
  isValidSpanishPostalCode,
  validatePhoneNumber,
} from '@/lib/validation';
import {
  Button,
  Divider,
  Field,
  FormScroll,
  NavHeader,
  PillTab,
  Screen,
  space,
  Stepper,
  type StepItem,
  Text,
  toast,
  useTheme,
} from '@/ui';

type StepKey =
  | 'account'
  | 'name'
  | 'credentials'
  | 'location'
  | 'business'
  | 'verify';

interface RegisterStep extends StepItem {
  key: StepKey;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  roleType: 'CLIENT' | 'PROFESSIONAL';
  phoneNumber?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  region?: string;
  address?: string;
  businessName?: string;
  taxId?: string;
  bio?: string;
  skills?: string[];
}

interface RegisterWizardProps {
  clerkEnabled: boolean;
  isSubmitting: boolean;
  externalError: string | null;
  onClearExternalError: () => void;
  onSubmitRegistration: (
    payload: RegisterPayload,
  ) => Promise<'completed' | 'needs_email_verification'>;
  onVerifyEmailCode?: (
    code: string,
    payload: RegisterPayload,
  ) => Promise<void>;
  onResendEmailCode?: () => Promise<void>;
  onResetFlow?: () => void;
}

function RegisterWizard({
  clerkEnabled,
  isSubmitting,
  externalError,
  onClearExternalError,
  onSubmitRegistration,
  onVerifyEmailCode,
  onResendEmailCode,
  onResetFlow,
}: RegisterWizardProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [checkingStep, setCheckingStep] = useState(false);

  const [roleType, setRoleType] = useState<'CLIENT' | 'PROFESSIONAL'>('CLIENT');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countryCode, setCountryCode] = useState<'ES' | 'FR' | 'GB'>('ES');
  const [countryPrefix, setCountryPrefix] = useState('+34');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [bio, setBio] = useState('');
  const [addressInfo, setAddressInfo] = useState<AddressFields>({
    city: 'Madrid',
    postalCode: '28001',
    province: 'Madrid',
    region: 'Comunidad de Madrid',
    address: '',
  });
  const [pendingPayload, setPendingPayload] = useState<RegisterPayload | null>(
    null,
  );
  type RegFieldKey =
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'businessName'
    | 'taxId'
    | 'city'
    | 'postalCode'
    | 'password'
    | 'confirmPassword'
    | 'otpCode';

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<RegFieldKey, string>>
  >({});

  const clearFieldError = (key: RegFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    const initialErr = getLastClerkError();
    if (initialErr) toast.error(initialErr);
    const unsub = subscribeClerkError((err) => {
      if (err) toast.error(err);
    });
    return () => {
      unsub();
      setLastClerkError(null);
    };
  }, []);

  const steps: RegisterStep[] = useMemo(() => {
    const base: RegisterStep[] = [
      { key: 'account', title: 'Cuenta' },
      { key: 'name', title: 'Nombre' },
      { key: 'credentials', title: 'Acceso' },
      { key: 'location', title: 'Ubicación' },
    ];
    if (roleType === 'PROFESSIONAL') {
      base.push({ key: 'business', title: 'Negocio' });
    }
    if (clerkEnabled) {
      base.push({ key: 'verify', title: 'Código' });
    }
    return base;
  }, [clerkEnabled, roleType]);

  const currentStep = steps[Math.min(step, steps.length - 1)];
  const lastInputStepKey: StepKey =
    roleType === 'PROFESSIONAL' ? 'business' : 'location';
  const isFinalCreationStep = clerkEnabled
    ? currentStep.key === 'verify'
    : currentStep.key === lastInputStepKey;
  const selectedRoles: UserRole[] =
    roleType === 'PROFESSIONAL' ? ['CLIENT', 'PROFESSIONAL'] : ['CLIENT'];

  const clearAllErrors = () => {
    setFieldErrors({});
    onClearExternalError();
  };

  const handleSelectRole = (nextRole: 'CLIENT' | 'PROFESSIONAL') => {
    clearAllErrors();
    setRoleType(nextRole);
    setStep((prev) => Math.min(prev, nextRole === 'PROFESSIONAL' ? 4 : 3));
  };

  const handleBack = () => {
    clearAllErrors();
    if (currentStep.key === 'verify') {
      onResetFlow?.();
    }
    if (step > 0) {
      setStep((s) => Math.max(0, s - 1));
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login' as never);
    }
  };

  const formatPhoneIfProvided = (): string | undefined => {
    if (!phoneDigits.trim()) return undefined;
    const check = validatePhoneNumber(countryCode, countryPrefix, phoneDigits);
    if (!check.isValid) {
      throw new Error(check.message || 'Número de teléfono no válido.');
    }
    return check.e164;
  };

  const buildPayload = (formattedPhone?: string): RegisterPayload => {
    const parsedSkills =
      roleType === 'PROFESSIONAL' && bio.trim()
        ? bio
            .split(/[,.]+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 8)
        : undefined;
    return {
      email: email.trim().toLowerCase(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roles: selectedRoles,
      roleType,
      phoneNumber: formattedPhone,
      city: addressInfo.city.trim() || undefined,
      postalCode: addressInfo.postalCode.trim() || undefined,
      province: addressInfo.province?.trim() || undefined,
      region: addressInfo.region?.trim() || undefined,
      address: (addressInfo.address || '').trim() || undefined,
      businessName:
        roleType === 'PROFESSIONAL'
          ? businessName.trim() || `${firstName} ${lastName}`.trim()
          : undefined,
      taxId:
        roleType === 'PROFESSIONAL' && taxId.trim()
          ? taxId.trim().toUpperCase()
          : undefined,
      bio:
        roleType === 'PROFESSIONAL' && bio.trim() ? bio.trim() : undefined,
      skills: parsedSkills && parsedSkills.length > 0 ? parsedSkills : undefined,
    };
  };

  const routeServerErrorToField = (rawMessage: string) => {
    const lower = rawMessage.toLowerCase();
    if (
      lower.includes('correo') ||
      lower.includes('email') ||
      lower.includes('ya está registrado') ||
      lower.includes('ya existe una cuenta')
    ) {
      const credIdx = steps.findIndex((st) => st.key === 'credentials');
      if (credIdx >= 0) setStep(credIdx);
      setFieldErrors({ email: rawMessage });
      return;
    }
    if (lower.includes('teléfono') || lower.includes('telefono')) {
      const locIdx = steps.findIndex((st) => st.key === 'location');
      if (locIdx >= 0) setStep(locIdx);
      setFieldErrors({ phone: rawMessage });
      return;
    }
    if (lower.includes('nif') || lower.includes('cif') || lower.includes('nie')) {
      const bizIdx = steps.findIndex((st) => st.key === 'business');
      if (bizIdx >= 0) setStep(bizIdx);
      setFieldErrors({ taxId: rawMessage });
      return;
    }
    if (lower.includes('contraseña') || lower.includes('password')) {
      const credIdx = steps.findIndex((st) => st.key === 'credentials');
      if (credIdx >= 0) setStep(credIdx);
      setFieldErrors({ password: rawMessage });
      return;
    }
    toast.error(rawMessage);
  };

  const externalFieldMatch = useMemo<{
    field: RegFieldKey | null;
    message?: string;
  }>(() => {
    if (!externalError) return { field: null };
    if (currentStep.key === 'verify') {
      return { field: 'otpCode', message: externalError };
    }
    const lower = externalError.toLowerCase();
    if (
      lower.includes('correo') ||
      lower.includes('email') ||
      lower.includes('ya está registrado') ||
      lower.includes('ya existe una cuenta')
    ) {
      return { field: 'email', message: externalError };
    }
    if (lower.includes('teléfono') || lower.includes('telefono')) {
      return { field: 'phone', message: externalError };
    }
    if (lower.includes('nif') || lower.includes('cif') || lower.includes('nie')) {
      return { field: 'taxId', message: externalError };
    }
    if (lower.includes('contraseña') || lower.includes('password')) {
      return { field: 'password', message: externalError };
    }
    return { field: null };
  }, [externalError, currentStep.key]);

  const emailError =
    fieldErrors.email ||
    (externalFieldMatch.field === 'email' ? externalFieldMatch.message : undefined);
  const passwordError =
    fieldErrors.password ||
    (externalFieldMatch.field === 'password'
      ? externalFieldMatch.message
      : undefined);
  const phoneError =
    fieldErrors.phone ||
    (externalFieldMatch.field === 'phone' ? externalFieldMatch.message : undefined);
  const taxIdError =
    fieldErrors.taxId ||
    (externalFieldMatch.field === 'taxId' ? externalFieldMatch.message : undefined);
  const otpError =
    fieldErrors.otpCode ||
    (externalFieldMatch.field === 'otpCode' ? externalFieldMatch.message : undefined);

  const submitRegistrationNow = async () => {
    let formattedPhone: string | undefined;
    try {
      formattedPhone = formatPhoneIfProvided();
    } catch (err) {
      const locIdx = steps.findIndex((st) => st.key === 'location');
      if (locIdx >= 0) setStep(locIdx);
      setFieldErrors({
        phone: err instanceof Error ? err.message : 'Teléfono no válido.',
      });
      return;
    }

    setFieldErrors({});
    const payload = buildPayload(formattedPhone);
    setPendingPayload(payload);

    try {
      const outcome = await onSubmitRegistration(payload);
      if (outcome === 'needs_email_verification') {
        setOtpCode('');
        setStep(steps.length - 1);
      }
    } catch (err) {
      routeServerErrorToField(
        err instanceof Error ? err.message : 'No se pudo crear la cuenta.',
      );
    }
  };

  const handleNext = async () => {
    onClearExternalError();

    if (currentStep.key === 'account') {
      setFieldErrors({});
      setStep(1);
      return;
    }

    if (currentStep.key === 'name') {
      const parsed = registerNameSchema.safeParse({ firstName, lastName });
      if (!parsed.success) {
        setFieldErrors(zodErrorsToMap<RegFieldKey>(parsed.error));
        return;
      }
      setFieldErrors({});
      setStep(2);
      return;
    }

    if (currentStep.key === 'credentials') {
      const parsed = registerCredentialsSchema.safeParse({
        email,
        password,
        confirmPassword,
      });
      const nextErrs: Partial<Record<RegFieldKey, string>> = parsed.success
        ? {}
        : zodErrorsToMap<RegFieldKey>(parsed.error);

      if (!nextErrs.email) {
        setCheckingStep(true);
        try {
          const availability = await authApi.checkAvailability({
            email: email.trim().toLowerCase(),
          });
          if (availability.email && !availability.email.available) {
            nextErrs.email =
              availability.email.message ||
              'Este correo electrónico ya está registrado.';
          }
        } catch {
          // Validación final respaldada por backend
        } finally {
          setCheckingStep(false);
        }
      }

      if (Object.keys(nextErrs).length > 0) {
        setFieldErrors(nextErrs);
        return;
      }

      setFieldErrors({});
      setStep((s) => s + 1);
      return;
    }

    if (currentStep.key === 'location') {
      const locationSchema = buildRegisterLocationSchema(
        countryCode,
        countryPrefix,
      );
      const parsed = locationSchema.safeParse({
        phone: phoneDigits,
        city: addressInfo.city,
        postalCode: addressInfo.postalCode,
      });
      const nextErrs: Partial<Record<RegFieldKey, string>> = parsed.success
        ? {}
        : zodErrorsToMap<RegFieldKey>(parsed.error);

      if (!nextErrs.phone) {
        const phoneCheck = validatePhoneNumber(
          countryCode,
          countryPrefix,
          phoneDigits,
        );
        if (phoneCheck.e164) {
          setCheckingStep(true);
          try {
            const availability = await authApi.checkAvailability({
              phoneNumber: phoneCheck.e164,
            });
            if (availability.phoneNumber && !availability.phoneNumber.available) {
              nextErrs.phone =
                availability.phoneNumber.message ||
                'Este número de teléfono ya está registrado.';
            }
          } catch {
            // Validación final respaldada por backend
          } finally {
            setCheckingStep(false);
          }
        }
      }

      if (Object.keys(nextErrs).length > 0) {
        setFieldErrors(nextErrs);
        return;
      }

      if (roleType === 'PROFESSIONAL') {
        setFieldErrors({});
        setStep((s) => s + 1);
      } else {
        await submitRegistrationNow();
      }
      return;
    }

    if (currentStep.key === 'business') {
      const parsed = registerBusinessSchema.safeParse({
        businessName,
        taxId,
      });
      const nextErrs: Partial<Record<RegFieldKey, string>> = parsed.success
        ? {}
        : zodErrorsToMap<RegFieldKey>(parsed.error);

      if (!nextErrs.taxId && taxId.trim()) {
        const normalizedTaxId = taxId.trim().toUpperCase();
        setCheckingStep(true);
        try {
          const availability = await authApi.checkAvailability({
            taxId: normalizedTaxId,
          });
          if (availability.taxId && !availability.taxId.available) {
            nextErrs.taxId =
              availability.taxId.message ||
              'Este NIF/NIE/CIF ya está asociado a otro profesional.';
          }
        } catch {
          // Validación final respaldada por backend
        } finally {
          setCheckingStep(false);
        }
      }

      if (Object.keys(nextErrs).length > 0) {
        setFieldErrors(nextErrs);
        return;
      }

      await submitRegistrationNow();
      return;
    }

    if (currentStep.key === 'verify') {
      const parsed = otpSchema.safeParse({ otpCode });
      if (!parsed.success) {
        setFieldErrors(zodErrorsToMap<RegFieldKey>(parsed.error));
        return;
      }
      const cleanCode = parsed.data.otpCode;
      if (!onVerifyEmailCode) return;

      setFieldErrors({});
      let formattedPhone: string | undefined;
      try {
        formattedPhone = formatPhoneIfProvided();
      } catch {
        formattedPhone = pendingPayload?.phoneNumber;
      }
      const payload = pendingPayload || buildPayload(formattedPhone);

      try {
        await onVerifyEmailCode(cleanCode, payload);
      } catch (err) {
        setFieldErrors({
          otpCode:
            err instanceof Error
              ? err.message
              : 'No se pudo verificar el código.',
        });
      }
    }
  };

  const isBusy = checkingStep || isSubmitting;

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Crear cuenta" onBack={handleBack} />

      <Stepper
        steps={steps}
        current={step}
        onSelect={(idx) => {
          if (idx <= step && !isBusy) {
            if (currentStep.key === 'verify' && idx < step) {
              onResetFlow?.();
            }
            clearAllErrors();
            setStep(idx);
          }
        }}
      />

      <FormScroll>
        <View style={{ gap: space.xs }}>
          <Text variant="kicker" style={{ color: colors.accent }}>
            Paso {step + 1} de {steps.length}
          </Text>

          {currentStep.key === 'account' ? (
            <>
              <Text variant="display" style={{ color: colors.text }}>
                Crea tu cuenta de Yewi
              </Text>
              <Text variant="body" tone="secondary">
                Elige cómo vas a usar la plataforma. Puedes empezar por correo o con Google.
              </Text>
            </>
          ) : null}

          {currentStep.key === 'name' ? (
            <>
              <Text variant="display" style={{ color: colors.text }}>
                ¿Cómo te llamas?
              </Text>
              <Text variant="body" tone="secondary">
                Usa tu nombre real para tus presupuestos, encargos y valoraciones.
              </Text>
            </>
          ) : null}

          {currentStep.key === 'credentials' ? (
            <>
              <Text variant="display" style={{ color: colors.text }}>
                Tu correo y contraseña
              </Text>
              <Text variant="body" tone="secondary">
                Usa tu correo habitual y crea una contraseña segura.
              </Text>
            </>
          ) : null}

          {currentStep.key === 'location' ? (
            <>
              <Text variant="display" style={{ color: colors.text }}>
                Tu teléfono y ubicación
              </Text>
              <Text variant="body" tone="secondary">
                Indica tu localidad en España y tu teléfono de contacto.
              </Text>
            </>
          ) : null}

          {currentStep.key === 'business' ? (
            <>
              <Text variant="display" style={{ color: colors.text }}>
                Datos fiscales y actividad
              </Text>
              <Text variant="body" tone="secondary">
                Completa los datos de tu negocio para ejercer como profesional.
              </Text>
            </>
          ) : null}

          {currentStep.key === 'verify' ? (
            <>
              <Text variant="display" style={{ color: colors.text }}>
                Verifica tu correo
              </Text>
              <Text variant="body" tone="secondary">
                Introduce el código de confirmación que hemos enviado a {email.trim().toLowerCase()}.
              </Text>
            </>
          ) : null}
        </View>

        {currentStep.key === 'account' ? (
          <View style={{ gap: space.md }}>
            <View style={{ gap: space.xs }}>
              <Text variant="label" style={{ color: colors.text, fontWeight: '600' }}>
                Tipo de cuenta
              </Text>
              <View style={s.roleRow}>
                <PillTab
                  label="Soy Cliente"
                  icon="user"
                  tone="primary"
                  size="lg"
                  active={roleType === 'CLIENT'}
                  style={{ flex: 1 }}
                  onPress={() => handleSelectRole('CLIENT')}
                />
                <PillTab
                  label="Soy Profesional"
                  icon="briefcase"
                  tone="primary"
                  size="lg"
                  active={roleType === 'PROFESSIONAL'}
                  style={{ flex: 1 }}
                  onPress={() => handleSelectRole('PROFESSIONAL')}
                />
              </View>
            </View>

            <Button
              title="Continuar con correo"
              icon="mail"
              onPress={() => void handleNext()}
            />

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
              roles={selectedRoles}
              disabled={isBusy}
              onError={(msg) => {
                if (msg) toast.error(msg);
              }}
            />
          </View>
        ) : null}

        {currentStep.key === 'name' ? (
          <View>
            <Field
              icon="user"
              label="Nombre"
              placeholder="Ej: Laura"
              autoComplete="given-name"
              value={firstName}
              error={fieldErrors.firstName}
              onChangeText={(val) => {
                setFirstName(val);
                clearFieldError('firstName');
              }}
            />
            <Field
              icon="user"
              label="Apellidos"
              placeholder="Ej: Martínez Gómez"
              autoComplete="family-name"
              value={lastName}
              error={fieldErrors.lastName}
              onChangeText={(val) => {
                setLastName(val);
                clearFieldError('lastName');
              }}
            />
          </View>
        ) : null}

        {currentStep.key === 'credentials' ? (
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
              label="Contraseña (mín. 8 caracteres)"
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
            <Field
              icon="shield"
              label="Confirmar contraseña"
              placeholder="••••••••"
              secure
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChangeText={(val) => {
                setConfirmPassword(val);
                clearFieldError('confirmPassword');
              }}
            />
          </View>
        ) : null}

        {currentStep.key === 'location' ? (
          <View>
            <PhoneInput
              countryCode={countryCode}
              onChangeCountry={(code, prefix) => {
                setCountryCode(code);
                setCountryPrefix(prefix);
                clearFieldError('phone');
              }}
              value={phoneDigits}
              error={phoneError}
              onChangeText={(val) => {
                setPhoneDigits(val);
                clearFieldError('phone');
                onClearExternalError();
              }}
            />
            <AddressAutocomplete
              value={addressInfo}
              errors={{
                city: fieldErrors.city,
                postalCode: fieldErrors.postalCode,
              }}
              onChange={(next) => {
                setAddressInfo(next);
                if (next.city.trim()) clearFieldError('city');
                if (!next.postalCode || isValidSpanishPostalCode(next.postalCode)) {
                  clearFieldError('postalCode');
                }
              }}
            />
          </View>
        ) : null}

        {currentStep.key === 'business' ? (
          <View>
            <Field
              icon="briefcase"
              label="Nombre comercial o empresa"
              placeholder="Reformas Ruiz SL"
              value={businessName}
              error={fieldErrors.businessName}
              onChangeText={(val) => {
                setBusinessName(val);
                clearFieldError('businessName');
              }}
            />
            <Field
              icon="file-text"
              label="NIF / NIE / CIF"
              placeholder="12345678Z o B12345678"
              autoCapitalize="characters"
              value={taxId}
              error={taxIdError}
              onChangeText={(val) => {
                setTaxId(val);
                clearFieldError('taxId');
                onClearExternalError();
              }}
            />
            <Field
              icon="edit-3"
              label="Especialidad y descripción breve"
              placeholder="Fontanería urgente, reformas integrales, calderas..."
              multiline
              numberOfLines={3}
              value={bio}
              onChangeText={setBio}
            />
          </View>
        ) : null}

        {currentStep.key === 'verify' ? (
          <View style={{ gap: space.sm }}>
            <Field
              icon="key"
              label="Código de verificación"
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={8}
              value={otpCode}
              error={otpError}
              onChangeText={(val) => {
                setOtpCode(val);
                clearFieldError('otpCode');
                onClearExternalError();
              }}
            />
            {onResendEmailCode ? (
              <Button
                title="Reenviar código"
                variant="secondary"
                icon="refresh-cw"
                disabled={isBusy}
                onPress={() => void onResendEmailCode()}
              />
            ) : null}
          </View>
        ) : null}

        {currentStep.key !== 'account' ? (
          <View style={s.navActions}>
            <Button
              title="Anterior"
              variant="secondary"
              disabled={isBusy}
              style={{ flex: 1 }}
              onPress={handleBack}
            />
            <Button
              title={
                isFinalCreationStep
                  ? roleType === 'PROFESSIONAL'
                    ? 'Crear perfil Pro'
                    : 'Crear cuenta'
                  : clerkEnabled && currentStep.key === lastInputStepKey
                    ? 'Enviar código'
                    : 'Siguiente'
              }
              icon={isFinalCreationStep ? 'check' : 'arrow-right'}
              loading={isBusy}
              disabled={isBusy}
              style={{ flex: 1.5 }}
              onPress={() => void handleNext()}
            />
          </View>
        ) : null}

        <Divider />

        <View style={s.footerRow}>
          <Text variant="body" tone="secondary">
            ¿Ya tienes cuenta en Yewi?
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text
                variant="label"
                style={{ color: colors.primary, fontWeight: '700' }}
              >
                Iniciar sesión
              </Text>
            </Pressable>
          </Link>
        </View>
      </FormScroll>
    </Screen>
  );
}

function DirectRegisterScreen() {
  const registerMutation = useRegister();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDirectSubmit = async (
    payload: RegisterPayload,
  ): Promise<'completed'> => {
    setErrorMsg(null);
    await registerMutation.mutateAsync({
      email: payload.email,
      password: payload.password,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles,
      phoneNumber: payload.phoneNumber,
      city: payload.city,
      postalCode: payload.postalCode,
      address: payload.address,
      businessName: payload.businessName,
      taxId: payload.taxId,
      bio: payload.bio,
      skills: payload.skills,
    });
    usePreferencesStore
      .getState()
      .setActiveRole(
        payload.roleType === 'PROFESSIONAL' ? 'PROFESSIONAL' : 'CLIENT',
      );
    toast.success('¡Cuenta creada con éxito!');
    router.replace('/(tabs)' as never);
    return 'completed';
  };

  return (
    <RegisterWizard
      clerkEnabled={false}
      isSubmitting={registerMutation.isPending}
      externalError={errorMsg}
      onClearExternalError={() => setErrorMsg(null)}
      onSubmitRegistration={handleDirectSubmit}
    />
  );
}

export default function RegisterScreen() {
  return <DirectRegisterScreen />;
}

const s = StyleSheet.create({
  roleRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  orLine: {
    flex: 1,
  },
  navActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
