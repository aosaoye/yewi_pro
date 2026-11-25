import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES_LIST } from '@/lib/categories';
import { useExploreSettingsStore } from '@/lib/stores';
import {
  AppIcon,
  Button,
  CustomSwitch,
  Divider,
  gutter,
  IconButton,
  ListGroup,
  ListRow,
  NavHeader,
  PillButton,
  Screen,
  Sheet,
  space,
  Text,
  useTheme,
} from '@/ui';

type ActiveExploreSheet = 'cities' | 'radius' | 'interests' | 'price' | null;

const CITY_OPTIONS = [
  'Zaragoza',
  'Madrid',
  'Barcelona',
  'Valencia',
  'Sevilla',
  'Bilbao',
  'Málaga',
  'Alicante',
  'Murcia',
  'Palma',
] as const;

const RADIUS_OPTIONS = [5, 10, 15, 25, 50, 100] as const;

const INTEREST_OPTIONS = Array.from(
  new Set([
    'Conciertos',
    'Gastronomía',
    'Teatro',
    'Cine',
    'Deportes',
    'Arte y Museos',
    'Aire libre',
    'Talleres',
    'Networking',
    ...CATEGORIES_LIST.map((c) => c.name),
  ]),
);

const PRICE_RANGE_OPTIONS = [
  'Cualquier precio',
  'Gratis o hasta 15 €',
  '15 € – 40 €',
  '40 € – 80 €',
  'Más de 80 € (Premium)',
] as const;

