import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useMe, usePublicPro } from '@/api/hooks';
import { MediaCollage } from '@/components/MediaCollage';
import {
  type ProfileActionButton,
  ProfileShell,
} from '@/components/ProfileShell';
import { type ProfileTab } from '@/components/ProfileTabs';
import { GigGrid, ReviewCard } from '@/components/YewiCards';
import { formatEur, hasValidRating, isOwnProfessional } from '@/lib/format';
import { openPortfolioGallery } from '@/lib/portfolioViewer';
import { useFavoritesStore } from '@/lib/stores';
import {
  AppIcon,
  Divider,
  EmptyState,
  ErrorState,
  gutter,
  ListGroup,
  ListRow,
  NavHeader,
  PillBadge,
  Screen,
  space,
  Text,
  useTheme,
} from '@/ui';

type PublicProTabId = 'servicios' | 'portafolio' | 'resenas' | 'info';

const PUBLIC_PRO_TABS: readonly ProfileTab<PublicProTabId>[] = [
  { id: 'servicios', label: 'Servicios', icon: 'layers' },
  { id: 'portafolio', label: 'Portafolio', icon: 'image' },
  { id: 'resenas', label: 'Reseñas', icon: 'star' },
  { id: 'info', label: 'Info', icon: 'info' },
];

