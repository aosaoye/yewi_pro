import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useCreateReview, useMe } from '@/api/hooks';
import { reviewsApi } from '@/api/services';
import { formatShortDate } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { getReviewReplyTarget } from '@/lib/reviewReplyTarget';
import {
  AppIcon,
  Avatar,
  Divider,
  Field,
  fonts,
  gutter,
  radius,
  Screen,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

export default function CreateReviewScreen() {
  const { orderId, professionalProfileId, replyToReviewId } =
    useLocalSearchParams<{
      orderId?: string;
      professionalProfileId?: string;
      replyToReviewId?: string;
    }>();
  const isReplyMode = Boolean(replyToReviewId);
  const replyTarget = isReplyMode
    ? getReviewReplyTarget(replyToReviewId)
    : null;

  const { colors } = useTheme();
  const meQuery = useMe();
  const createReview = useCreateReview();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | undefined>();
  const [sendingReply, setSendingReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const me = meQuery.data;
  const displayName =
    me?.profile?.displayName ||
    [me?.profile?.firstName, me?.profile?.lastName].filter(Boolean).join(' ') ||
    'Usuario';

  const isSubmitting = createReview.isPending || sendingReply || submitting;

  const handleSubmit = async () => {
    if (isSubmitting || submitLockRef.current) return;
    if (!comment.trim()) {
      setCommentError(
        isReplyMode
          ? 'Escribe tu respuesta antes de publicar.'
          : 'Escribe tu opinión antes de publicar.',
      );
      return;
    }
    setCommentError(undefined);
    submitLockRef.current = true;
    setSubmitting(true);

    if (isReplyMode && replyToReviewId) {
      setSendingReply(true);
      try {
        await reviewsApi.reply(replyToReviewId, comment.trim());
        void queryClient.invalidateQueries({ queryKey: ['professionals'] });
        void queryClient.invalidateQueries({ queryKey: ['gigs'] });
        replyTarget?.onReplied?.();
        toast.success('Respuesta publicada');
        router.back();
      } catch (err) {
        submitLockRef.current = false;
        setSubmitting(false);
        setSendingReply(false);
        setCommentError(
          err instanceof Error
            ? err.message
            : 'No se pudo publicar la respuesta.',
        );
      }
      return;
    }

    try {
      await createReview.mutateAsync({
        orderId,
        professionalProfileId,
        rating,
        qualityRating: rating,
        communicationRating: rating,
        deliveryRating: rating,
        comment: comment.trim(),
      });
      toast.success('Reseña publicada');
      router.back();
    } catch (err) {
      submitLockRef.current = false;
      setSubmitting(false);
      setCommentError(
        err instanceof Error ? err.message : 'No se pudo publicar la reseña.',
      );
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Topbar estilo compositor: ✕ izquierda + botón pill Publicar / Responder derecha */}
        <View style={s.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <AppIcon name="x" size={24} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={isReplyMode ? 'Responder' : 'Publicar'}
            style={({ pressed }) => [
              s.publishBtn,
              {
                backgroundColor: colors.primary,
                opacity: isSubmitting ? 0.55 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text
                variant="label"
                style={{
                  color: colors.primaryForeground,
                  fontFamily: fonts.bold,
                  fontSize: 15,
                }}
              >
                {isReplyMode ? 'Responder' : 'Publicar'}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollContent}
        >
          {/* Comentario al que se responde arriba con su usuario y avatar */}
          {isReplyMode && replyTarget ? (
            <View style={s.parentRow}>
              <View style={s.parentAvatarCol}>
                <Avatar
                  name={replyTarget.authorName}
                  avatarUrl={replyTarget.authorAvatar}
                  size={40}
                />
                <View
                  style={[s.parentSpine, { backgroundColor: colors.divider }]}
                />
              </View>
              <View style={s.parentBodyCol}>
                <View style={s.parentMeta}>
                  <Text
                    variant="label"
                    numberOfLines={1}
                    style={{ color: colors.text, fontFamily: fonts.semibold }}
                  >
                    {replyTarget.authorName}
                  </Text>
                  {replyTarget.createdAt ? (
                    <Text variant="caption" tone="muted">
                      · {formatShortDate(replyTarget.createdAt)}
                    </Text>
                  ) : null}
                </View>
                <Text
                  variant="body"
                  tone="secondary"
                  style={{ lineHeight: 21 }}
                >
                  {replyTarget.comment}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={s.composerRow}>
            <Avatar
              name={displayName}
              avatarUrl={me?.profile?.avatarUrl}
              size={40}
            />
            <View style={{ flex: 1 }}>
              <Field
                multiline
                hideIcon
                autoFocus
                placeholder={
                  isReplyMode
                    ? 'Escribe tu respuesta...'
                    : '¿Cómo fue tu experiencia?'
                }
                value={comment}
                error={commentError}
                onChangeText={(txt) => {
                  setComment(txt);
                  if (commentError) setCommentError(undefined);
                }}
                containerStyle={{ marginBottom: 0 }}
                style={s.composerInput}
              />
            </View>
          </View>
        </ScrollView>

        {!isReplyMode ? (
          <>
            <Divider />

            {/* Selector de estrellas limpio en la base */}
            <View style={s.ratingBar}>
              <Text
                variant="caption"
                tone="muted"
                style={{ fontFamily: fonts.medium }}
              >
                Valoración
              </Text>
              <View style={s.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRating(n)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} estrellas`}
                  >
                    <AppIcon
                      name="star"
                      size={24}
                      color={n <= rating ? colors.warning : colors.textMuted}
                      fill={n <= rating ? colors.warning : 'none'}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 92,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: space.sm,
  },
  parentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: gutter,
    gap: 12,
  },
  parentAvatarCol: {
    width: 40,
    alignItems: 'center',
  },
  parentSpine: {
    flex: 1,
    width: 1.5,
    minHeight: 18,
    marginVertical: 6,
  },
  parentBodyCol: {
    flex: 1,
    gap: 4,
    paddingBottom: space.md,
  },
  parentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: gutter,
    gap: 12,
  },
  composerInput: {
    minHeight: 160,
    fontSize: 18,
    lineHeight: 26,
    paddingTop: 6,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingVertical: 12,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