export default function SearchSettingsScreen() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [activeSheet, setActiveSheet] = useState<ActiveExploreSheet>(null);

  const useCurrentLocation = useExploreSettingsStore(
    (s) => s.useCurrentLocation,
  );
  const selectedCity = useExploreSettingsStore((s) => s.selectedCity);
  const distanceRadiusKm = useExploreSettingsStore((s) => s.distanceRadiusKm);
  const selectedInterests = useExploreSettingsStore((s) => s.selectedInterests);
  const onlyAvailableToday = useExploreSettingsStore(
    (s) => s.onlyAvailableToday,
  );
  const includeFreePlans = useExploreSettingsStore((s) => s.includeFreePlans);
  const trendingAndNew = useExploreSettingsStore((s) => s.trendingAndNew);
  const priceRange = useExploreSettingsStore((s) => s.priceRange);

  const setUseCurrentLocation = useExploreSettingsStore(
    (s) => s.setUseCurrentLocation,
  );
  const setSelectedCity = useExploreSettingsStore((s) => s.setSelectedCity);
  const setDistanceRadiusKm = useExploreSettingsStore(
    (s) => s.setDistanceRadiusKm,
  );
  const toggleInterest = useExploreSettingsStore((s) => s.toggleInterest);
  const setOnlyAvailableToday = useExploreSettingsStore(
    (s) => s.setOnlyAvailableToday,
  );
  const setIncludeFreePlans = useExploreSettingsStore(
    (s) => s.setIncludeFreePlans,
  );
  const setTrendingAndNew = useExploreSettingsStore((s) => s.setTrendingAndNew);
  const setPriceRange = useExploreSettingsStore((s) => s.setPriceRange);

  const interestsSummary =
    selectedInterests.length > 0
      ? selectedInterests.slice(0, 3).join(', ') +
        (selectedInterests.length > 3 ? '...' : '')
      : 'Seleccionar';

  const sheetTitle =
    activeSheet === 'cities'
      ? 'Explorar ciudades'
      : activeSheet === 'radius'
        ? 'Radio de distancia'
        : activeSheet === 'interests'
          ? 'Categorías e intereses'
          : 'Rango de precios habitual';

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Explorar" solidSurface />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        <ListGroup title="Ubicación y alcance">
          <ListRow
            title="Usar mi ubicación actual"
            subtitle="Muestra planes y eventos cerca de ti en tiempo real."
            chevron={false}
            right={
              <CustomSwitch
                value={useCurrentLocation}
                onValueChange={setUseCurrentLocation}
              />
            }
            onPress={() => setUseCurrentLocation(!useCurrentLocation)}
          />
          <ListRow
            title="Explorar ciudades"
            disabled={useCurrentLocation}
            right={
              <Text variant="body" tone="muted">
                {useCurrentLocation ? 'Seleccionar' : selectedCity}
              </Text>
            }
            chevron
            onPress={() => setActiveSheet('cities')}
          />
          <ListRow
            title="Radio de distancia"
            right={
              <Text variant="body" tone="muted" tabular>
                {distanceRadiusKm} km
              </Text>
            }
            chevron
            onPress={() => setActiveSheet('radius')}
          />
        </ListGroup>

        <ListGroup title="Personalización y categorías">
          <ListRow
            title="Categorías e intereses"
            subtitle={interestsSummary}
            chevron
            onPress={() => setActiveSheet('interests')}
          />
          <ListRow
            title="Solo planes disponibles hoy / este fin de semana"
            subtitle="Oculta eventos agotados o para fechas lejanas."
            chevron={false}
            right={
              <CustomSwitch
                value={onlyAvailableToday}
                onValueChange={setOnlyAvailableToday}
              />
            }
            onPress={() => setOnlyAvailableToday(!onlyAvailableToday)}
          />
          <ListRow
            title="Incluir planes gratuitos"
            subtitle="Muestra actividades y eventos sin coste de entrada junto a los de pago."
            chevron={false}
            right={
              <CustomSwitch
                value={includeFreePlans}
                onValueChange={setIncludeFreePlans}
              />
            }
            onPress={() => setIncludeFreePlans(!includeFreePlans)}
          />
        </ListGroup>

        <ListGroup title="Descubrimiento y alertas">
          <ListRow
            title="Planes trending y novedades"
            subtitle="Destaca los eventos más populares y recién publicados en tu ciudad."
            chevron={false}
            right={
              <CustomSwitch
                value={trendingAndNew}
                onValueChange={setTrendingAndNew}
              />
            }
            onPress={() => setTrendingAndNew(!trendingAndNew)}
          />
          <ListRow
            title="Rango de precios habitual"
            right={
              <Text variant="body" tone="muted" numberOfLines={1}>
                {priceRange}
              </Text>
            }
            chevron
            onPress={() => setActiveSheet('price')}
          />
        </ListGroup>
      </ScrollView>

      {activeSheet !== null ? (
        <View style={[s.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActiveSheet(null)}
          />
          <Sheet
            style={{
              paddingHorizontal: 0,
              paddingBottom: Math.max(bottom, space.xl),
              gap: space.sm,
            }}
          >
            <View style={s.sheetHeader}>
              <Text variant="heading" style={{ color: colors.text, flex: 1 }}>
                {sheetTitle}
              </Text>
              <IconButton
                name="x"
                label="Cerrar"
                tone="plain"
                onPress={() => setActiveSheet(null)}
              />
            </View>
            <Divider />

            {activeSheet === 'cities' ? (
              <ScrollView
                style={{ maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
              >
                <ListGroup>
                  {CITY_OPTIONS.map((cityName) => (
                    <ListRow
                      key={cityName}
                      title={cityName}
                      chevron={false}
                      right={
                        selectedCity === cityName ? (
                          <AppIcon
                            name="check"
                            size={18}
                            color={colors.primary}
                          />
                        ) : undefined
                      }
                      onPress={() => {
                        setSelectedCity(cityName);
                        setActiveSheet(null);
                      }}
                    />
                  ))}
                </ListGroup>
              </ScrollView>
            ) : null}

            {activeSheet === 'radius' ? (
              <ListGroup>
                {RADIUS_OPTIONS.map((km) => (
                  <ListRow
                    key={km}
                    title={`${km} km`}
                    chevron={false}
                    right={
                      distanceRadiusKm === km ? (
                        <AppIcon
                          name="check"
                          size={18}
                          color={colors.primary}
                        />
                      ) : undefined
                    }
                    onPress={() => {
                      setDistanceRadiusKm(km);
                      setActiveSheet(null);
                    }}
                  />
                ))}
              </ListGroup>
            ) : null}

            {activeSheet === 'interests' ? (
              <View style={{ gap: space.md }}>
                <ScrollView
                  style={{ maxHeight: 300 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.interestsGrid}
                >
                  {INTEREST_OPTIONS.map((tag) => {
                    const selected = selectedInterests.includes(tag);
                    return (
                      <PillButton
                        key={tag}
                        label={tag}
                        size="sm"
                        tone={selected ? 'primary' : 'neutral'}
                        variant={selected ? 'solid' : 'outline'}
                        active={selected}
                        onPress={() => toggleInterest(tag)}
                      />
                    );
                  })}
                </ScrollView>
                <View style={{ paddingHorizontal: gutter }}>
                  <Button
                    title="Listo"
                    onPress={() => setActiveSheet(null)}
                  />
                </View>
              </View>
            ) : null}

            {activeSheet === 'price' ? (
              <ListGroup>
                {PRICE_RANGE_OPTIONS.map((option) => (
                  <ListRow
                    key={option}
                    title={option}
                    chevron={false}
                    right={
                      priceRange === option ? (
                        <AppIcon
                          name="check"
                          size={18}
                          color={colors.primary}
                        />
                      ) : undefined
                    }
                    onPress={() => {
                      setPriceRange(option);
                      setActiveSheet(null);
                    }}
                  />
                ))}
              </ListGroup>
            ) : null}
          </Sheet>
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 10,
    justifyContent: 'flex-end',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: gutter,
    paddingRight: space.sm,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingVertical: space.xs,
  },
});
