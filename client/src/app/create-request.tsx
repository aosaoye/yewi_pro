import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCategories, useCreateRequest, useMe } from '@/api/hooks';
import {
  AddressAutocomplete,
  type AddressFields,
} from '@/components/AddressAutocomplete';
import { CATEGORIES_LIST } from '@/lib/categories';
import { formatEur } from '@/lib/format';
import { getAccessToken } from '@/lib/session';
import {
  Button,
  CustomSwitch,
  Field,
  fonts,
  FormScroll,
  gutter,
  ListGroup,
  ListRow,
  NavHeader,
  PillTab,
  Screen,
  space,
  type StepItem,
  Stepper,
  Text,
  toast,
  useTheme,
} from '@/ui';

const REQUEST_STEPS: StepItem[] = [
  { title: 'Categoría' },
  { title: 'Ubicación' },
  { title: 'Resumen' },
];

type RequestFieldKey = 'category' | 'title' | 'description' | 'budget' | 'city';

export default function CreateRequestScreen() {
  const { colors } = useTheme();
  const meQuery = useMe();
  const categoriesQuery = useCategories();
  const createRequest = useCreateRequest();

  const [step, setStep] = useState(0);
  const [draftCategory, setDraftCategory] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [addressDraft, setAddressDraft] = useState<AddressFields | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<RequestFieldKey, string>>
  >({});

  useEffect(() => {
    void getAccessToken().then((t) => {
      if (!t) {
        toast.info('Inicia sesión para publicar en Yewi');
        router.replace('/(auth)/login' as never);
      }
    });
  }, []);

  const isProMode = Boolean(
    meQuery.data?.roles?.includes('PROFESSIONAL') ||
      meQuery.data?.professionalProfile,
  );

  useEffect(() => {
    if (meQuery.data && isProMode) {
      router.replace('/publish-gig' as never);
    }
  }, [meQuery.data, isProMode]);

  const categoryOptions = useMemo(() => {
    const apiCats = categoriesQuery.data ?? [];
    if (apiCats.length > 0) {
      return apiCats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        isFromApi: true,
      }));
    }
    return CATEGORIES_LIST.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isFromApi: false,
    }));
  }, [categoriesQuery.data]);

  const categoryName =
    draftCategory ?? categoryOptions[0]?.name ?? CATEGORIES_LIST[0].name;

  const matchedApiCat = useMemo(
    () =>
      categoryOptions.find(
        (cat) => cat.isFromApi && cat.name === categoryName,
      ),
    [categoryOptions, categoryName],
  );

  const userProfile = meQuery.data?.profile;

  const address: AddressFields = addressDraft ?? {
    city: userProfile?.city || 'Madrid',
    postalCode: userProfile?.postalCode || '28001',
    province: userProfile?.province || 'Madrid',
    region: userProfile?.region || 'Comunidad de Madrid',
    address: userProfile?.address || '',
  };

  const clearFieldError = (key: RequestFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleBack = () => {
    if (step > 0) {
      setFieldErrors({});
      setStep((prev) => prev - 1);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as never);
    }
  };

  const isLastStep = step === REQUEST_STEPS.length - 1;
  const isBusy = createRequest.isPending || submitting;

  const handleNext = async () => {
    if (isBusy || submitLockRef.current) return;

    if (step === 0) {
      const errors: Partial<Record<RequestFieldKey, string>> = {};
      if (!categoryName.trim()) {
        errors.category = 'Selecciona una categoría.';
      }
      if (!title.trim()) {
        errors.title = 'Introduce el título de la solicitud.';
      }
      if (!description.trim()) {
        errors.description = 'Añade una descripción del trabajo.';
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      setStep(1);
      return;
    }

    if (step === 1) {
      const errors: Partial<Record<RequestFieldKey, string>> = {};
      if (budget.trim()) {
        const parsedBudget = Number(budget);
        if (Number.isNaN(parsedBudget) || parsedBudget <= 0) {
          errors.budget = 'Introduce un presupuesto válido mayor que 0.';
        }
      }
      if (!address.city.trim()) {
        errors.city = 'Indica tu ciudad.';
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});
      setStep(2);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    const numericBudget = budget.trim() ? Number(budget) : undefined;

    try {
      await createRequest.mutateAsync({
        category: categoryName,
        categoryId: matchedApiCat?.id,
        title: title.trim(),
        description: description.trim(),
        budgetEstimated: numericBudget,
        budgetMax: numericBudget,
        isUrgent,
        city: address.city.trim(),
        postalCode: address.postalCode.trim() || '28001',
        address: address.address?.trim() || undefined,
      });
      toast.success('Solicitud publicada. Recibirás presupuestos pronto.');
      router.replace('/(tabs)/requests' as never);
    } catch (err) {
      submitLockRef.current = false;
      setSubmitting(false);
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo publicar la solicitud.',
      );
    }
  };

  const budgetSummary = budget.trim()
    ? formatEur(Number(budget) || 0)
    : 'A convenir';
  const locationSummary = `${address.city.trim() || 'España'}${
    address.postalCode.trim() ? ` · ${address.postalCode.trim()}` : ''
  }`;

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Pedir presupuesto" solidSurface onBack={handleBack} />

      <Stepper
        steps={REQUEST_STEPS}
        current={step}
        onSelect={(idx) => {
          if (idx <= step && !isBusy) {
            setFieldErrors({});
            setStep(idx);
          }
        }}
      />

      <FormScroll>
        <View style={{ gap: space.xs }}>
          <Text variant="kicker" style={{ color: colors.accent }}>
            Paso {step + 1} de {REQUEST_STEPS.length}
          </Text>
          <Text variant="title" style={{ color: colors.text }}>
            {step === 0
              ? '¿Qué trabajo necesitas?'
              : step === 1
                ? 'Presupuesto y ubicación'
                : 'Revisa tu solicitud'}
          </Text>
        </View>

        {step === 0 ? (
          <View style={s.stepBody}>
            <View style={s.categoriesSection}>
              <Text
                variant="label"
                style={{ color: colors.text, fontFamily: fonts.semibold }}
              >
                Categorías
              </Text>
              <View style={s.categoriesWrap}>
                {categoryOptions.map((cat) => {
                  const selected = categoryName === cat.name;
                  return (
                    <PillTab
                      key={cat.id}
                      label={cat.name}
                      size="sm"
                      tone="contrast"
                      active={selected}
                      onPress={() => {
                        setDraftCategory(cat.name);
                        clearFieldError('category');
                      }}
                    />
                  );
                })}
              </View>
              {fieldErrors.category ? (
                <Text variant="caption" style={{ color: colors.danger }}>
                  {fieldErrors.category}
                </Text>
              ) : null}
            </View>

            <Field
              icon="edit-3"
              label="Título de la solicitud"
              placeholder="Ej: Reforma completa de baño"
              maxLength={140}
              value={title}
              error={fieldErrors.title}
              onChangeText={(val) => {
                setTitle(val);
                clearFieldError('title');
              }}
            />

            <Field
              icon="align-left"
              label="Descripción"
              placeholder="Detalla medidas, materiales o estado actual..."
              multiline
              numberOfLines={4}
              value={description}
              error={fieldErrors.description}
              onChangeText={(val) => {
                setDescription(val);
                clearFieldError('description');
              }}
            />
          </View>
        ) : null}

        {step === 1 ? (
          <View style={s.stepBody}>
            <Field
              icon="dollar-sign"
              label="Presupuesto máx. (€)"
              keyboardType="numeric"
              placeholder="250"
              value={budget}
              error={fieldErrors.budget}
              onChangeText={(val) => {
                setBudget(val);
                clearFieldError('budget');
              }}
            />

            <View style={s.urgentRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  variant="label"
                  style={{ color: colors.text, fontFamily: fonts.semibold }}
                >
                  Es urgente
                </Text>
                <Text variant="caption" tone="muted">
                  Para hoy o 48h
                </Text>
              </View>
              <CustomSwitch value={isUrgent} onValueChange={setIsUrgent} />
            </View>

            <AddressAutocomplete
              value={address}
              errors={{ city: fieldErrors.city }}
              onChange={(next) => {
                setAddressDraft({
                  city: next.city,
                  postalCode: next.postalCode,
                  province: next.province || '',
                  region: next.region || '',
                  address: next.address || '',
                  latitude: next.latitude,
                  longitude: next.longitude,
                });
                if (next.city.trim()) {
                  clearFieldError('city');
                }
              }}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={s.stepBody}>
            <View style={{ marginHorizontal: -gutter }}>
              <ListGroup>
                <ListRow
                  icon="tag"
                  plainIcon
                  title="Categoría"
                  subtitle={categoryName}
                  chevron={false}
                />
                <ListRow
                  icon="file-text"
                  plainIcon
                  title="Título"
                  subtitle={title.trim()}
                  chevron={false}
                />
                <ListRow
                  icon="dollar-sign"
                  plainIcon
                  title="Presupuesto"
                  subtitle={budgetSummary}
                  chevron={false}
                />
                <ListRow
                  icon="clock"
                  plainIcon
                  title="Prioridad"
                  subtitle={isUrgent ? 'Urgente (hoy o 48h)' : 'Estándar'}
                  chevron={false}
                />
                <ListRow
                  icon="map-pin"
                  plainIcon
                  title="Ubicación"
                  subtitle={locationSummary}
                  chevron={false}
                />
              </ListGroup>
            </View>
          </View>
        ) : null}

        <View style={s.navActions}>
          {step > 0 ? (
            <Button
              title="Anterior"
              variant="secondary"
              disabled={isBusy}
              style={{ flex: 1 }}
              onPress={handleBack}
            />
          ) : null}
          <Button
            title={isLastStep ? 'Publicar solicitud' : 'Siguiente'}
            icon={isLastStep ? 'check' : 'arrow-right'}
            loading={isBusy}
            disabled={isBusy}
            style={{ flex: step > 0 ? 1.5 : 1 }}
            onPress={handleNext}
          />
        </View>
      </FormScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  stepBody: {
    gap: space.sm,
  },
  categoriesSection: {
    gap: space.sm,
    marginBottom: space.xs,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginBottom: space.sm,
  },
  navActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
});
