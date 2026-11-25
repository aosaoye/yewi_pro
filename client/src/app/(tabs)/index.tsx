import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  useGigs,
  useMe,
  useProfessionals,
  useUnreadNotificationsCount,
  useWallet,
} from '@/api/hooks';
import { AppHeader } from '@/components/AppHeader';
import { PortfolioBarChart } from '@/components/PortfolioBarChart';
import { SearchBar } from '@/components/SearchBar';
import { GigCard, SuggestedProCard } from '@/components/YewiCards';
import { buildMonthlyFinancialSeries } from '@/lib/analytics';
import { isOwnProfessional } from '@/lib/format';
import { getAccessToken, onSessionChange } from '@/lib/session';
import { useFavoritesStore, usePreferencesStore } from '@/lib/stores';
import {
  AppIcon,
  EmptyState,
  ErrorState,
  fonts,
  gutter,
  radius,
  Screen,
  SkeletonRows,
  space,
  Text,
  useTheme,
} from '@/ui';

export default function HomeScreen() {
  const { colors } = useTheme();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    void getAccessToken().then((t) => setHasSession(Boolean(t)));
    return onSessionChange((loggedIn) => setHasSession(loggedIn));
  }, []);

  const meQuery = useMe(hasSession);
  const unreadQuery = useUnreadNotificationsCount(hasSession);
  const walletQuery = useWallet(hasSession);
  const gigsQuery = useGigs({ limit: 12 });
  const prosQuery = useProfessionals({ limit: 8 });

  const homeBalanceSeries = useMemo(() => {
    const txs = walletQuery.data?.transactions ?? [];
    return buildMonthlyFinancialSeries(txs, 6).map((m) => ({
      key: m.key,
      label: m.shortLabel,
      capLabel: m.capLabel,
      value: Math.max(0, m.income),
    }));
  }, [walletQuery.data?.transactions]);

  const activeRole = usePreferencesStore((s) => s.activeRole);
  const savedGigIds = useFavoritesStore((s) => s.savedGigIds);
  const toggleGig = useFavoritesStore((s) => s.toggleGig);
  const savedProIds = useFavoritesStore((s) => s.savedProIds);
  const togglePro = useFavoritesStore((s) => s.togglePro);

  const user = meQuery.data;
  const userName =
    user?.profile?.displayName ||
    [user?.profile?.firstName, user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    user?.email?.split('@')[0] ||
    'Yewi';

  const isProMode = Boolean(
    user?.roles?.includes('PROFESSIONAL') ||
      user?.professionalProfile ||
      (!user && activeRole === 'PROFESSIONAL'),
  );
  const isProIncomplete =
    hasSession &&
    Boolean(user) &&
    (activeRole === 'PROFESSIONAL' ||
      Boolean(user?.roles?.includes('PROFESSIONAL'))) &&
    !user?.professionalProfile?.taxId;
  const gigsList = gigsQuery.data ?? [];
  const prosList = (prosQuery.data?.items ?? []).filter(
    (pro) => !isOwnProfessional(pro, user),
  );

  const refreshing = gigsQuery.isRefetching || prosQuery.isRefetching;

  const handleRefresh = () => {
    void gigsQuery.refetch();
    void prosQuery.refetch();
    if (hasSession) {
      void unreadQuery.refetch();
      void walletQuery.refetch();
    }
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <AppHeader
          userName={userName}
          avatarUrl={user?.profile?.avatarUrl}
          title="Yewi"
          actions={[
            {
              icon: 'plus',
              label: isProMode ? 'Publicar servicio' : 'Pedir presupuesto',
              onPress: () =>
                router.push(
                  (isProMode ? '/publish-gig' : '/create-request') as never,
                ),
            },
            {
              icon: 'bell',
              label: 'Notificaciones',
              badgeCount: unreadQuery.data?.unreadCount ?? 0,
              onPress: () => router.push('/notifications' as never),
            },
          ]}
        />

        {isProIncomplete ? (
          <Pressable
            onPress={() =>
              router.push('/(tabs)/profile/professional' as never)
            }
            accessibilityRole="button"
            accessibilityLabel="Completar datos fiscales y actividad"
            style={({ pressed }) => [
              s.fiscalAlert,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.warning,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <AppIcon name="alert-triangle" size={18} color={colors.warning} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                variant="label"
                style={{ color: colors.text, fontFamily: fonts.bold }}
              >
                Completa tus datos fiscales
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                Añade tu NIF/CIF y actividad profesional para recibir encargos.
              </Text>
            </View>
            <AppIcon name="chevron-right" size={18} color={colors.warning} />
          </Pressable>
        ) : null}

        {hasSession &&
        (walletQuery.data?.transactions?.length ?? 0) > 0 ? (
          <View style={{ paddingTop: space.sm }}>
            <PortfolioBarChart
              title="Actividad"
              subtitle="Últimos 6 meses"
              data={homeBalanceSeries}
            />
          </View>
        ) : null}

        {/* Acceso rápido tipo input de búsqueda hacia Explorar */}
        <View style={{ paddingTop: space.md }}>
          <SearchBar
            placeholder="Buscar servicio o profesional..."
            onPress={() => router.push('/(tabs)/search' as never)}
          />
        </View>

        {prosList.length > 0 ? (
          <View style={{ paddingTop: space.md, gap: space.sm }}>
            <View style={s.listHeading}>
              <Text variant="heading" style={{ color: colors.text }}>
                A quién seguir
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/search?tab=pros' as never)}
              >
                <Text
                  variant="caption"
                  style={{ color: colors.primary, fontFamily: fonts.semibold }}
                >
                  Ver todos
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
            >
              {prosList.map((pro) => (
                <SuggestedProCard
                  key={pro.id}
                  pro={pro}
                  following={savedProIds.includes(pro.id)}
                  onToggleFollow={() => togglePro(pro.id)}
                  onPress={() =>
                    router.push(
                      `/professional-profile?id=${encodeURIComponent(pro.id)}` as never,
                    )
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Carrusel horizontal de Servicios inspirados en tu historial de búsqueda */}
        <View style={{ paddingTop: space.lg }}>
          <View style={s.listHeading}>
            <Text
              variant="heading"
              style={{ color: colors.text, flex: 1, marginRight: space.sm }}
            >
              Inspirados en tu historial de búsqueda
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/search' as never)}>
              <Text
                variant="caption"
                style={{ color: colors.primary, fontFamily: fonts.semibold }}
              >
                Ver todos
              </Text>
            </Pressable>
          </View>

          {gigsQuery.isLoading ? (
            <SkeletonRows count={3} />
          ) : gigsQuery.isError ? (
            <ErrorState
              error={gigsQuery.error}
              onRetry={() => void gigsQuery.refetch()}
            />
          ) : gigsList.length === 0 ? (
            <EmptyState
              icon="package"
              title="Sin servicios"
              message="Prueba otra categoría."
              actionLabel={isProMode ? 'Publicar servicio' : 'Pedir presupuesto'}
              onAction={() =>
                router.push(
                  (isProMode ? '/publish-gig' : '/create-request') as never,
                )
              }
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
            >
              {gigsList.map((gig) => (
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
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingBottom: space.xxl,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
  },
  gigCarouselItem: {
    width: 210,
  },
  fiscalAlert: {
    marginHorizontal: gutter,
    marginTop: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
