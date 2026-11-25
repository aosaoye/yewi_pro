import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type {
  GigDetail,
  OrderItem,
  ProfessionalSummary,
  PromotionItem,
  ReviewItem,
  ServiceRequestItem,
} from '@/api/types';
import {
  formatEur,
  formatLeadStatus,
  formatOrderStatus,
  formatRelativeDate,
  formatShortDate,
  hasValidRating,
} from '@/lib/format';
import { setReviewReplyTarget } from '@/lib/reviewReplyTarget';
import {
  AppIcon,
  Avatar,
  Badge,
  Card,
  Cover,
  fonts,
  gutter,
  type IconName,
  PillBadge,
  radius,
  space,
  Text,
  useTheme,
} from '@/ui';

/**
 * Tarjeta visual de servicio:
 * - `default`: foto grande redondeada con píldora de valoración arriba-izquierda,
 *   píldora de precio abajo-izquierda y botón circular `↗` abajo-derecha.
 * - `compact` (miniatura): formato compacto vertical con botón circular de guardar
 *   arriba-derecha además de valoración, precio y `↗`.
 */
export function GigCard({
  gig,
  variant = 'default',
  saved,
  onToggleSave,
  onPress,
}: {
  gig: GigDetail;
  variant?: 'default' | 'compact';
  saved?: boolean;
  onToggleSave?: () => void;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const isCompact = variant === 'compact';
  const minPrice =
    gig.packages?.length > 0
      ? Math.min(...gig.packages.map((p) => Number(p.price || 0)))
      : 0;
  const proName =
    gig.professionalProfile?.businessName ||
    gig.professionalProfile?.user?.profile?.displayName ||
    'Profesional Yewi';

  const floatingBg = isDark ? colors.surface : colors.background;
  const priceText = formatEur(minPrice, minPrice % 1 === 0 ? 0 : 2);
  const showRating = hasValidRating(gig.avgRating, gig.totalReviews);
  const ratingText = showRating ? Number(gig.avgRating).toFixed(1) : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={gig.title}
      style={({ pressed }) => [
        isCompact ? s.gigCompactWrap : s.gigFullWrap,
        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={[
          isCompact ? s.gigCompactMedia : s.gigFullMedia,
          { backgroundColor: colors.surfaceSubtle },
        ]}
      >
        <Cover
          seed={gig.category?.name || gig.id}
          imageUrl={gig.coverImages?.[0]}
          style={StyleSheet.absoluteFill}
        />

        {/* Fila superior flotante: ★ rating (si tiene valoraciones) + (en miniatura) bookmark */}
        <View style={isCompact ? s.gigOverlayTopCompact : s.gigOverlayTop}>
          {showRating ? (
            <View
              style={[
                s.floatingPill,
                isCompact && s.floatingPillCompact,
                s.floatingShadow,
                { backgroundColor: floatingBg },
              ]}
            >
              <AppIcon
                name="star"
                size={isCompact ? 13 : 14}
                color={colors.warning}
                fill={colors.warning}
              />
              <Text
                variant="caption"
                tabular
                style={{
                  color: colors.text,
                  fontFamily: fonts.bold,
                  fontSize: isCompact ? 12.5 : 13.5,
                  lineHeight: isCompact ? 16 : 18,
                }}
              >
                {ratingText}
              </Text>
            </View>
          ) : (
            <View />
          )}

          {isCompact && onToggleSave ? (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                saved ? 'Quitar de guardados' : 'Guardar servicio'
              }
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleSave();
              }}
              style={[
                s.floatingCircleCompact,
                s.floatingShadow,
                { backgroundColor: floatingBg },
              ]}
            >
              <AppIcon
                name="bookmark"
                size={16}
                color={saved ? colors.primary : colors.textSecondary}
                fill={saved ? colors.primary : 'none'}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Fila inferior flotante: Desde XXX € + botón circular ↗ */}
        <View
          style={isCompact ? s.gigOverlayBottomCompact : s.gigOverlayBottom}
        >
          <View
            style={[
              s.floatingPricePill,
              isCompact && s.floatingPricePillCompact,
              s.floatingShadow,
              { backgroundColor: floatingBg },
            ]}
          >
            <Text
              variant="caption"
              tone="secondary"
              style={{
                fontSize: isCompact ? 11.5 : 13,
                fontFamily: fonts.medium,
              }}
            >
              Desde
            </Text>
            <Text
              variant="label"
              tabular
              numberOfLines={1}
              style={{
                color: colors.text,
                fontFamily: fonts.bold,
                fontSize: isCompact ? 13 : 15,
              }}
            >
              {priceText}
            </Text>
          </View>

          <View
            style={[
              isCompact ? s.floatingCircleCompact : s.floatingCircle,
              s.floatingShadow,
              { backgroundColor: floatingBg },
            ]}
          >
            <AppIcon
              name="arrow-up-right"
              size={isCompact ? 16 : 18}
              color={colors.text}
            />
          </View>
        </View>
      </View>

      {/* Pie mínimo y escaneable */}
      <View style={isCompact ? s.gigCompactCaption : s.gigFullCaption}>
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color: colors.text,
            fontSize: isCompact ? 13.5 : 15.5,
            fontFamily: fonts.semibold,
          }}
        >
          {gig.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {proName}
        </Text>
      </View>
    </Pressable>
  );
}

