import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateGigOrder, useGig, useMe } from '@/api/hooks';
import type { GigPackage } from '@/api/types';
import { ProfileTabs, type ProfileTab } from '@/components/ProfileTabs';
import { ReviewCard } from '@/components/YewiCards';
import {
  formatEur,
  hasValidRating,
  isOwnProfessional,
} from '@/lib/format';
import { purchaseGigOrderIap } from '@/lib/iapService';
import { queryClient } from '@/lib/queryClient';
import { payWithRedsysBizum } from '@/lib/redsysService';
import { getAccessToken } from '@/lib/session';
import { useFavoritesStore } from '@/lib/stores';
import {
  AppIcon,
  Avatar,
  Button,
  Cover,
  Divider,
  EmptyState,
  ErrorState,
  fonts,
  gutter,
  IconButton,
  NavHeader,
  Screen,
  SkeletonRows,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

function packageTabMeta(pkg: GigPackage, idx: number): ProfileTab<string> {
  const icon =
    pkg.tier === 'PREMIUM'
      ? 'star'
      : pkg.tier === 'STANDARD'
        ? 'layers'
        : 'package';
  return {
    id: String(idx),
    label: pkg.name.trim() || `Opción ${idx + 1}`,
    icon,
  };
}

export default function GigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const meQuery = useMe();
  const gigQuery = useGig(id ?? '');
  const createOrder = useCreateGigOrder();

  const savedGigIds = useFavoritesStore((st) => st.savedGigIds);
  const toggleGig = useFavoritesStore((st) => st.toggleGig);

  const [scrollY, setScrollY] = useState(0);
  const [selectedTierIdx, setSelectedTierIdx] = useState(0);
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [walletOrdering, setWalletOrdering] = useState(false);
  const [iapLoading, setIapLoading] = useState(false);
  const [bizumLoading, setBizumLoading] = useState(false);
  const paymentLockRef = useRef(false);

  const gig = gigQuery.data;
  const isScrolled = scrollY > 240;

  const packages: GigPackage[] = useMemo(
    () => gig?.packages ?? [],
    [gig?.packages],
  );
  const safeTierIdx =
    selectedTierIdx >= 0 && selectedTierIdx < packages.length
      ? selectedTierIdx
      : 0;
  const activePkg = packages[safeTierIdx] ?? packages[0];

  const packageTabs = useMemo(
    () => packages.map((pkg, idx) => packageTabMeta(pkg, idx)),
    [packages],
  );

  const extrasTotal = (gig?.extras ?? [])
    .filter((e) => selectedExtraIds.includes(e.id))
    .reduce((sum, e) => sum + Number(e.price || 0), 0);

  const finalPrice = Number(activePkg?.price || 0) + extrasTotal;
  const paymentBusy =
    createOrder.isPending || walletOrdering || iapLoading || bizumLoading;
  const isOwnGig = isOwnProfessional(gig?.professionalProfile, meQuery.data);

  const ensureAuth = async (): Promise<boolean> => {
    const token = await getAccessToken();
    if (!token) {
      toast.info('Inicia sesión para contratar este servicio');
      router.push('/(auth)/login' as never);
      return false;
    }
    return true;
  };

  const handleWalletOrder = async () => {
    if (!gig || !activePkg || paymentLockRef.current) return;
    paymentLockRef.current = true;
    setWalletOrdering(true);
    try {
      const authed = await ensureAuth();
      if (!authed) {
        paymentLockRef.current = false;
        setWalletOrdering(false);
        return;
      }
      const order = await createOrder.mutateAsync({
        gigPackageId: activePkg.id,
        gigId: gig.id,
        extraIds: selectedExtraIds,
      });
      toast.success(`Pedido ${order.orderNumber} creado en Escrow`);
      router.replace(
        `/conversation?orderId=${encodeURIComponent(order.id)}` as never,
      );
    } catch (err) {
      paymentLockRef.current = false;
      setWalletOrdering(false);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Saldo insuficiente o error al crear el pedido',
      );
    }
  };

  const handleIapOrder = async () => {
    if (!gig || !activePkg || paymentLockRef.current) return;
    paymentLockRef.current = true;
    setIapLoading(true);
    try {
      const authed = await ensureAuth();
      if (!authed) {
        paymentLockRef.current = false;
        setIapLoading(false);
        return;
      }
      const { order } = await purchaseGigOrderIap({
        gigId: gig.id,
        gigPackageId: activePkg.id,
        extraIds: selectedExtraIds,
        amount: finalPrice,
      });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(
        order?.orderNumber
          ? `Pedido ${order.orderNumber} contratado en la app`
          : 'Servicio contratado en la app',
      );
      if (order?.id) {
        router.replace(
          `/conversation?orderId=${encodeURIComponent(order.id)}` as never,
        );
        return;
      }
      paymentLockRef.current = false;
      setIapLoading(false);
    } catch (err) {
      paymentLockRef.current = false;
      setIapLoading(false);
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la compra integrada',
      );
    }
  };

  const handleBizumOrder = async () => {
    if (!gig || !activePkg || paymentLockRef.current) return;
    paymentLockRef.current = true;
    setBizumLoading(true);
    try {
      const authed = await ensureAuth();
      if (!authed) {
        paymentLockRef.current = false;
        setBizumLoading(false);
        return;
      }
      const res = await payWithRedsysBizum({
        purchaseType: 'GIG_ORDER',
        gigId: gig.id,
        gigPackageId: activePkg.id,
        extraIds: selectedExtraIds,
      });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(
        res.orderNumber
          ? `Pedido ${res.orderNumber} pagado con Bizum`
          : 'Servicio pagado con Bizum',
      );
      if (res.orderId) {
        router.replace(
          `/conversation?orderId=${encodeURIComponent(res.orderId)}` as never,
        );
        return;
      }
      paymentLockRef.current = false;
      setBizumLoading(false);
    } catch (err) {
      paymentLockRef.current = false;
      setBizumLoading(false);
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el pago con Bizum',
      );
    }
  };

  if (gigQuery.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Detalle del servicio" />
        <View style={{ padding: gutter }}>
          <SkeletonRows count={4} />
        </View>
      </Screen>
    );
  }

  if (gigQuery.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Detalle del servicio" />
        <ErrorState
          error={gigQuery.error}
          onRetry={() => void gigQuery.refetch()}
        />
      </Screen>
    );
  }

  if (!gig) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Servicio no encontrado" />
        <EmptyState
          icon="alert-circle"
          title="No encontramos este servicio"
          message="Puede haber sido pausado o eliminado por su profesional."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const proName =
    gig.professionalProfile?.businessName ||
    gig.professionalProfile?.user?.profile?.displayName ||
    'Profesional Yewi';
  const saved = savedGigIds.includes(gig.id);
  const coverImages = gig.coverImages?.filter(Boolean) ?? [];
  const heroHeight = 340 + top;
  const hasRating = hasValidRating(gig.avgRating, gig.totalReviews);
  const ratingValue = hasRating ? Number(gig.avgRating).toFixed(1) : '';
  const ratingCountLabel =
    gig.totalReviews === 1 ? '1 reseña' : `${gig.totalReviews ?? 0} reseñas`;

  const featuresList = Array.isArray(activePkg?.features)
    ? activePkg.features.filter(
        (item): item is string =>
          typeof item === 'string' && Boolean(item.trim()),
      )
    : [];

  const faqsList = Array.isArray(gig.faqs)
    ? (gig.faqs as { question: string; answer: string }[])
    : [];

  const extrasList = gig.extras ?? [];
  const reviewsList = gig.reviews ?? [];

  const handleGoEdit = () =>
    router.push(`/publish-gig?editId=${encodeURIComponent(gig.id)}` as never);

  return (
    <Screen edges={['bottom']}>
      {/* Cabecera sticky flotante reactiva al scroll */}
      <View
        style={[
          s.stickyHeader,
          { paddingTop: Math.max(top, space.sm) },
          isScrolled && {
            backgroundColor: colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <IconButton
          name="chevron-left"
          label="Volver"
          tone={isScrolled ? 'plain' : 'onImage'}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(tabs)' as never)
          }
        />

        <View style={s.stickyTitleWrap}>
          {isScrolled ? (
            <>
              <Text
                variant="heading"
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 16, lineHeight: 20 }}
              >
                {gig.title}
              </Text>
              {activePkg ? (
                <Text
                  variant="caption"
                  tabular
                  numberOfLines={1}
                  style={{ color: colors.textMuted, lineHeight: 16 }}
                >
                  {formatEur(finalPrice)}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {isOwnGig ? (
          <IconButton
            name="edit-2"
            label="Editar servicio"
            tone={isScrolled ? 'plain' : 'onImage'}
            onPress={handleGoEdit}
          />
        ) : (
          <IconButton
            name="heart"
            label={saved ? 'Quitar de guardados' : 'Guardar servicio'}
            tone={isScrolled ? 'plain' : 'onImage'}
            active={saved}
            onPress={() => toggleGig(gig.id)}
          />
        )}
      </View>

      <ScrollView
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xl }}
      >
        {/* Hero edge-to-edge con indicadores circulares abajo */}
        <View
          style={[
            s.heroWrap,
            {
              width: windowWidth,
              height: heroHeight,
              backgroundColor: colors.surfaceSubtle,
            },
          ]}
        >
          {coverImages.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(ev) => {
                const idx = Math.round(
                  ev.nativeEvent.contentOffset.x / Math.max(1, windowWidth),
                );
                setActiveSlide(idx);
              }}
            >
              {coverImages.map((imgUrl, idx) => (
                <Cover
                  key={`${imgUrl}-${idx}`}
                  seed={`${gig.id}-${idx}`}
                  imageUrl={imgUrl}
                  style={{ width: windowWidth, height: heroHeight }}
                />
              ))}
            </ScrollView>
          ) : (
            <Cover
              seed={gig.id}
              imageUrl={coverImages[0]}
              style={StyleSheet.absoluteFill}
            />
          )}

          {coverImages.length > 1 ? (
            <View style={s.heroDots}>
              {coverImages.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    s.heroDot,
                    {
                      backgroundColor:
                        idx === activeSlide
                          ? '#FFFFFF'
                          : 'rgba(255,255,255,0.45)',
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* Bloque principal: título izquierda, precio derecha, valoración real y descripción */}
        <View style={[s.mainBlock, { backgroundColor: colors.background }]}>
          <View style={s.titlePriceRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[
                  s.titleText,
                  { color: colors.text, fontFamily: fonts.bold },
                ]}
              >
                {gig.title}
              </Text>
              <View style={s.ratingRow}>
                {hasRating ? (
                  <>
                    <AppIcon
                      name="star"
                      size={14}
                      color={colors.warning}
                      fill={colors.warning}
                    />
                    <Text
                      variant="label"
                      tabular
                      style={{ color: colors.text, fontFamily: fonts.semibold }}
                    >
                      {ratingValue}
                    </Text>
                    <Text variant="caption" tone="muted">
                      · {ratingCountLabel}
                      {gig.category?.name ? ` · ${gig.category.name}` : ''}
                    </Text>
                  </>
                ) : (
                  <Text variant="caption" tone="muted">
                    Sin valoraciones
                    {gig.category?.name ? ` · ${gig.category.name}` : ''}
                  </Text>
                )}
              </View>
            </View>

            {activePkg ? (
              <Text
                tabular
                style={[
                  s.priceText,
                  { color: colors.text, fontFamily: fonts.bold },
                ]}
              >
                {formatEur(finalPrice)}
              </Text>
            ) : null}
          </View>

          <Text
            variant="body"
            style={{ color: colors.textSecondary, lineHeight: 22 }}
          >
            {gig.description}
          </Text>
        </View>

        {/* Datos del profesional abiertos sobre colors.background (sin fondo mate) */}
        {gig.professionalProfile ? (
          <>
            <Divider />
            <Pressable
              onPress={() =>
                router.push(
                  `/professional-profile?id=${encodeURIComponent(
                    gig.professionalProfile!.id,
                  )}` as never,
                )
              }
              style={({ pressed }) => [
                s.proRowOpen,
                pressed && { opacity: 0.72 },
              ]}
            >
              <Avatar
                name={proName}
                avatarUrl={gig.professionalProfile.user?.profile?.avatarUrl}
                size={44}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.proNameRow}>
                  <Text
                    variant="heading"
                    numberOfLines={1}
                    style={{ color: colors.text, flexShrink: 1 }}
                  >
                    {proName}
                  </Text>
                  {gig.professionalProfile.isPro ? (
                    <AppIcon
                      name="badge-check"
                      size={16}
                      color={colors.primary}
                    />
                  ) : null}
                </View>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {gig.professionalProfile.city || 'España'} ·{' '}
                  {gig.professionalProfile.completedOrdersCount || 0} trabajos realizados
                </Text>
              </View>
              <AppIcon
                name="chevron-right"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          </>
        ) : null}

        {/* Selector de paquetes con ProfileTabs a ancho completo y detalle abierto */}
        {packages.length > 0 ? (
          <>
            <Divider />
            {packages.length > 1 ? (
              <ProfileTabs
                tabs={packageTabs}
                activeTab={String(safeTierIdx)}
                onSelectTab={(tabId) => setSelectedTierIdx(Number(tabId) || 0)}
              />
            ) : null}

            {activePkg ? (
              <View style={s.openSection}>
                <View style={s.pkgHeader}>
                  <Text
                    variant="heading"
                    style={{ color: colors.text, flex: 1 }}
                  >
                    {activePkg.name}
                  </Text>
                  <Text
                    variant="heading"
                    tabular
                    style={{ color: colors.primary, fontFamily: fonts.bold }}
                  >
                    {formatEur(activePkg.price)}
                  </Text>
                </View>

                <Text
                  variant="body"
                  style={{ color: colors.textSecondary, lineHeight: 22 }}
                >
                  {activePkg.description}
                </Text>

                <View style={s.pkgMetaRow}>
                  <View style={s.pkgMetaItem}>
                    <AppIcon name="clock" size={15} color={colors.textMuted} />
                    <Text variant="caption" tone="muted">
                      Entrega en {activePkg.deliveryDays}{' '}
                      {activePkg.deliveryDays === 1 ? 'día' : 'días'}
                    </Text>
                  </View>
                  <View style={s.pkgMetaItem}>
                    <AppIcon
                      name="refresh-cw"
                      size={15}
                      color={colors.textMuted}
                    />
                    <Text variant="caption" tone="muted">
                      {activePkg.revisions === -1
                        ? 'Revisiones ilimitadas'
                        : activePkg.revisions === 1
                          ? '1 revisión'
                          : `${activePkg.revisions} revisiones`}
                    </Text>
                  </View>
                </View>

                {featuresList.length > 0 ? (
                  <View style={s.featuresList}>
                    {featuresList.map((feat, idx) => (
                      <View key={`${feat}-${idx}`} style={s.featureRow}>
                        <AppIcon
                          name="check"
                          size={15}
                          color={colors.success}
                        />
                        <Text
                          variant="body"
                          style={{ color: colors.text, flex: 1 }}
                        >
                          {feat}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Extras opcionales abiertos */}
        {extrasList.length > 0 ? (
          <>
            <Divider />
            <View style={s.openSection}>
              <Text variant="heading" style={{ color: colors.text }}>
                Extras opcionales
              </Text>
              <View>
                {extrasList.map((extra, idx) => {
                  const checked = selectedExtraIds.includes(extra.id);
                  return (
                    <React.Fragment key={extra.id}>
                      {idx > 0 ? <Divider /> : null}
                      <Pressable
                        onPress={() =>
                          setSelectedExtraIds((prev) =>
                            checked
                              ? prev.filter((x) => x !== extra.id)
                              : [...prev, extra.id],
                          )
                        }
                        style={s.extraRow}
                      >
                        <AppIcon
                          name={checked ? 'check-square' : 'square'}
                          size={18}
                          color={checked ? colors.primary : colors.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text variant="label" style={{ color: colors.text }}>
                            {extra.title}
                          </Text>
                          {extra.description ? (
                            <Text variant="caption" tone="muted">
                              {extra.description}
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          variant="label"
                          tabular
                          style={{ color: colors.primary, fontFamily: fonts.bold }}
                        >
                          +{formatEur(extra.price)}
                        </Text>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {/* Preguntas frecuentes */}
        {faqsList.length > 0 ? (
          <>
            <Divider />
            <View style={s.openSection}>
              <Text variant="heading" style={{ color: colors.text }}>
                Preguntas frecuentes
              </Text>
              <View style={{ gap: space.sm }}>
                {faqsList.map((faq, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 ? <Divider /> : null}
                    <View style={{ gap: 4, paddingVertical: space.xs }}>
                      <Text
                        variant="heading"
                        style={{ color: colors.text, fontSize: 15 }}
                      >
                        {faq.question}
                      </Text>
                      <Text variant="body" tone="secondary">
                        {faq.answer}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {/* Valoraciones */}
        {reviewsList.length > 0 ? (
          <>
            <Divider />
            <View style={{ paddingTop: space.md }}>
              <Text
                variant="heading"
                style={{
                  color: colors.text,
                  paddingHorizontal: gutter,
                  paddingBottom: space.xs,
                }}
              >
                Valoraciones
              </Text>
              {reviewsList.map((rev, idx) => (
                <React.Fragment key={rev.id}>
                  {idx > 0 ? <Divider /> : null}
                  <ReviewCard
                    review={rev}
                    onReplied={() => void gigQuery.refetch()}
                  />
                </React.Fragment>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Barra inferior sobre fondo abierto (sin fondo mate) */}
      {isOwnGig ? (
        <View
          style={[
            s.footerBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(bottom, space.md),
            },
          ]}
        >
          <Button
            variant="primary"
            icon="edit-2"
            title="Editar servicio y paquetes"
            onPress={handleGoEdit}
          />
        </View>
      ) : activePkg ? (
        <View
          style={[
            s.footerBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(bottom, space.md),
            },
          ]}
        >
          <View style={s.footerSummaryRow}>
            <Text variant="caption" tone="muted">
              Total Escrow
            </Text>
            <Text
              variant="heading"
              tabular
              style={{ color: colors.text, fontFamily: fonts.bold }}
            >
              {formatEur(finalPrice)}
            </Text>
          </View>
          <View style={s.footerActionsRow}>
            <Button
              variant="outline"
              size="sm"
              icon="credit-card"
              title="Saldo"
              loading={createOrder.isPending || walletOrdering}
              disabled={paymentBusy}
              style={{ flex: 1 }}
              onPress={handleWalletOrder}
            />
            <Button
              variant="secondary"
              size="sm"
              icon="smartphone"
              title="Bizum"
              loading={bizumLoading}
              disabled={paymentBusy}
              style={{ flex: 1 }}
              onPress={handleBizumOrder}
            />
            <Button
              variant="primary"
              size="sm"
              title="En la app"
              loading={iapLoading}
              disabled={paymentBusy}
              style={{ flex: 1 }}
              onPress={handleIapOrder}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingBottom: 8,
  },
  stickyTitleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  heroWrap: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroDots: {
    position: 'absolute',
    bottom: space.md,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
  },
  mainBlock: {
    paddingHorizontal: gutter,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  titlePriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  titleText: {
    fontSize: 22,
    lineHeight: 28,
  },
  priceText: {
    fontSize: 22,
    lineHeight: 28,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  proRowOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  proNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  openSection: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: space.sm,
  },
  pkgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pkgMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    marginTop: 2,
  },
  pkgMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuresList: {
    gap: 6,
    marginTop: space.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.sm,
  },
  footerBar: {
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  footerSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerActionsRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
