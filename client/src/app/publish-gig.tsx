import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  useCategories,
  useCreateGig,
  useGig,
  useMe,
  useUpdateGig,
} from '@/api/hooks';
import { professionalsApi } from '@/api/services';
import {
  AddressAutocomplete,
  type AddressFields,
} from '@/components/AddressAutocomplete';
import { ProfileTabs, type ProfileTab } from '@/components/ProfileTabs';
import { CATEGORIES_LIST } from '@/lib/categories';
import { formatEur } from '@/lib/format';
import { getAccessToken } from '@/lib/session';
import {
  AppIcon,
  Button,
  Cover,
  CustomSwitch,
  Field,
  fonts,
  FormScroll,
  gutter,
  ListGroup,
  ListRow,
  NavHeader,
  PillTab,
  radius,
  Screen,
  SkeletonRows,
  space,
  type StepItem,
  Stepper,
  Text,
  toast,
  useTheme,
} from '@/ui';

const GIG_STEPS: StepItem[] = [
  { title: 'Categoría' },
  { title: 'Paquetes' },
  { title: 'Ubicación' },
  { title: 'Portada' },
];

type PackageTierKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

const PACKAGE_TABS: readonly ProfileTab<PackageTierKey>[] = [
  { id: 'BASIC', label: 'Básico', icon: 'package' },
  { id: 'STANDARD', label: 'Estándar', icon: 'layers' },
  { id: 'PREMIUM', label: 'Premium', icon: 'star' },
];

const PACKAGE_PLACEHOLDERS: Record<PackageTierKey, string> = {
  BASIC: 'Ej: Básico',
  STANDARD: 'Ej: Estándar',
  PREMIUM: 'Ej: Premium',
};

interface PackageDraft {
  enabled: boolean;
  name: string;
  price: string;
  deliveryDays: string;
  revisions: string;
  description: string;
}

type PackageFieldName =
  | 'name'
  | 'price'
  | 'deliveryDays'
  | 'revisions'
  | 'description';
type PackageErrors = Partial<
  Record<PackageTierKey, Partial<Record<PackageFieldName, string>>>
>;

type GigFieldKey = 'category' | 'title' | 'description' | 'city';

function createInitialPackages(): Record<PackageTierKey, PackageDraft> {
  return {
    BASIC: {
      enabled: true,
      name: '',
      price: '',
      deliveryDays: '',
      revisions: '',
      description: '',
    },
    STANDARD: {
      enabled: false,
      name: '',
      price: '',
      deliveryDays: '',
      revisions: '',
      description: '',
    },
    PREMIUM: {
      enabled: false,
      name: '',
      price: '',
      deliveryDays: '',
      revisions: '',
      description: '',
    },
  };
}

