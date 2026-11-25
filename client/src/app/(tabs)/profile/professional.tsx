import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  useCategories,
  useMyProProfile,
  useUpdateProProfile,
} from '@/api/hooks';
import {
  AddressAutocomplete,
  type AddressFields,
} from '@/components/AddressAutocomplete';
import { CATEGORIES_LIST } from '@/lib/categories';
import { validateSpanishNifCifNie } from '@/lib/validation';
import {
  Avatar,
  Button,
  Divider,
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
  Text,
  toast,
  useTheme,
} from '@/ui';

function isHourlyTradeCategory(nameOrSlug: string): boolean {
  const normalized = nameOrSlug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /limpiez|desarroll|web|digital|manitas|cerrajer|informatic|clases|asistenc|mantenim/.test(
    normalized,
  );
}

export default function ProfessionalProfileManageScreen() {
  const { colors } = useTheme();
  const proQuery = useMyProProfile();
  const categoriesQuery = useCategories();
  const updatePro = useUpdateProProfile();

  const pro = proQuery.data;
  const hasExistingTaxId = Boolean(pro?.taxId);

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

  const [draft, setDraft] = useState<
    Partial<{
      businessName: string;
      taxId: string;
      bio: string;
      hourlyRate: string;
      serviceRadiusKm: string;
      selectedCategories: string[];
      address: AddressFields;
    }>
  >({});

  const businessName = draft.businessName ?? (pro?.businessName || '');
  const taxId = pro?.taxId || draft.taxId || '';
  const bio = draft.bio ?? (pro?.bio || '');
  const hourlyRate =
    draft.hourlyRate ?? (pro?.hourlyRate ? String(pro.hourlyRate) : '');
  const serviceRadiusKm =
    draft.serviceRadiusKm ?? String(pro?.serviceRadiusKm ?? 50);

  const initialSelectedCategories = useMemo(() => {
    const fromCategories = (pro?.categories ?? []).map((c) => c.name);
    if (fromCategories.length > 0) return fromCategories;
    return pro?.skills ?? [];
  }, [pro?.categories, pro?.skills]);

  const selectedCategories =
    draft.selectedCategories ?? initialSelectedCategories;

  const supportsHourlyRate = useMemo(
    () => selectedCategories.some((cat) => isHourlyTradeCategory(cat)),
    [selectedCategories],
  );

  const address: AddressFields = draft.address ?? {
    city: pro?.city || 'Zaragoza',
    postalCode: pro?.postalCode || '50012',
    province: pro?.province || 'Zaragoza',
    region: pro?.region || 'Comunidad de Aragón',
    address: pro?.address || '',
    latitude: pro?.latitude ?? undefined,
    longitude: pro?.longitude ?? undefined,
  };

  const setBusinessName = (v: string) =>
    setDraft((d) => ({ ...d, businessName: v }));
  const setTaxId = (v: string) => {
    if (hasExistingTaxId) return;
    setDraft((d) => ({ ...d, taxId: v }));
  };
  const setBio = (v: string) => setDraft((d) => ({ ...d, bio: v }));
  const setHourlyRate = (v: string) =>
    setDraft((d) => ({ ...d, hourlyRate: v }));
  const setServiceRadiusKm = (v: string) =>
    setDraft((d) => ({ ...d, serviceRadiusKm: v }));
  const toggleCategory = (name: string) =>
    setDraft((d) => {
      const current = d.selectedCategories ?? initialSelectedCategories;
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
      return { ...d, selectedCategories: next };
    });
  const setAddress = (v: AddressFields) =>
    setDraft((d) => ({ ...d, address: v }));

  const handleSavePro = async () => {
    if (!bio.trim()) {
      toast.error('La biografía profesional es obligatoria');
      return;
    }
    if (!hasExistingTaxId && taxId.trim()) {
      const check = validateSpanishNifCifNie(taxId);
      if (!check.isValid) {
        toast.error(check.message || 'NIF/NIE/CIF inválido');
        return;
      }
    }
    const matchedApiCategoryIds = categoryOptions
      .filter((opt) => opt.isFromApi && selectedCategories.includes(opt.name))
      .map((opt) => opt.id);

    try {
      await updatePro.mutateAsync({
        businessName: businessName.trim() || undefined,
        ...(hasExistingTaxId
          ? {}
          : { taxId: taxId.trim() ? taxId.trim().toUpperCase() : undefined }),
        bio: bio.trim(),
        hourlyRate:
          supportsHourlyRate && hourlyRate ? Number(hourlyRate) : undefined,
        serviceRadiusKm: Number(serviceRadiusKm) || 50,
        skills: selectedCategories,
        ...(matchedApiCategoryIds.length > 0
          ? { categoryIds: matchedApiCategoryIds }
          : {}),
        latitude: address.latitude,
        longitude: address.longitude,
        city: address.city,
        postalCode: address.postalCode,
        province: address.province,
        region: address.region,
        address: address.address,
      });
      setDraft({});
      toast.success('Perfil profesional actualizado');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo actualizar',
      );
    }
  };

  const proLabel =
    businessName || pro?.user?.profile?.displayName || 'Profesional Yewi';

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Perfil profesional" solidSurface />

      <FormScroll>
        <View style={s.identityWrap}>
          <View style={s.identityRow}>
            <Avatar name={proLabel} avatarUrl={pro?.user?.profile?.avatarUrl ?? undefined} size={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" numberOfLines={1} style={{ color: colors.text }}>
                {proLabel}
              </Text>
              {taxId ? (
                <Text variant="caption" tone="muted">
                  NIF/CIF: {taxId}
                </Text>
              ) : null}
            </View>
          </View>
          <Divider />
        </View>

        <Text style={[s.sectionHeader, { color: colors.textMuted }]}>
          Datos del negocio
        </Text>

        <Field
          icon="briefcase"
          label="Nombre comercial o empresa"
          placeholder="Ej: Reformas Express"
          value={businessName}
          onChangeText={setBusinessName}
        />
        <Field
          icon="credit-card"
          label="NIF / NIE / CIF"
          placeholder="12345678Z"
          autoCapitalize="characters"
          value={taxId}
          editable={!hasExistingTaxId}
          onChangeText={setTaxId}
          hint={
            hasExistingTaxId
              ? 'El CIF/NIF/NIE no se puede modificar.'
              : undefined
          }
          boxStyle={
            hasExistingTaxId
              ? { backgroundColor: colors.surfaceSubtle }
              : undefined
          }
          style={hasExistingTaxId ? { color: colors.textMuted } : undefined}
        />
        <Field
          icon="align-left"
          label="Descripción profesional"
          placeholder="Cuéntale a los clientes tu experiencia y especialidades..."
          multiline
          numberOfLines={4}
          value={bio}
          onChangeText={setBio}
        />

        <View style={s.categoriesSection}>
          <Text variant="label" style={{ color: colors.text, fontWeight: '600' }}>
            Categorías
          </Text>
          <View style={s.categoriesWrap}>
            {categoryOptions.map((cat) => {
              const selected = selectedCategories.includes(cat.name);
              return (
                <PillTab
                  key={cat.id}
                  label={cat.name}
                  size="sm"
                  tone="contrast"
                  active={selected}
                  onPress={() => toggleCategory(cat.name)}
                />
              );
            })}
          </View>
        </View>

        {supportsHourlyRate ? (
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field
                icon="dollar-sign"
                label="Tarifa €/hora"
                keyboardType="numeric"
                placeholder="35"
                value={hourlyRate}
                onChangeText={setHourlyRate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                icon="compass"
                label="Radio servicio (km)"
                keyboardType="numeric"
                placeholder="50"
                value={serviceRadiusKm}
                onChangeText={setServiceRadiusKm}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: space.xs }}>
            <Field
              icon="compass"
              label="Radio servicio (km)"
              keyboardType="numeric"
              placeholder="50"
              value={serviceRadiusKm}
              onChangeText={setServiceRadiusKm}
              hint="Este tipo de trabajo se presupuesta por obra, no por horas."
            />
          </View>
        )}

        <AddressAutocomplete
          value={address}
          onChange={(next) =>
            setAddress({
              city: next.city,
              postalCode: next.postalCode,
              province: next.province || '',
              region: next.region || '',
              address: next.address || '',
              latitude: next.latitude,
              longitude: next.longitude,
            })
          }
        />

        <Button
          title="Guardar perfil profesional"
          loading={updatePro.isPending}
          onPress={handleSavePro}
        />

        <View style={{ marginHorizontal: -gutter }}>
          <ListGroup>
            <ListRow
              icon="image"
              plainIcon
              title="Portafolio de trabajos"
              subtitle="Sube fotos o videos y previsualiza tus proyectos"
              chevron
              onPress={() => router.push('/(tabs)/profile/portfolio' as never)}
            />
          </ListGroup>
        </View>
      </FormScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  identityWrap: {
    marginHorizontal: -gutter,
    marginTop: -space.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  sectionHeader: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  categoriesSection: {
    gap: space.sm,
    marginBottom: 12,
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  row2: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