/** Cuadrícula de 2 columnas para miniaturas de servicios (`GigCard variant="compact"`). */
export function GigGrid({
  gigs,
  savedIds,
  onToggleSave,
  onPressGig,
}: {
  gigs: GigDetail[];
  savedIds?: string[];
  onToggleSave?: (gigId: string) => void;
  onPressGig: (gig: GigDetail) => void;
}) {
  return (
    <View style={s.gigGrid}>
      {gigs.map((gig) => (
        <View key={gig.id} style={s.gigGridCell}>
          <GigCard
            gig={gig}
            variant="compact"
            saved={savedIds?.includes(gig.id)}
            onToggleSave={onToggleSave ? () => onToggleSave(gig.id) : undefined}
            onPress={() => onPressGig(gig)}
          />
        </View>
      ))}
    </View>
  );
}

function toProHandle(pro: ProfessionalSummary, displayName: string): string {
  const base = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  return `@${base || pro.id.slice(0, 8)}`;
}

/**
 * Tarjeta horizontal "A quién seguir" para el carrusel de Home (portada + avatar solapado + botón Seguir).
 */
export function SuggestedProCard({
  pro,
  following,
  onToggleFollow,
  onPress,
}: {
  pro: ProfessionalSummary;
  following: boolean;
  onToggleFollow?: () => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const displayName =
    pro.businessName ||
    pro.user?.profile?.displayName ||
    [pro.user?.profile?.firstName, pro.user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Profesional Yewi';
  const handle = toProHandle(pro, displayName);
  const proCity = pro.city || pro.user?.profile?.city || 'España';
  const showProRating = hasValidRating(pro.avgRating, pro.totalReviews);
  const subtitle =
    pro.bio?.trim() ||
    (pro.skills?.length ? pro.skills.slice(0, 3).join(' · ') : '') ||
    (showProRating
      ? `${proCity} · ★ ${Number(pro.avgRating).toFixed(1)}`
      : proCity);
  const isVerified = Boolean(pro.isPro || pro.kycStatus === 'VERIFIED');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      style={({ pressed }) => [
        s.suggestedCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Cover seed={pro.id || displayName} style={s.suggestedCover} />

      <View style={s.suggestedBody}>
        <View style={s.suggestedTopRow}>
          <View
            style={[
              s.suggestedAvatarRing,
              { borderColor: colors.surface, backgroundColor: colors.surface },
            ]}
          >
            <Avatar
              name={displayName}
              avatarUrl={pro.user?.profile?.avatarUrl}
              size={54}
            />
          </View>

          {onToggleFollow ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleFollow();
              }}
              accessibilityRole="button"
              accessibilityLabel={following ? 'Dejar de seguir' : 'Seguir'}
              style={({ pressed }) => [
                s.followPill,
                following
                  ? {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                    }
                  : { backgroundColor: colors.text },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                variant="label"
                style={{
                  color: following ? colors.text : colors.textInverse,
                  fontFamily: fonts.bold,
                  fontSize: 13.5,
                }}
              >
                {following ? 'Siguiendo' : 'Seguir'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={s.inlineMeta}>
          <Text
            variant="heading"
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 16, flexShrink: 1 }}
          >
            {displayName}
          </Text>
          {isVerified ? (
            <AppIcon
              name="check-circle"
              size={15}
              color={colors.primary}
            />
          ) : null}
        </View>

        <Text variant="caption" tone="muted" numberOfLines={1}>
          {handle}
        </Text>

        <Text
          variant="caption"
          tone="secondary"
          numberOfLines={2}
          style={{ lineHeight: 18, marginTop: 2 }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Fila limpia de profesional con botón Seguir / Siguiendo para listas de Sugeridos y Siguiendo/Seguidores.
 */
export function FollowProRow({
  pro,
  following,
  onToggleFollow,
  onPress,
}: {
  pro: ProfessionalSummary;
  following: boolean;
  onToggleFollow?: () => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const displayName =
    pro.businessName ||
    pro.user?.profile?.displayName ||
    [pro.user?.profile?.firstName, pro.user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Profesional Yewi';
  const handle = toProHandle(pro, displayName);
  const proCity = pro.city || pro.user?.profile?.city || 'España';
  const showProRating = hasValidRating(pro.avgRating, pro.totalReviews);
  const subtitle =
    pro.bio?.trim() ||
    (pro.skills?.length ? pro.skills.slice(0, 3).join(' · ') : '') ||
    (showProRating
      ? `${proCity} · ★ ${Number(pro.avgRating).toFixed(1)}`
      : proCity);
  const isVerified = Boolean(pro.isPro || pro.kycStatus === 'VERIFIED');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      style={({ pressed }) => [s.followRow, pressed && { opacity: 0.78 }]}
    >
      <Avatar
        name={displayName}
        avatarUrl={pro.user?.profile?.avatarUrl}
        size={44}
      />

      <View style={{ flex: 1, gap: 3 }}>
        <View style={s.followRowTop}>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={s.inlineMeta}>
              <Text
                variant="heading"
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 15.5, flexShrink: 1 }}
              >
                {displayName}
              </Text>
              {isVerified ? (
                <AppIcon name="check-circle" size={14} color={colors.primary} />
              ) : null}
            </View>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {handle}
            </Text>
          </View>

          {onToggleFollow ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleFollow();
              }}
              accessibilityRole="button"
              accessibilityLabel={following ? 'Dejar de seguir' : 'Seguir'}
              style={({ pressed }) => [
                s.followPill,
                following
                  ? {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                    }
                  : { backgroundColor: colors.text },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                variant="label"
                style={{
                  color: following ? colors.text : colors.textInverse,
                  fontFamily: fonts.bold,
                  fontSize: 13.5,
                }}
              >
                {following ? 'Siguiendo' : 'Seguir'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text
          variant="caption"
          tone="secondary"
          numberOfLines={2}
          style={{ lineHeight: 18 }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/** Fila de profesional limpia sobre lienzo abierto sin tarjeta. */
export function ProfessionalCard({
  pro,
  onPress,
}: {
  pro: ProfessionalSummary;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const displayName =
    pro.businessName ||
    pro.user?.profile?.displayName ||
    [pro.user?.profile?.firstName, pro.user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Profesional Yewi';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      style={({ pressed }) => [s.proRow, pressed && { opacity: 0.72 }]}
    >
      <Avatar
        name={displayName}
        avatarUrl={pro.user?.profile?.avatarUrl}
        size={44}
      />

      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.inlineMeta}>
          <Text
            variant="heading"
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 16, flexShrink: 1 }}
          >
            {displayName}
          </Text>
          {pro.isPro ? (
            <PillBadge label="Pro" tone="primary" variant="soft" size="xs" />
          ) : null}
        </View>

        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {hasValidRating(pro.avgRating, pro.totalReviews)
            ? `${pro.city || pro.user?.profile?.city || 'España'} · ★ ${Number(pro.avgRating).toFixed(1)} · ${pro.totalReviews} reseñas`
            : `${pro.city || pro.user?.profile?.city || 'España'} · Sin valoraciones`}
        </Text>
      </View>

      {pro.hourlyRate ? (
        <View style={s.priceCol}>
          <Text
            variant="label"
            tabular
            style={{ color: colors.text, fontFamily: fonts.bold }}
          >
            {formatEur(pro.hourlyRate, 0)}
          </Text>
          <Text variant="caption" tone="muted">
            /hora
          </Text>
        </View>
      ) : null}

      <AppIcon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Fila de solicitud / oportunidad con estado por icono y precio debajo. */
export function LeadOpportunityCard({
  lead,
  onPress,
}: {
  lead: ServiceRequestItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const statusInfo = formatLeadStatus(lead.status);
  const statusIcon: IconName =
    lead.status === 'FULFILLED'
      ? 'check-circle'
      : lead.status === 'EXPIRED' || lead.status === 'CANCELLED'
        ? 'x-circle'
        : 'clock';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={lead.title}
      style={({ pressed }) => [s.openRow, pressed && { opacity: 0.72 }]}
    >
      <View style={s.topMetaRow}>
        <View style={s.metaLeft}>
          <View style={s.inlineMeta}>
            <AppIcon
              name={statusIcon}
              size={14}
              color={colors.textSecondary}
            />
            <Text
              variant="caption"
              style={{ fontFamily: fonts.medium, color: colors.textSecondary }}
            >
              {statusInfo.label}
            </Text>
          </View>
          {lead.isUrgent ? (
            <View style={s.inlineMeta}>
              <AppIcon name="zap" size={12} color={colors.textMuted} />
              <Text variant="caption" tone="muted">
                Urgente
              </Text>
            </View>
          ) : null}
          {lead.category?.name ? (
            <Text
              variant="caption"
              style={{ fontFamily: fonts.semibold, color: colors.text }}
            >
              · {lead.category.name}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            · {formatRelativeDate(lead.createdAt)}
          </Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={colors.textMuted} />
      </View>

      <View style={s.leadMainRow}>
        <Avatar name={lead.city || 'Solicitud'} size={38} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            variant="heading"
            numberOfLines={2}
            style={{ color: colors.text, fontSize: 15.5, lineHeight: 20 }}
          >
            {lead.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {lead.city ? `${lead.city} · ` : ''}
            {lead.description}
          </Text>
          <View style={s.leadPriceBottomRow}>
            <Text
              variant="heading"
              tabular
              style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 16 }}
            >
              {lead.budgetMax
                ? formatEur(lead.budgetMax, 0)
                : lead.budgetMin
                  ? formatEur(lead.budgetMin, 0)
                  : 'Abierto'}
            </Text>
            <Text variant="caption" tone="muted">
              · {lead.budgetMax ? 'Presup. máx.' : 'A valorar'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Fila de pedido Escrow abierta sobre el fondo sin bordes innecesarios. */
export function OrderRowCard({
  order,
  onPress,
}: {
  order: OrderItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const statusInfo = formatOrderStatus(order.status);
  const title =
    order.gig?.title ||
    order.serviceRequest?.title ||
    `Pedido ${order.orderNumber}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [s.openRow, pressed && { opacity: 0.72 }]}
    >
      <View style={s.topMetaRow}>
        <View style={s.metaLeft}>
          <Badge label={statusInfo.label} tone={statusInfo.tone} />
          <Text
            variant="caption"
            style={{ fontFamily: fonts.semibold, color: colors.text }}
          >
            #{order.orderNumber}
          </Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={colors.textMuted} />
      </View>

      <View style={s.mainRow}>
        <View style={[s.orderBadgeIcon, { backgroundColor: colors.primarySoft }]}>
          <AppIcon name="shield" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant="heading"
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 16 }}
          >
            {title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            Escrow:{' '}
            {order.escrowStatus === 'RELEASED_TO_PRO'
              ? 'Liberado al profesional'
              : 'Fondos protegidos'}
          </Text>
        </View>
        <View style={s.priceCol}>
          <Text
            variant="heading"
            tabular
            style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 17 }}
          >
            {formatEur(order.totalAmount)}
          </Text>
          <Text variant="caption" tone="muted">
            IVA incl.
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/**
 * Comentario / reseña con diseño abierto y barra de acciones minimalista:
 * solo Responder, Like y Audiencia.
 */
export function ReviewCard({
  review,
  onReplied,
}: {
  review: ReviewItem;
  onReplied?: () => void;
}) {
  const { colors } = useTheme();
  const [liked, setLiked] = useState(false);
  const [likedReplies, setLikedReplies] = useState<Record<string, boolean>>({});

  const authorName =
    review.author?.profile?.displayName ||
    [review.author?.profile?.firstName, review.author?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Cliente Yewi';

  const repliesList =
    review.replies && review.replies.length > 0
      ? review.replies
      : review.sellerReply
        ? [
            {
              id: `${review.id}-seller`,
              authorId: review.targetUserId || 'pro',
              authorName: 'Profesional',
              authorAvatar: null,
              comment: review.sellerReply,
              createdAt: review.sellerRepliedAt || review.createdAt,
            },
          ]
        : [];

  const replyCount = repliesList.length;
  const likeCount = (liked ? 1 : 0) + (review.rating >= 5 ? 1 : 0);
  const audienceCount = Math.max(
    1,
    12 + (review.comment?.length || 0) + replyCount * 8,
  );

  const handleOpenReplyComposer = () => {
    setReviewReplyTarget({
      reviewId: review.id,
      authorName,
      authorAvatar: review.author?.profile?.avatarUrl,
      comment: review.comment,
      createdAt: review.createdAt,
      onReplied,
    });
    router.push(
      `/create-review?replyToReviewId=${encodeURIComponent(review.id)}` as never,
    );
  };

  return (
    <View style={s.reviewThreadWrap}>
      {/* Comentario principal */}
      <View style={s.reviewMainBlock}>
        <View style={s.threadAvatarCol}>
          <Avatar
            name={authorName}
            avatarUrl={review.author?.profile?.avatarUrl}
            size={36}
          />
          {replyCount > 0 ? (
            <View
              style={[s.threadSpine, { backgroundColor: colors.divider }]}
            />
          ) : null}
        </View>

        <View style={s.reviewBodyCol}>
          <View style={s.reviewHeader}>
            <View style={s.inlineMeta}>
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: colors.text, fontFamily: fonts.semibold }}
              >
                {authorName}
              </Text>
              <Text variant="caption" tone="muted">
                · {formatShortDate(review.createdAt)}
              </Text>
            </View>
            <View style={s.inlineMeta}>
              <AppIcon
                name="star"
                size={12}
                color={colors.warning}
                fill={colors.warning}
              />
              <Text
                variant="caption"
                tabular
                style={{ color: colors.text, fontFamily: fonts.bold }}
              >
                {review.rating}.0
              </Text>
            </View>
          </View>

          <Text variant="body" style={{ color: colors.text, lineHeight: 21 }}>
            {review.comment}
          </Text>

          {/* Barra de acciones: solo Responder, Like y Audiencia */}
          <View style={s.reviewActions}>
            <Pressable
              onPress={handleOpenReplyComposer}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Responder comentario"
              style={({ pressed }) => [
                s.reviewActionBtn,
                pressed && { opacity: 0.65 },
              ]}
            >
              <AppIcon
                name="message-circle"
                size={16}
                color={colors.textMuted}
              />
              <Text
                variant="caption"
                tabular
                style={{
                  color: colors.textMuted,
                  fontFamily: fonts.medium,
                }}
              >
                {replyCount}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setLiked((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Quitar me gusta' : 'Dar me gusta'}
              style={({ pressed }) => [
                s.reviewActionBtn,
                pressed && { opacity: 0.65 },
              ]}
            >
              <AppIcon
                name="heart"
                size={17}
                color={liked ? colors.chartSecondary : colors.textMuted}
                fill={liked ? colors.chartSecondary : 'none'}
              />
              <Text
                variant="caption"
                tabular
                style={{
                  color: liked ? colors.chartSecondary : colors.textMuted,
                  fontFamily: fonts.medium,
                }}
              >
                {likeCount}
              </Text>
            </Pressable>

            <View
              style={s.reviewActionBtn}
              accessibilityLabel={`Audiencia: ${audienceCount}`}
            >
              <AppIcon
                name="bar-chart-2"
                size={15}
                color={colors.textMuted}
              />
              <Text
                variant="caption"
                tabular
                style={{ color: colors.textMuted, fontFamily: fonts.medium }}
              >
                {formatCompactCount(audienceCount)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Respuestas anidadas en hilo con conector curvo sobre lienzo abierto */}
      {repliesList.map((replyItem) => {
        const isReplyLiked = Boolean(likedReplies[replyItem.id]);
        const rLikeCount = isReplyLiked ? 1 : 0;
        const rAudienceCount = Math.max(1, 8 + replyItem.comment.length);
        return (
          <View key={replyItem.id} style={s.threadReplyRow}>
            <View style={s.threadElbowWrap}>
              <View
                style={[s.threadElbow, { borderColor: colors.divider }]}
              />
            </View>
            <View style={s.threadReplyMain}>
              <Avatar
                name={replyItem.authorName}
                avatarUrl={replyItem.authorAvatar ?? undefined}
                size={30}
              />
              <View style={s.reviewBodyCol}>
                <View style={s.inlineMeta}>
                  <Text
                    variant="label"
                    numberOfLines={1}
                    style={{ color: colors.text, fontFamily: fonts.semibold }}
                  >
                    {replyItem.authorName}
                  </Text>
                  <Text variant="caption" tone="muted">
                    · {formatShortDate(replyItem.createdAt)}
                  </Text>
                </View>

                <Text
                  variant="body"
                  style={{ color: colors.text, lineHeight: 20 }}
                >
                  {replyItem.comment}
                </Text>

                <View style={s.reviewActions}>
                  <Pressable
                    onPress={handleOpenReplyComposer}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Responder"
                    style={({ pressed }) => [
                      s.reviewActionBtn,
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <AppIcon
                      name="message-circle"
                      size={15}
                      color={colors.textMuted}
                    />
                    <Text
                      variant="caption"
                      style={{
                        color: colors.textMuted,
                        fontFamily: fonts.medium,
                      }}
                    >
                      Responder
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      setLikedReplies((prev) => ({
                        ...prev,
                        [replyItem.id]: !prev[replyItem.id],
                      }))
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isReplyLiked ? 'Quitar me gusta' : 'Dar me gusta'
                    }
                    style={({ pressed }) => [
                      s.reviewActionBtn,
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <AppIcon
                      name="heart"
                      size={16}
                      color={
                        isReplyLiked ? colors.chartSecondary : colors.textMuted
                      }
                      fill={isReplyLiked ? colors.chartSecondary : 'none'}
                    />
                    <Text
                      variant="caption"
                      tabular
                      style={{
                        color: isReplyLiked
                          ? colors.chartSecondary
                          : colors.textMuted,
                        fontFamily: fonts.medium,
                      }}
                    >
                      {rLikeCount}
                    </Text>
                  </Pressable>

                  <View
                    style={s.reviewActionBtn}
                    accessibilityLabel={`Audiencia: ${rAudienceCount}`}
                  >
                    <AppIcon
                      name="bar-chart-2"
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text
                      variant="caption"
                      tabular
                      style={{
                        color: colors.textMuted,
                        fontFamily: fonts.medium,
                      }}
                    >
                      {formatCompactCount(rAudienceCount)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function PromotionCard({ promo }: { promo: PromotionItem }) {
  const { colors } = useTheme();
  const badgeLabel = promo.discountPercent
    ? `-${promo.discountPercent}%`
    : promo.discountAmount
      ? `-${formatEur(promo.discountAmount, 0)}`
      : promo.badge || 'Oferta';

  return (
    <Card tone="accentSoft" style={s.promoCard}>
      <View style={s.topMetaRow}>
        <PillBadge label={badgeLabel} tone="primary" variant="solid" size="xs" />
        {promo.promoCode ? (
          <Text
            variant="caption"
            style={{ color: colors.primary, fontFamily: fonts.bold }}
          >
            {promo.promoCode}
          </Text>
        ) : null}
      </View>
      <Text variant="heading" numberOfLines={1} style={{ color: colors.text }}>
        {promo.title}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {promo.description}
      </Text>
      {promo.professional ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {promo.professional.name} · {promo.professional.city || 'España'}
        </Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  openRow: {
    paddingHorizontal: gutter,
    paddingVertical: space.md + 2,
    gap: space.sm + 2,
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  leadMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  leadPriceBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingTop: 2,
  },
  gigFullWrap: {
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    gap: 8,
  },
  gigFullMedia: {
    width: '100%',
    aspectRatio: 1.05,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  gigCompactWrap: {
    width: '100%',
    gap: 6,
  },
  gigCompactMedia: {
    width: '100%',
    aspectRatio: 0.84,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  gigOverlayTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  gigOverlayTopCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  gigOverlayBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  gigOverlayBottomCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    gap: 6,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: radius.full,
  },
  floatingPillCompact: {
    paddingHorizontal: 10,
    height: 30,
    gap: 4,
  },
  floatingPricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: radius.full,
    maxWidth: '76%',
  },
  floatingPricePillCompact: {
    paddingHorizontal: 11,
    height: 34,
    gap: 4,
    maxWidth: '72%',
  },
  floatingCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  floatingCircleCompact: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  floatingShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  gigFullCaption: {
    paddingHorizontal: 4,
    gap: 2,
  },
  gigCompactCaption: {
    paddingHorizontal: 2,
    gap: 1,
  },
  gigGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    gap: 12,
  },
  gigGridCell: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '49%',
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  orderBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promoCard: {
    width: 248,
    padding: space.md,
    gap: 6,
  },
  reviewThreadWrap: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  reviewMainBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  threadAvatarCol: {
    width: 36,
    alignItems: 'center',
  },
  threadSpine: {
    flex: 1,
    width: 1.5,
    marginTop: 6,
  },
  reviewBodyCol: {
    flex: 1,
    gap: 5,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  threadReplyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  threadElbowWrap: {
    width: 36,
    alignItems: 'flex-end',
  },
  threadElbow: {
    width: 18,
    height: 18,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderBottomLeftRadius: 12,
  },
  threadReplyMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 6,
    paddingLeft: 4,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 4,
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  replyComposerIndent: {
    paddingLeft: 48,
    paddingTop: 8,
    gap: 4,
  },
  replyComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  replySubmitPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  suggestedCard: {
    width: 276,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestedCover: {
    width: '100%',
    height: 88,
  },
  suggestedBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 2,
  },
  suggestedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -26,
    marginBottom: 6,
  },
  suggestedAvatarRing: {
    borderWidth: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  followPill: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: gutter,
    paddingVertical: 12,
    gap: 12,
  },
  followRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