export default function PublicProfessionalProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<PublicProTabId>('servicios');
  const meQuery = useMe();
  const proQuery = usePublicPro(id ?? '');
  const savedProIds = useFavoritesStore((st) => st.savedProIds);
  const togglePro = useFavoritesStore((st) => st.togglePro);

  const pro = proQuery.data;

  if (proQuery.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Perfil profesional" />
        <ErrorState
          error={proQuery.error}
          onRetry={() => void proQuery.refetch()}
        />
      </Screen>
    );
  }

  if (!proQuery.isLoading && !pro) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Profesional" />
        <EmptyState
          icon="user-x"
          title="Profesional no encontrado"
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const displayName =
    pro?.businessName ||
    pro?.user?.profile?.displayName ||
    [pro?.user?.profile?.firstName, pro?.user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Profesional Yewi';

  const city = pro?.city || pro?.user?.profile?.city || 'España';
  const isVerified = pro?.kycStatus === 'VERIFIED';
  const gigs = pro?.gigs ?? [];
  const portfolio = pro?.portfolioItems ?? [];
  const reviews = pro?.reviews ?? [];
  const skills = pro?.skills ?? [];
  const hasRating = hasValidRating(pro?.avgRating, pro?.totalReviews);
  const ratingText = hasRating ? `★ ${Number(pro?.avgRating).toFixed(1)}` : '—';
  const completedCount = pro?.completedOrdersCount || 0;

  const handleShare = async () => {
    try {
      const shareRating = hasRating
        ? `${ratingText} (${pro?.totalReviews || 0} reseñas)`
        : 'Sin valoraciones';
      await Share.share({
        title: `${displayName} en Yewi`,
        message: `${displayName} · ${city} · ${shareRating} en Yewi`,
      });
    } catch {
      // Cancelado por el usuario
    }
  };

  const metaParts: string[] = [];
  if (pro?.hourlyRate) {
    metaParts.push(`Tarifa ${formatEur(pro.hourlyRate)}/h`);
  }
  const metaText = metaParts.length > 0 ? metaParts.join(' · ') : undefined;

  const isOwnProfile = isOwnProfessional(pro, meQuery.data);
  const isFollowing = Boolean(
    !isOwnProfile && pro?.id && savedProIds.includes(pro.id),
  );
  const followersCount = (pro?.totalReviews ?? 0) + (isFollowing ? 1 : 0);
  const actions: ProfileActionButton[] = [];
  if (isOwnProfile) {
    actions.push({
      label: 'Editar perfil',
      variant: 'outline',
      onPress: () => router.push('/(tabs)/profile/account' as never),
    });
  } else {
    if (pro) {
      actions.push({
        label: isFollowing ? 'Siguiendo' : 'Seguir',
        variant: isFollowing ? 'outline' : 'primary',
        onPress: () => togglePro(pro.id),
      });
    }
    if (pro?.userId) {
      actions.push({
        label: 'Mensaje',
        variant: 'outline',
        onPress: () =>
          router.push(
            `/conversation?userId=${encodeURIComponent(pro.userId!)}` as never,
          ),
      });
    }
    if (pro) {
      actions.push({
        label: 'Valorar',
        variant: 'outline',
        onPress: () =>
          router.push(
            `/create-review?professionalProfileId=${encodeURIComponent(pro.id)}` as never,
          ),
      });
    }
  }

  return (
    <ProfileShell
      displayName={displayName}
      stickySubtitle={`${hasRating ? ratingText : 'Sin valoraciones'} · ${completedCount} trabajos · ${city}`}
      avatarUrl={pro?.user?.profile?.avatarUrl}
      coverSeed={pro?.id || displayName}
      badge={pro?.isPro ? { icon: 'badge-check', tone: 'primary' } : undefined}
      handleLine={city}
      bio={pro?.bio}
      metaIcon="briefcase"
      metaText={metaText}
      onBack={() => router.back()}
      headerActions={[
        {
          icon: 'share-2',
          label: 'Compartir profesional',
          onPress: () => void handleShare(),
        },
      ]}
      stats={[
        {
          value: ratingText,
          label: 'Estrellas',
          onPress: () => setActiveTab('resenas'),
          accessibilityLabel: 'Ver reseñas',
        },
        {
          value: followersCount,
          label: 'Seguidores',
        },
        {
          value: completedCount,
          label: 'Trabajos realizados',
        },
      ]}
      actions={actions}
      tabs={PUBLIC_PRO_TABS}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      loading={proQuery.isLoading}
    >
      {activeTab === 'servicios' ? (
        <View>
          {gigs.length > 0 ? (
            <GigGrid
              gigs={gigs}
              onPressGig={(g) =>
                router.push(
                  `/detail?id=${encodeURIComponent(g.slug || g.id)}` as never,
                )
              }
            />
          ) : (
            <EmptyState
              icon="layers"
              title="Sin servicios"
            />
          )}
        </View>
      ) : null}

      {activeTab === 'portafolio' ? (
        <View>
          {portfolio.length > 0 ? (
            portfolio.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 ? <Divider /> : null}
                <View style={s.openBlock}>
                  {(item.imageUrls?.length ?? 0) > 0 ? (
                    <MediaCollage
                      items={item.imageUrls.map((url) => ({ uri: url }))}
                      onPressItem={(idx) => {
                        openPortfolioGallery({
                          title: item.title,
                          description: item.description,
                          items: item.imageUrls.map((url) => ({ uri: url })),
                          initialIndex: idx,
                        });
                        router.push('/portfolio-detail' as never);
                      }}
                    />
                  ) : null}
                  <Text variant="heading" style={{ color: colors.text }}>
                    {item.title}
                  </Text>
                  <Text variant="body" tone="secondary">
                    {item.description}
                  </Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <EmptyState
              icon="image"
              title="Sin portafolio"
            />
          )}
        </View>
      ) : null}

      {activeTab === 'resenas' ? (
        <View>
          {reviews.length > 0 ? (
            reviews.map((rev, idx) => (
              <React.Fragment key={rev.id}>
                {idx > 0 ? <Divider /> : null}
                <ReviewCard
                  review={rev}
                  onReplied={() => void proQuery.refetch()}
                />
              </React.Fragment>
            ))
          ) : (
            <EmptyState
              icon="star"
              title="Sin reseñas"
              actionLabel={pro ? 'Escribir reseña' : undefined}
              onAction={
                pro
                  ? () =>
                      router.push(
                        `/create-review?professionalProfileId=${encodeURIComponent(pro.id)}` as never,
                      )
                  : undefined
              }
            />
          )}
        </View>
      ) : null}

      {activeTab === 'info' ? (
        <View>
          <ListGroup>
            <ListRow
              icon="map-pin"
              plainIcon
              title="Ubicación"
              subtitle={city}
              chevron={false}
            />
            <ListRow
              icon="shield"
              plainIcon
              title="Verificación"
              right={
                <AppIcon
                  name={isVerified ? 'shield-check' : 'shield'}
                  size={20}
                  color={isVerified ? colors.success : colors.textMuted}
                />
              }
              chevron={false}
            />
            {pro?.hourlyRate ? (
              <ListRow
                icon="clock"
                plainIcon
                title="Tarifa"
                subtitle={`${formatEur(pro.hourlyRate)}/h`}
                chevron={false}
              />
            ) : null}
          </ListGroup>
          {skills.length > 0 ? (
            <View style={s.openBlock}>
              <Text variant="heading" style={{ color: colors.text }}>
                Especialidades
              </Text>
              <View style={s.skillsWrap}>
                {skills.map((skill) => (
                  <PillBadge
                    key={skill}
                    label={skill}
                    tone="neutral"
                    variant="surface"
                    size="sm"
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </ProfileShell>
  );
}

const s = StyleSheet.create({
  openBlock: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: space.sm,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});
