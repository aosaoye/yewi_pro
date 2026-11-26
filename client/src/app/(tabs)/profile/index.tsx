import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useMe,
  useMyGigs,
  useMyProProfile,
  useMyRequests,
  useOrders,
  useSubscription,
  useUpdateProfile,
  useUserReviews,
  useWallet,
} from '@/api/hooks';
import { professionalsApi } from '@/api/services';
import { AppHeader } from '@/components/AppHeader';
import { MediaCollage } from '@/components/MediaCollage';
import { ProfileShell } from '@/components/ProfileShell';
import { type ProfileTab } from '@/components/ProfileTabs';
import {
  GigGrid,
  LeadOpportunityCard,
  OrderRowCard,
  ReviewCard,
} from '@/components/YewiCards';
import { formatEur, formatShortDate } from '@/lib/format';
import { openPortfolioGallery } from '@/lib/portfolioViewer';
import { getAccessToken, onSessionChange } from '@/lib/session';
import { useFavoritesStore } from '@/lib/stores';
import {
  Avatar,
  Button,
  Divider,
  EmptyState,
  gutter,
  ListGroup,
  ListRow,
  Screen,
  Sheet,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

type ProfileTabId =
  | 'publicaciones'
  | 'portafolio'
  | 'resenas'
  | 'pedidos'
  | 'clientes';

export default function ProfileHomeScreen() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [hasSession, setHasSession] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('publicaciones');
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    void getAccessToken().then((t) => setHasSession(Boolean(t)));
    return onSessionChange((loggedIn) => setHasSession(loggedIn));
  }, []);

  const savedProIds = useFavoritesStore((st) => st.savedProIds);

  const meQuery = useMe(hasSession);
  const isProMode = Boolean(
    meQuery.data?.roles?.includes('PROFESSIONAL') ||
      meQuery.data?.professionalProfile,
  );
  const walletQuery = useWallet(hasSession);
  const subQuery = useSubscription(hasSession);
  const ordersQuery = useOrders(isProMode ? 'pro' : 'client', hasSession);
  const myRequestsQuery = useMyRequests(hasSession && !isProMode);
  const myGigsQuery = useMyGigs(hasSession && isProMode);
  const myProQuery = useMyProProfile(hasSession && isProMode);
  const myReviewsQuery = useUserReviews(
    meQuery.data?.id,
    hasSession && isProMode && Boolean(meQuery.data?.id),
  );

  const updateProfile = useUpdateProfile();

  const clientsList = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        avatarUrl?: string | null;
        city?: string | null;
        ordersCount: number;
        lastOrderId: string;
      }
    >();
    for (const ord of ordersQuery.data ?? []) {
      const clientId = ord.client?.id || ord.clientId;
      if (!clientId) continue;
      const profile = ord.client?.profile;
      const name =
        profile?.displayName ||
        [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
        'Cliente Yewi';
      const existing = map.get(clientId);
      if (existing) {
        existing.ordersCount += 1;
      } else {
        map.set(clientId, {
          id: clientId,
          name,
          avatarUrl: profile?.avatarUrl,
          city: profile?.city,
          ordersCount: 1,
          lastOrderId: ord.id,
        });
      }
    }
    return Array.from(map.values());
  }, [ordersQuery.data]);

  if (!hasSession) {
    return (
      <Screen edges={['bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <AppHeader
            userName="Yewi"
            title="Perfil"
            actions={[
              {
                icon: 'settings',
                label: 'Preferencias',
                onPress: () =>
                  router.push('/(tabs)/profile/preferences' as never),
              },
            ]}
          />
          <View style={s.centerWrap}>
            <EmptyState
              icon="user"
              title="Tu cuenta"
              message="Inicia sesión para continuar."
              actionLabel="Iniciar sesión"
              onAction={() => router.push('/(auth)/login' as never)}
            />
            <Button
              variant="secondary"
              title="Apariencia"
              onPress={() => router.push('/(tabs)/profile/preferences' as never)}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const me = meQuery.data;
  const fullName =
    me?.profile?.displayName ||
    [me?.profile?.firstName, me?.profile?.lastName].filter(Boolean).join(' ') ||
    me?.email?.split('@')[0] ||
    'Usuario Yewi';
  const isPro = Boolean(
    me?.isPro || me?.professionalProfile?.isPro || subQuery.data?.isPro,
  );
  const resolvedAvatar = localAvatarUri ?? me?.profile?.avatarUrl ?? undefined;
  const walletBalance = walletQuery.data?.fiatAvailableBalance ?? 0;
  const orders = ordersQuery.data ?? [];
  const portfolioItems = myProQuery.data?.portfolioItems ?? [];
  const followersCount = me?.professionalProfile?.totalReviews ?? 0;
  const ownProId = me?.professionalProfile?.id;
  const followingCount = ownProId
    ? savedProIds.filter((id) => id !== ownProId).length
    : savedProIds.length;

  const profileTabs: readonly ProfileTab<ProfileTabId>[] = isProMode
    ? [
        { id: 'publicaciones', label: 'Servicios', icon: 'layers' },
        { id: 'portafolio', label: 'Portafolio', icon: 'image' },
        { id: 'resenas', label: 'Reseñas', icon: 'star' },
        { id: 'pedidos', label: 'Pedidos', icon: 'shopping-bag' },
        { id: 'clientes', label: 'Clientes', icon: 'users' },
      ]
    : [];

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Perfil de ${fullName}`,
        message: `${fullName} en Yewi · ${orders.length} pedidos · ${me?.profile?.city || 'España'}`,
      });
    } catch {
      // Cancelado por el usuario
    }
  };

  const handleSelectPhoto = async (source: 'camera' | 'gallery') => {
    setPhotoSheetOpen(false);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        toast.error(
          source === 'camera'
            ? 'Permiso de cámara requerido'
            : 'Permiso de galería requerido',
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              base64: true,
            });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      setLocalAvatarUri(asset.uri);

      try {
        const payload = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        const uploaded = await professionalsApi.uploadPortfolioImage(payload);
        await updateProfile.mutateAsync({ avatarUrl: uploaded.url });
        toast.success('Foto de perfil actualizada');
      } catch {
        toast.info('Foto aplicada en vista previa local');
      }
    } catch {
      toast.error('No se pudo abrir el selector de imágenes');
    }
  };

  const metaText = me?.createdAt
    ? `Miembro desde ${formatShortDate(me.createdAt)}`
    : 'Cuenta verificada en Yewi';

  const overlays = (
    <>
      {photoSheetOpen ? (
        <View style={[s.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPhotoSheetOpen(false)}
          />
          <Sheet
            style={{
              paddingBottom: Math.max(bottom, space.xl),
              gap: space.xs,
            }}
          >
            <Text variant="heading" style={{ color: colors.text }}>
              Cambiar foto de perfil
            </Text>
            <Divider />
            <ListRow
              icon="camera"
              plainIcon
              title="Tomar foto"
              onPress={() => void handleSelectPhoto('camera')}
            />
            <Divider />
            <ListRow
              icon="image"
              plainIcon
              title="Elegir foto existente"
              onPress={() => void handleSelectPhoto('gallery')}
            />
            <Button
              variant="secondary"
              title="Cancelar"
              onPress={() => setPhotoSheetOpen(false)}
              style={{ marginTop: space.sm }}
            />
          </Sheet>
        </View>
      ) : null}
    </>
  );

  return (
    <ProfileShell
      displayName={fullName}
      stickySubtitle={`${orders.length} pedidos · ${formatEur(walletBalance)}`}
      avatarUrl={resolvedAvatar}
      badge={isPro ? { icon: 'badge-check', tone: 'primary' } : undefined}
      handleLine={`${me?.profile?.city || 'España'} · ${me?.email ?? ''}`}
      metaIcon="calendar"
      metaText={metaText}
      headerActions={[
        {
          icon: 'bell',
          label: 'Notificaciones',
          onPress: () => router.push('/notifications' as never),
        },
        {
          icon: 'settings',
          label: 'Ajustes',
          onPress: () => router.push('/(tabs)/profile/settings' as never),
        },
      ]}
      onAvatarPress={() => setPhotoSheetOpen(true)}
      stats={[
        {
          value: followingCount,
          label: 'Siguiendo',
          onPress: () =>
            router.push('/(tabs)/profile/following?tab=following' as never),
          accessibilityLabel: 'Ver a quién sigues',
        },
        ...(isProMode
          ? [
              {
                value: followersCount,
                label: 'Seguidores',
                onPress: () =>
                  router.push('/(tabs)/profile/following?tab=followers' as never),
                accessibilityLabel: 'Ver seguidores',
              },
            ]
          : []),
      ]}
      actions={[
        {
          label: 'Compartir',
          variant: 'outline',
          onPress: () => void handleShare(),
          accessibilityLabel: 'Compartir perfil',
        },
        {
          label: 'Editar perfil',
          variant: 'outline',
          onPress: () => router.push('/(tabs)/profile/account' as never),
          accessibilityLabel: 'Editar perfil',
        },
      ]}
      tabs={profileTabs}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      loading={meQuery.isLoading}
      overlays={overlays}
    >
      {!isProMode ? (
        <View style={{ paddingTop: space.md }}>
          <ListGroup title="Tu cuenta">
            <ListRow
              icon="clipboard"
              plainIcon
              title="Mis encargos"
              subtitle={`${(myRequestsQuery.data ?? []).length} solicitudes · ${orders.length} pedidos`}
              chevron
              onPress={() => router.navigate('/(tabs)/requests' as never)}
            />
            <ListRow
              icon="users"
              plainIcon
              title="Profesionales seguidos"
              subtitle={`${followingCount} guardados`}
              chevron
              onPress={() =>
                router.push('/(tabs)/profile/following?tab=following' as never)
              }
            />
            <ListRow
              icon="credit-card"
              plainIcon
              title="Billetera y pagos"
              subtitle={formatEur(walletBalance)}
              chevron
              onPress={() => router.push('/wallet' as never)}
            />
          </ListGroup>
        </View>
      ) : null}

      {isProMode && activeTab === 'resenas' ? (
        <View>
          {(myReviewsQuery.data ?? []).length > 0 ? (
            (myReviewsQuery.data ?? []).map((rev, idx) => (
              <React.Fragment key={rev.id}>
                {idx > 0 ? <Divider /> : null}
                <ReviewCard
                  review={rev}
                  onReplied={() => void myReviewsQuery.refetch()}
                />
              </React.Fragment>
            ))
          ) : (
            <EmptyState icon="star" title="Sin reseñas" />
          )}
        </View>
      ) : null}

      {isProMode && activeTab === 'pedidos' ? (
        <View>
          {orders.length > 0 ? (
            orders.map((ord, idx) => (
              <React.Fragment key={ord.id}>
                {idx > 0 ? <Divider /> : null}
                <OrderRowCard
                  order={ord}
                  onPress={() =>
                    router.push(
                      `/conversation?orderId=${encodeURIComponent(ord.id)}` as never,
                    )
                  }
                />
              </React.Fragment>
            ))
          ) : (
            <EmptyState
              icon="shopping-bag"
              title="Sin pedidos"
              actionLabel="Explorar servicios"
              onAction={() => router.push('/(tabs)/search' as never)}
            />
          )}
        </View>
      ) : null}

      {isProMode && activeTab === 'publicaciones' ? (
        <View>
          {isProMode ? (
            (myGigsQuery.data ?? []).length > 0 ? (
              <GigGrid
                gigs={myGigsQuery.data ?? []}
                onPressGig={(gig) =>
                  router.push(
                    `/detail?id=${encodeURIComponent(gig.slug || gig.id)}` as never,
                  )
                }
              />
            ) : (
              <EmptyState
                icon="layers"
                title="Sin servicios"
                actionLabel="Publicar servicio"
                onAction={() => router.push('/publish-gig' as never)}
              />
            )
          ) : (myRequestsQuery.data ?? []).length > 0 ? (
            (myRequestsQuery.data ?? []).map((reqItem, idx) => (
              <React.Fragment key={reqItem.id}>
                {idx > 0 ? <Divider /> : null}
                <LeadOpportunityCard
                  lead={reqItem}
                  onPress={() =>
                    router.push(
                      `/request-detail?id=${encodeURIComponent(reqItem.id)}` as never,
                    )
                  }
                />
              </React.Fragment>
            ))
          ) : (
            <EmptyState
              icon="clipboard"
              title="Sin solicitudes"
              actionLabel="Crear solicitud"
              onAction={() => router.push('/create-request' as never)}
            />
          )}
        </View>
      ) : null}

      {isProMode && activeTab === 'portafolio' ? (
        <View style={s.portfolioTabWrap}>
          {portfolioItems.length > 0 ? (
            <>
              {portfolioItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {idx > 0 ? <Divider /> : null}
                  <View style={s.portfolioCard}>
                    {(item.imageUrls?.length ?? 0) > 0 ? (
                      <MediaCollage
                        items={item.imageUrls.map((url) => ({ uri: url }))}
                        onPressItem={(mediaIdx) => {
                          openPortfolioGallery({
                            title: item.title,
                            description: item.description,
                            items: item.imageUrls.map((url) => ({ uri: url })),
                            initialIndex: mediaIdx,
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
              ))}
              <View style={s.portfolioFooterBtn}>
                <Button
                  variant="secondary"
                  icon="plus"
                  title="Añadir al portafolio"
                  onPress={() =>
                    router.push('/(tabs)/profile/portfolio' as never)
                  }
                />
              </View>
            </>
          ) : (
            <EmptyState
              icon="image"
              title="Sin trabajos en tu portafolio"
              message="Sube fotos de tus trabajos realizados."
              actionLabel="Añadir trabajo"
              onAction={() => router.push('/(tabs)/profile/portfolio' as never)}
            />
          )}
        </View>
      ) : null}

      {isProMode && activeTab === 'clientes' ? (
        clientsList.length > 0 ? (
          <ListGroup>
            {clientsList.map((client) => (
              <ListRow
                key={client.id}
                left={
                  <Avatar
                    name={client.name}
                    avatarUrl={client.avatarUrl}
                    size={40}
                  />
                }
                title={client.name}
                subtitle={`${client.city ? `${client.city} · ` : ''}${client.ordersCount} ${client.ordersCount === 1 ? 'pedido' : 'pedidos'}`}
                onPress={() =>
                  router.push(
                    `/conversation?orderId=${encodeURIComponent(client.lastOrderId)}` as never,
                  )
                }
              />
            ))}
          </ListGroup>
        ) : (
          <EmptyState
            icon="users"
            title="Sin clientes todavía"
            message="Tus clientes aparecerán aquí cuando recibas pedidos."
          />
        )
      ) : null}
    </ProfileShell>
  );
}

const s = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: gutter,
    gap: space.md,
  },
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
  portfolioTabWrap: {
    paddingTop: space.sm,
  },
  portfolioFooterBtn: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
  },
  portfolioCard: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: space.sm,
  },
});
