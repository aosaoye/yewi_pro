import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useGigs, useMe, useProfessionals } from '@/api/hooks';
import { AppHeader, type AppHeaderTab } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FollowProRow, GigCard, GigGrid } from '@/components/YewiCards';
import { CATEGORIES_LIST } from '@/lib/categories';
import { isOwnProfessional } from '@/lib/format';
import { getAccessToken, onSessionChange } from '@/lib/session';
import { useExploreSettingsStore, useFavoritesStore } from '@/lib/stores';
import {
  EmptyState,
  ErrorState,
  fonts,
  gutter,
  type IconName,
  ListGroup,
  Screen,
  SkeletonRows,
  space,
  Text,
  useTheme,
} from '@/ui';

const EXPLORE_TABS: readonly AppHeaderTab[] = [
  { key: '', label: 'Todos', icon: 'layers' },
  ...CATEGORIES_LIST.map((c) => ({
    key: c.name,
    label: c.name,
    icon: c.icon as IconName,
  })),
];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const preferProsFirst = params.tab === 'pros';
  const { colors } = useTheme();
  const [hasSession, setHasSession] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );

  const useCurrentLocation = useExploreSettingsStore(
    (st) => st.useCurrentLocation,
  );
  const selectedCity = useExploreSettingsStore((st) => st.selectedCity);
  const distanceRadiusKm = useExploreSettingsStore(
    (st) => st.distanceRadiusKm,
  );

  useEffect(() => {
    void getAccessToken().then((t) => setHasSession(Boolean(t)));
    return onSessionChange((loggedIn) => setHasSession(loggedIn));
  }, []);

  useEffect(() => {
    if (!useCurrentLocation) return;
    let active = true;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted' || !active) return;
        const pos = await Location.getCurrentPositionAsync({});
        if (active) {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        }
      } catch {
        // Silencio seguro si no hay GPS disponible
      }
    })();
    return () => {
      active = false;
    };
  }, [useCurrentLocation]);

  const meQuery = useMe(hasSession);
  const savedGigIds = useFavoritesStore((st) => st.savedGigIds);
  const toggleGig = useFavoritesStore((st) => st.toggleGig);
  const savedProIds = useFavoritesStore((st) => st.savedProIds);
  const togglePro = useFavoritesStore((st) => st.togglePro);

  const gigFilters = useMemo(
    () => ({
      search: query.trim() || undefined,
      category: category || undefined,
      limit: 30,
    }),
    [query, category],
  );
  const proFilters = useMemo(
    () => ({
      q: query.trim() || undefined,
      category: category || undefined,
      ...(useCurrentLocation && coords
        ? {
            lat: coords.lat,
            lon: coords.lon,
            radiusKm: distanceRadiusKm,
          }
        : !useCurrentLocation && selectedCity
          ? { city: selectedCity }
          : {}),
      limit: 30,
    }),
    [query, category, useCurrentLocation, coords, distanceRadiusKm, selectedCity],
  );

  const gigsQuery = useGigs(gigFilters);
  const prosQuery = useProfessionals(proFilters);

  const user = meQuery.data;
  const userName =
    user?.profile?.displayName ||
    [user?.profile?.firstName, user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Yewi';

  const gigsList = useMemo(() => gigsQuery.data ?? [], [gigsQuery.data]);
  const prosList = prosQuery.data?.items ?? [];

  const gigsByCategory = useMemo(() => {
    const map = new Map<string, typeof gigsList>();
    for (const gig of gigsList) {
      const catName = gig.category?.name || 'Otros servicios';
      const list = map.get(catName) ?? [];
      list.push(gig);
      map.set(catName, list);
    }
    return Array.from(map.entries()).map(([catName, items]) => ({
      catName,
      items,
    }));
  }, [gigsList]);

  const gigsSection = (
    <View style={s.sectionBlock}>
      {category ? (
        <Text variant="heading" style={[s.sectionHeading, { color: colors.text }]}>
          Servicios
        </Text>
      ) : null}
      {gigsQuery.isLoading ? (
        <SkeletonRows count={4} />
      ) : gigsQuery.isError ? (
        <ErrorState
          error={gigsQuery.error}
          onRetry={() => void gigsQuery.refetch()}
        />
      ) : gigsList.length === 0 ? (
        <EmptyState
          icon="search"
          title="Sin resultados"
          message="Prueba otra búsqueda."
        />
      ) : category === '' ? (
        <View style={{ gap: space.lg }}>
          {gigsByCategory.map((group) => {
            const hasTab = EXPLORE_TABS.some((t) => t.key === group.catName);
            return (
              <View key={group.catName}>
                <View style={s.categoryHeader}>
                  <Text
                    variant="heading"
                    numberOfLines={1}
                    style={{ color: colors.text, flex: 1, marginRight: space.sm }}
                  >
                    {group.catName}
                  </Text>
                  {hasTab ? (
                    <Pressable onPress={() => setCategory(group.catName)}>
                      <Text
                        variant="caption"
                        style={{ color: colors.primary, fontFamily: fonts.semibold }}
                      >
                        Ver todos
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ width: '100%' }}
                  contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
                >
                  {group.items.map((gig) => (
                    <View key={gig.id} style={s.gigCarouselItem}>
                      <GigCard
                        gig={gig}
                        variant="compact"
                        saved={savedGigIds.includes(gig.id)}
                        onToggleSave={() => toggleGig(gig.id)}
                        onPress={() =>
                          router.push(
                            `/detail?id=${encodeURIComponent(gig.slug || gig.id)}` as never,
                          )
                        }
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </View>
      ) : (
        <GigGrid
          gigs={gigsList}
          savedIds={savedGigIds}
          onToggleSave={toggleGig}
          onPressGig={(gig) =>
            router.push(
              `/detail?id=${encodeURIComponent(gig.slug || gig.id)}` as never,
            )
          }
        />
      )}
    </View>
  );

  const prosSection = (
    <View style={s.sectionBlock}>
      <Text variant="heading" style={[s.sectionHeading, { color: colors.text }]}>
        Profesionales
      </Text>
      {prosQuery.isLoading ? (
        <SkeletonRows count={4} />
      ) : prosQuery.isError ? (
        <ErrorState
          error={prosQuery.error}
          onRetry={() => void prosQuery.refetch()}
        />
      ) : prosList.length === 0 ? (
        <EmptyState
          icon="users"
          title="Sin profesionales"
          message="Prueba otro filtro."
        />
      ) : (
        <ListGroup>
          {prosList.map((pro) => {
            const own = isOwnProfessional(pro, user);
            return (
              <FollowProRow
                key={pro.id}
                pro={pro}
                following={!own && savedProIds.includes(pro.id)}
                onToggleFollow={own ? undefined : () => togglePro(pro.id)}
                onPress={() =>
                  router.push(
                    (own
                      ? '/(tabs)/profile'
                      : `/professional-profile?id=${encodeURIComponent(pro.id)}`) as never,
                  )
                }
              />
            );
          })}
        </ListGroup>
      )}
    </View>
  );

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={gigsQuery.isRefetching || prosQuery.isRefetching}
            onRefresh={() => {
              void gigsQuery.refetch();
              void prosQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <AppHeader
          userName={userName}
          avatarUrl={user?.profile?.avatarUrl}
          title="Explorar"
          tabs={EXPLORE_TABS}
          activeTab={category}
          onSelectTab={setCategory}
          actions={[
            {
              icon: 'settings',
              label: 'Ajustes de Explorar',
              onPress: () => router.push('/search-settings' as never),
            },
          ]}
        />

        <View style={s.filtersBlock}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar servicio o profesional..."
          />
        </View>

        {preferProsFirst ? (
          <>
            {prosSection}
            {gigsSection}
          </>
        ) : (
          <>
            {gigsSection}
            {prosSection}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingBottom: space.xxl,
  },
  filtersBlock: {
    paddingTop: space.md,
  },
  sectionBlock: {
    paddingTop: space.md,
  },
  sectionHeading: {
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
  },
  gigCarouselItem: {
    width: 210,
  },
});