export default function PublishGigScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditMode = Boolean(editId);
  const { colors } = useTheme();
  const meQuery = useMe();
  const categoriesQuery = useCategories();
  const editGigQuery = useGig(editId ?? '');
  const createGig = useCreateGig();
  const updateGig = useUpdateGig();

  const [step, setStep] = useState(0);
  const [draftCategory, setDraftCategory] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState<string | null>(null);
  const [selectedTierOverride, setSelectedTierOverride] =
    useState<PackageTierKey | null>(null);
  const [draftPackages, setDraftPackages] = useState<Record<
    PackageTierKey,
    PackageDraft
  > | null>(null);
  const [draftCoverImages, setDraftCoverImages] = useState<string[] | null>(
    null,
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [addressDraft, setAddressDraft] = useState<AddressFields | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<GigFieldKey, string>>
  >({});
  const [packageErrors, setPackageErrors] = useState<PackageErrors>({});

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
    if (meQuery.data && !isProMode && !isEditMode) {
      router.replace('/create-request' as never);
    }
  }, [meQuery.data, isProMode, isEditMode]);

  const initialEditPackages = useMemo(() => {
    const next = createInitialPackages();
    const existingPkgs = isEditMode ? (editGigQuery.data?.packages ?? []) : [];
    if (existingPkgs.length > 0) {
      next.BASIC.enabled = false;
      existingPkgs.forEach((pkg, idx) => {
        const tierKey: PackageTierKey =
          pkg.tier === 'STANDARD'
            ? 'STANDARD'
            : pkg.tier === 'PREMIUM'
              ? 'PREMIUM'
              : 'BASIC';
        if (
          idx === 0 ||
          tierKey === 'BASIC' ||
          tierKey === 'STANDARD' ||
          tierKey === 'PREMIUM'
        ) {
          next[tierKey] = {
            enabled: true,
            name: pkg.name || '',
            price: String(pkg.price ?? ''),
            deliveryDays: String(pkg.deliveryDays ?? ''),
            revisions: String(pkg.revisions ?? 0),
            description: pkg.description || '',
          };
        }
      });
    }
    return next;
  }, [isEditMode, editGigQuery.data?.packages]);

  const defaultTierFromGig: PackageTierKey = useMemo(() => {
    if (initialEditPackages.BASIC.enabled) return 'BASIC';
    return (
      (['STANDARD', 'PREMIUM'] as const).find(
        (t) => initialEditPackages[t].enabled,
      ) ?? 'BASIC'
    );
  }, [initialEditPackages]);

  const packages = draftPackages ?? initialEditPackages;
  const activeTier = selectedTierOverride ?? defaultTierFromGig;
  const setActiveTier = (tier: PackageTierKey) => setSelectedTierOverride(tier);
  const title = draftTitle ?? (isEditMode ? editGigQuery.data?.title || '' : '');
  const setTitle = (val: string) => setDraftTitle(val);
  const description =
    draftDescription ?? (isEditMode ? editGigQuery.data?.description || '' : '');
  const setDescription = (val: string) => setDraftDescription(val);
  const coverImages = useMemo(
    () =>
      draftCoverImages ??
      (isEditMode ? (editGigQuery.data?.coverImages ?? []).filter(Boolean) : []),
    [draftCoverImages, isEditMode, editGigQuery.data?.coverImages],
  );

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
    draftCategory ??
    (isEditMode ? editGigQuery.data?.category?.name : undefined) ??
    categoryOptions[0]?.name ??
    CATEGORIES_LIST[0].name;

  const matchedApiCat = useMemo(
    () =>
      categoryOptions.find(
        (cat) => cat.isFromApi && cat.name === categoryName,
      ),
    [categoryOptions, categoryName],
  );

  const pro = meQuery.data?.professionalProfile;
  const userProfile = meQuery.data?.profile;

  const address: AddressFields = addressDraft ?? {
    city: pro?.city || userProfile?.city || 'Madrid',
    postalCode: pro?.postalCode || userProfile?.postalCode || '28001',
    province: pro?.province || userProfile?.province || 'Madrid',
    region: pro?.region || userProfile?.region || 'Comunidad de Madrid',
    address: pro?.address || userProfile?.address || '',
    latitude: pro?.latitude ?? undefined,
    longitude: pro?.longitude ?? undefined,
  };

  const clearFieldError = (key: GigFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearPackageFieldError = (
    tier: PackageTierKey,
    field: PackageFieldName,
  ) => {
    setPackageErrors((prev) => {
      const tierErrs = prev[tier];
      if (!tierErrs?.[field]) return prev;
      const nextTierErrs = { ...tierErrs };
      delete nextTierErrs[field];
      return { ...prev, [tier]: nextTierErrs };
    });
  };

  const updatePackageField = (
    tier: PackageTierKey,
    field: Exclude<keyof PackageDraft, 'enabled'>,
    value: string,
  ) => {
    setDraftPackages((prev) => {
      const base = prev ?? initialEditPackages;
      return {
        ...base,
        [tier]: { ...base[tier], [field]: value },
      };
    });
    clearPackageFieldError(tier, field);
  };

  const togglePackageEnabled = (tier: PackageTierKey, enabled: boolean) => {
    if (tier === 'BASIC') return;
    setDraftPackages((prev) => {
      const base = prev ?? initialEditPackages;
      return {
        ...base,
        [tier]: { ...base[tier], enabled },
      };
    });
    if (!enabled) {
      setPackageErrors((prev) => {
        if (!prev[tier]) return prev;
        const next = { ...prev };
        delete next[tier];
        return next;
      });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setFieldErrors({});
      setPackageErrors({});
      setStep((prev) => prev - 1);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as never);
    }
  };

  const handlePickCover = async () => {
    setUploadingCover(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.75,
        base64: true,
      });
      if (res.canceled || !res.assets?.length) return;

      const uploadedUrls: string[] = [];
      for (const asset of res.assets) {
        try {
          const uploaded = await professionalsApi.uploadPortfolioImage(
            asset.base64
              ? `data:image/jpeg;base64,${asset.base64}`
              : asset.uri,
          );
          uploadedUrls.push(uploaded.url);
        } catch {
          uploadedUrls.push(asset.uri);
        }
      }

      if (uploadedUrls.length > 0) {
        setDraftCoverImages((prev) =>
          [...(prev ?? coverImages), ...uploadedUrls].slice(0, 6),
        );
        toast.success(
          uploadedUrls.length === 1
            ? 'Imagen de portada lista'
            : `${uploadedUrls.length} imágenes añadidas`,
        );
      }
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCover = (index: number) => {
    setDraftCoverImages((prev) =>
      (prev ?? coverImages).filter((_, idx) => idx !== index),
    );
  };

  const isLastStep = step === GIG_STEPS.length - 1;
  const isBusy =
    createGig.isPending ||
    updateGig.isPending ||
    uploadingCover ||
    submitting;

  const enabledPackageTiers = useMemo(
    () =>
      (['BASIC', 'STANDARD', 'PREMIUM'] as const).filter(
        (tier) => tier === 'BASIC' || packages[tier].enabled,
      ),
    [packages],
  );

  const handleNext = async () => {
    if (isBusy || submitLockRef.current) return;

    if (step === 0) {
      const errors: Partial<Record<GigFieldKey, string>> = {};
      if (!categoryName.trim()) {
        errors.category = 'Selecciona una categoría.';
      }
      if (!title.trim()) {
        errors.title = 'Introduce el título del servicio.';
      }
      if (!description.trim()) {
        errors.description = 'Añade una descripción del servicio.';
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
      const nextPkgErrors: PackageErrors = {};
      let firstInvalidTier: PackageTierKey | null = null;
      const requirePkgDescription = enabledPackageTiers.length > 1;

      for (const tier of enabledPackageTiers) {
        const draft = packages[tier];
        const tierErrors: Partial<Record<PackageFieldName, string>> = {};
        const parsedPrice = Number(draft.price);
        const parsedDays = Number(draft.deliveryDays);
        const revTrimmed = draft.revisions.trim();
        const parsedRevisions = revTrimmed ? Number(revTrimmed) : 0;

        if (!draft.name.trim()) {
          tierErrors.name = 'Indica un nombre para este paquete.';
        }
        if (
          !draft.price.trim() ||
          Number.isNaN(parsedPrice) ||
          parsedPrice < 5
        ) {
          tierErrors.price = 'Mínimo 5 €.';
        }
        if (
          !draft.deliveryDays.trim() ||
          !Number.isInteger(parsedDays) ||
          parsedDays < 1
        ) {
          tierErrors.deliveryDays = 'Mínimo 1 día.';
        }
        if (
          revTrimmed &&
          (!Number.isInteger(parsedRevisions) || parsedRevisions < 0)
        ) {
          tierErrors.revisions = 'Indica 0 o más.';
        }
        if (
          (requirePkgDescription || tier !== 'BASIC') &&
          !draft.description.trim()
        ) {
          tierErrors.description = 'Describe qué incluye este paquete.';
        }

        if (Object.keys(tierErrors).length > 0) {
          nextPkgErrors[tier] = tierErrors;
          if (!firstInvalidTier) firstInvalidTier = tier;
        }
      }

      if (firstInvalidTier) {
        setPackageErrors(nextPkgErrors);
        setActiveTier(firstInvalidTier);
        return;
      }

      setPackageErrors({});
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!address.city.trim()) {
        setFieldErrors({ city: 'Indica tu ciudad.' });
        return;
      }
      setFieldErrors({});
      setStep(3);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);

    const hasStandard = packages.STANDARD.enabled;
    const packagesPayload = enabledPackageTiers.map((tier) => {
      const pkg = packages[tier];
      return {
        tier,
        name: pkg.name.trim(),
        description:
          pkg.description.trim() || description.trim().slice(0, 200),
        price: Number(pkg.price),
        deliveryDays: Math.max(1, Math.round(Number(pkg.deliveryDays))),
        revisions: pkg.revisions.trim()
          ? Math.max(0, Math.round(Number(pkg.revisions)))
          : 0,
        isPopular: hasStandard ? tier === 'STANDARD' : tier === 'BASIC',
      };
    });

    try {
      if (isEditMode && editId) {
        await updateGig.mutateAsync({
          id: editId,
          dto: {
            title: title.trim(),
            category: categoryName,
            categoryId: matchedApiCat?.id,
            description: description.trim(),
            coverImages,
            packages: packagesPayload,
          },
        });
        toast.success('Servicio y paquetes actualizados');
        router.back();
      } else {
        await createGig.mutateAsync({
          title: title.trim(),
          category: categoryName,
          categoryId: matchedApiCat?.id,
          description: description.trim(),
          price: packagesPayload[0].price,
          deliveryDays: packagesPayload[0].deliveryDays,
          city: address.city.trim(),
          coverImages,
          packages: packagesPayload,
        });
        toast.success('Servicio publicado con éxito');
        router.replace('/(tabs)' as never);
      }
    } catch (err) {
      submitLockRef.current = false;
      setSubmitting(false);
      toast.error(
        err instanceof Error
          ? err.message
          : isEditMode
            ? 'No se pudo actualizar el servicio.'
            : 'No se pudo publicar el servicio.',
      );
    }
  };

  if (isEditMode && editGigQuery.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Editar servicio" solidSurface onBack={handleBack} />
        <View style={{ padding: gutter }}>
          <SkeletonRows count={4} />
        </View>
      </Screen>
    );
  }

  const activePkg = packages[activeTier];
  const activePkgErrors = packageErrors[activeTier] ?? {};
  const validPrices = enabledPackageTiers
    .map((tier) => Number(packages[tier].price))
    .filter((p) => Number.isFinite(p) && p > 0);
  const minPkgPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const packagesSummary =
    enabledPackageTiers.length === 1
      ? `${activePkg.name.trim() || '1 paquete'}${minPkgPrice > 0 ? ` (${formatEur(minPkgPrice)})` : ''}`
      : `${enabledPackageTiers.length} paquetes${minPkgPrice > 0 ? ` · desde ${formatEur(minPkgPrice)}` : ''}`;

  const locationSummary = `${address.city.trim() || 'España'}${
    address.postalCode.trim() ? ` · ${address.postalCode.trim()}` : ''
  }`;

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader
        title={isEditMode ? 'Editar servicio' : 'Publicar servicio'}
        solidSurface
        onBack={handleBack}
      />

      <Stepper
        steps={GIG_STEPS}
        current={step}
        onSelect={(idx) => {
          if (idx <= step && !isBusy) {
            setFieldErrors({});
            setPackageErrors({});
            setStep(idx);
          }
        }}
      />

      <FormScroll>
        <View style={{ gap: space.xs }}>
          <Text variant="kicker" style={{ color: colors.accent }}>
            Paso {step + 1} de {GIG_STEPS.length}
          </Text>
          <Text variant="title" style={{ color: colors.text }}>
            {step === 0
              ? '¿Qué servicio ofreces?'
              : step === 1
                ? 'Configura tus paquetes'
                : step === 2
                  ? '¿Dónde prestas el servicio?'
                  : 'Portada y resumen'}
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
              label="Título del servicio"
              placeholder="Ej: Instalación de cuadro eléctrico"
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
              label="Descripción y alcance"
              placeholder="Detalla medidas, materiales y alcance del trabajo..."
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
            <View style={{ marginHorizontal: -gutter }}>
              <ProfileTabs
                tabs={PACKAGE_TABS}
                activeTab={activeTier}
                onSelectTab={setActiveTier}
              />
            </View>

            {activeTier !== 'BASIC' ? (
              <View style={s.tierSwitchRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    variant="label"
                    style={{ color: colors.text, fontFamily: fonts.semibold }}
                  >
                    {activeTier === 'STANDARD'
                      ? 'Activar paquete Estándar'
                      : 'Activar paquete Premium'}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {activeTier === 'STANDARD'
                      ? 'Ofrece una opción intermedia más completa'
                      : 'Ofrece un nivel todo incluido o prioritario'}
                  </Text>
                </View>
                <CustomSwitch
                  value={activePkg.enabled}
                  onValueChange={(val) => togglePackageEnabled(activeTier, val)}
                />
              </View>
            ) : null}

            {activePkg.enabled ? (
              <View style={{ gap: space.xs }}>
                <Field
                  icon="tag"
                  label="Nombre del paquete"
                  placeholder={PACKAGE_PLACEHOLDERS[activeTier]}
                  maxLength={60}
                  value={activePkg.name}
                  error={activePkgErrors.name}
                  onChangeText={(val) =>
                    updatePackageField(activeTier, 'name', val)
                  }
                />

                <View style={s.twoCols}>
                  <View style={{ flex: 1 }}>
                    <Field
                      icon="dollar-sign"
                      label="Precio (€)"
                      keyboardType="numeric"
                      placeholder="90"
                      value={activePkg.price}
                      error={activePkgErrors.price}
                      onChangeText={(val) =>
                        updatePackageField(activeTier, 'price', val)
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      icon="clock"
                      label="Plazo (días)"
                      keyboardType="numeric"
                      placeholder="3"
                      value={activePkg.deliveryDays}
                      error={activePkgErrors.deliveryDays}
                      onChangeText={(val) =>
                        updatePackageField(activeTier, 'deliveryDays', val)
                      }
                    />
                  </View>
                </View>

                <Field
                  icon="refresh-cw"
                  label="Revisiones"
                  keyboardType="numeric"
                  placeholder="0"
                  value={activePkg.revisions}
                  error={activePkgErrors.revisions}
                  onChangeText={(val) =>
                    updatePackageField(activeTier, 'revisions', val)
                  }
                />

                <Field
                  icon="align-left"
                  label="Qué incluye este paquete"
                  placeholder={
                    activeTier === 'BASIC' && enabledPackageTiers.length === 1
                      ? 'Detalla qué incluye este paquete...'
                      : 'Describe qué incluye este paquete...'
                  }
                  multiline
                  numberOfLines={3}
                  value={activePkg.description}
                  error={activePkgErrors.description}
                  onChangeText={(val) =>
                    updatePackageField(activeTier, 'description', val)
                  }
                />
              </View>
            ) : (
              <Text variant="body" tone="muted" style={{ paddingVertical: space.sm }}>
                Activa este nivel si quieres ofrecer varias opciones configuradas por ti a tus clientes.
              </Text>
            )}
          </View>
        ) : null}

        {step === 2 ? (
          <View style={s.stepBody}>
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

        {step === 3 ? (
          <View style={s.stepBody}>
            {coverImages.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <Cover
                  seed={title || 'gig'}
                  imageUrl={coverImages[0]}
                  style={s.coverPreview}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.thumbsRow}
                >
                  {coverImages.map((uri, idx) => (
                    <View key={`${uri}-${idx}`} style={s.thumbWrap}>
                      <Image source={{ uri }} style={s.thumbImg} />
                      <Pressable
                        onPress={() => handleRemoveCover(idx)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Quitar foto"
                        style={[
                          s.thumbRemove,
                          { backgroundColor: colors.danger },
                        ]}
                      >
                        <AppIcon name="x" size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Button
              variant="secondary"
              icon="image"
              title={
                coverImages.length > 0
                  ? 'Añadir más fotos de portada'
                  : 'Añadir foto de portada'
              }
              loading={uploadingCover}
              disabled={isBusy}
              onPress={handlePickCover}
            />

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
                  icon="package"
                  plainIcon
                  title="Paquetes"
                  subtitle={packagesSummary}
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
            title={
              isLastStep
                ? isEditMode
                  ? 'Guardar cambios'
                  : 'Publicar servicio'
                : 'Siguiente'
            }
            icon={isLastStep ? 'check' : 'arrow-right'}
            loading={createGig.isPending || updateGig.isPending || submitting}
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
  tierSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  },
  twoCols: {
    flexDirection: 'row',
    gap: space.sm,
  },
  coverPreview: {
    width: '100%',
    height: 170,
    borderRadius: radius.lg,
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  thumbWrap: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: 'visible',
  },
  thumbImg: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
});
