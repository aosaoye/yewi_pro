import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useApproveOrder,
  useMe,
  useMessages,
  usePublicPro,
  useSendMessage,
} from '@/api/hooks';
import { chatApi, ordersApi } from '@/api/services';
import { detectExternalContactReason } from '@/lib/chatModeration';
import {
  formatEur,
  formatLastSeen,
  formatOrderStatus,
  formatRelativeDate,
} from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import { realtimeManager } from '@/lib/realtime';
import { useRealtimeStore } from '@/lib/stores';
import {
  AppIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  Field,
  fonts,
  gutter,
  IconButton,
  radius,
  Screen,
  SkeletonRows,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

export default function ConversationScreen() {
  const { id, orderId, userId } = useLocalSearchParams<{
    id?: string;
    orderId?: string;
    userId?: string;
  }>();
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const meQuery = useMe();
  const lookupKey = id || orderId || (userId ? `new:${userId}` : '');
  const detailQuery = useMessages(lookupKey.startsWith('new:') ? '' : lookupKey);
  const newPartnerQuery = usePublicPro(
    lookupKey.startsWith('new:') && userId ? userId : '',
  );
  const sendMessage = useSendMessage();
  const approveOrder = useApproveOrder();

  const [draft, setDraft] = useState('');
  const [createdConvId, setCreatedConvId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [deliveringOrder, setDeliveringOrder] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState(false);
  const sendLockRef = useRef(false);
  const orderActionLockRef = useRef(false);
  const targetConvId =
    createdConvId || detailQuery.data?.conversationId || lookupKey;

  useEffect(() => {
    const cid = createdConvId || detailQuery.data?.conversationId;
    if (cid) {
      realtimeManager.joinConversation(cid);
      return () => {
        realtimeManager.leaveConversation(cid);
      };
    }
    return undefined;
  }, [createdConvId, detailQuery.data?.conversationId]);

  useEffect(() => {
    const evt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(evt, () => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });
    return () => sub.remove();
  }, []);

  const myUserId = meQuery.data?.id;
  const myName =
    meQuery.data?.profile?.displayName ||
    [meQuery.data?.profile?.firstName, meQuery.data?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Tú';
  const myAvatar = meQuery.data?.profile?.avatarUrl;
  const order = detailQuery.data?.order;
  const newPro = newPartnerQuery.data;
  const newProName =
    newPro?.businessName ||
    newPro?.user?.profile?.displayName ||
    [newPro?.user?.profile?.firstName, newPro?.user?.profile?.lastName]
      .filter(Boolean)
      .join(' ');
  const partnerName =
    detailQuery.data?.otherParticipant?.displayName ||
    detailQuery.data?.otherParticipant?.businessName ||
    newProName ||
    'Conversación Yewi';
  const partnerAvatar =
    detailQuery.data?.otherParticipant?.avatarUrl ??
    newPro?.user?.profile?.avatarUrl;
  const partnerId =
    detailQuery.data?.otherParticipant?.id || userId || newPro?.userId || '';
  const livePresence = useRealtimeStore((st) =>
    partnerId ? st.presenceByUser[partnerId] : undefined,
  );
  const partnerIsPro = Boolean(
    detailQuery.data?.otherParticipant?.isPro ||
      newPro?.isPro ||
      newPro?.user?.isPro,
  );
  const partnerIsOnline = livePresence
    ? livePresence.isOnline
    : Boolean(detailQuery.data?.otherParticipant?.isOnline);
  const partnerLastSeen =
    livePresence?.lastSeenAt ??
    detailQuery.data?.otherParticipant?.lastSeenAt ??
    null;
  const presenceLabel = partnerIsOnline
    ? 'En línea'
    : partnerLastSeen
      ? formatLastSeen(partnerLastSeen)
      : 'Desconectado';
  const messages = detailQuery.data?.messages ?? [];

  const toggleSelectMessage = (msgId: string, mine: boolean) => {
    if (!mine) {
      toast.info('Solo puedes editar o eliminar tus propios mensajes');
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(msgId)
        ? prev.filter((item) => item !== msgId)
        : [...prev, msgId],
    );
  };

  const handleStartEdit = () => {
    if (selectedIds.length !== 1) return;
    const targetMsg = messages.find((m) => m.id === selectedIds[0]);
    if (!targetMsg) return;
    setEditingMessageId(targetMsg.id);
    setDraft(targetMsg.content);
    setSelectedIds([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0 || deleting) return;
    setDeleting(true);
    try {
      await chatApi.deleteMessages(selectedIds);
      const count = selectedIds.length;
      setSelectedIds([]);
      if (editingMessageId && selectedIds.includes(editingMessageId)) {
        setEditingMessageId(null);
        setDraft('');
      }
      await detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      toast.success(
        count === 1 ? 'Mensaje eliminado' : `${count} mensajes eliminados`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudieron eliminar los mensajes',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSend = async (attachments?: string[]) => {
    if (sendLockRef.current) return;
    const content = draft.trim() || (attachments?.length ? 'Archivo adjunto' : '');
    if (!content || !targetConvId) return;

    const blockedReason = detectExternalContactReason(content);
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

    sendLockRef.current = true;
    setSending(true);

    if (editingMessageId) {
      const targetId = editingMessageId;
      setEditingMessageId(null);
      setDraft('');
      try {
        await chatApi.editMessage(targetId, content);
        await detailQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
        toast.success('Mensaje editado');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo editar el mensaje',
        );
      } finally {
        sendLockRef.current = false;
        setSending(false);
      }
      return;
    }

    setDraft('');
    try {
      const msg = await sendMessage.mutateAsync({
        conversationId: targetConvId,
        content,
        type: attachments?.length ? 'ATTACHMENT' : 'TEXT',
        attachments,
      });
      if (targetConvId.startsWith('new:') && msg.conversationId) {
        setCreatedConvId(msg.conversationId);
        router.replace(`/conversation?id=${encodeURIComponent(msg.conversationId)}` as never);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo enviar el mensaje',
      );
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    try {
      const uploaded = await chatApi.uploadAttachment({
        file: asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri,
        fileName: 'imagen-chat.jpg',
        mimeType: 'image/jpeg',
      });
      await handleSend([uploaded.url]);
    } catch {
      toast.error('No se pudo subir la imagen');
    }
  };

  const handleDeliverOrder = async () => {
    if (!order?.id || orderActionLockRef.current) return;
    orderActionLockRef.current = true;
    setDeliveringOrder(true);
    try {
      await ordersApi.submitDelivery(order.id, {
        message: 'Trabajo finalizado y entregado desde el chat de Yewi.',
        attachmentUrls: [],
      });
      toast.success('Entrega enviada al cliente');
      void detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error entregando pedido');
    } finally {
      orderActionLockRef.current = false;
      setDeliveringOrder(false);
    }
  };

  const handleApproveEscrow = async () => {
    if (!order?.id || orderActionLockRef.current) return;
    orderActionLockRef.current = true;
    setApprovingOrder(true);
    try {
      await approveOrder.mutateAsync(order.id);
      toast.success('¡Entrega aprobada y fondos liberados al profesional!');
      void detailQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo aprobar');
    } finally {
      orderActionLockRef.current = false;
      setApprovingOrder(false);
    }
  };

  const orderActionBusy =
    deliveringOrder || approvingOrder || approveOrder.isPending;

  const orderStatusInfo = order?.id ? formatOrderStatus(order.status) : null;

  return (
    <Screen edges={['top']}>
      {selectedIds.length > 0 ? (
        <View
          style={[
            s.selectionHeader,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <IconButton
            name="x"
            label="Cancelar selección"
            onPress={() => setSelectedIds([])}
          />
          <Text
            variant="heading"
            style={{ color: colors.text, flex: 1 }}
            numberOfLines={1}
          >
            {selectedIds.length}{' '}
            {selectedIds.length === 1 ? 'seleccionado' : 'seleccionados'}
          </Text>
          {selectedIds.length === 1 ? (
            <IconButton
              name="edit-2"
              label="Editar mensaje"
              onPress={handleStartEdit}
            />
          ) : null}
          <IconButton
            name="trash-2"
            label="Eliminar mensajes"
            onPress={() => void handleDeleteSelected()}
          />
        </View>
      ) : (
        <View
          style={[
            s.chatHeader,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <IconButton
            name="chevron-left"
            label="Volver"
            tone="plain"
            onPress={() =>
              router.canGoBack() ? router.back() : router.navigate('/')
            }
          />
          <View style={s.headerAvatarWrap}>
            <Avatar name={partnerName} avatarUrl={partnerAvatar} size={38} />
            <View
              style={[
                s.presenceDot,
                {
                  backgroundColor: partnerIsOnline
                    ? colors.success
                    : colors.textMuted,
                  borderColor: colors.background,
                },
              ]}
            />
          </View>
          <View style={s.headerIdentityCol}>
            <View style={s.headerNameRow}>
              <Text
                variant="heading"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: colors.text, flexShrink: 1 }}
              >
                {partnerName}
              </Text>
              {partnerIsPro ? (
                <AppIcon name="badge-check" size={16} color={colors.primary} />
              ) : null}
            </View>
            <Text
              variant="caption"
              numberOfLines={1}
              style={{
                color: partnerIsOnline ? colors.success : colors.textMuted,
                fontFamily: partnerIsOnline ? fonts.medium : fonts.regular,
              }}
            >
              {presenceLabel}
            </Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        {order?.id ? (
          <View style={{ paddingHorizontal: gutter, paddingBottom: space.sm }}>
            <Card style={{ gap: 6 }}>
              <View style={s.orderBarTop}>
                <Text variant="label" tabular style={{ color: colors.text, flex: 1 }}>
                  Pedido #{order.orderNumber} · {formatEur(order.totalAmount)}
                </Text>
                {orderStatusInfo ? (
                  <Badge
                    label={orderStatusInfo.label}
                    tone={orderStatusInfo.tone}
                  />
                ) : null}
              </View>
              <View style={s.orderActions}>
                {order.status === 'IN_PROGRESS' ||
                order.status === 'REVISION_REQUESTED' ? (
                  <Button
                    variant="secondary"
                    title="Marcar entregado"
                    loading={deliveringOrder}
                    disabled={orderActionBusy}
                    onPress={handleDeliverOrder}
                  />
                ) : null}
                {order.status === 'DELIVERED' ||
                order.status === 'IN_PROGRESS' ? (
                  <Button
                    title="Aprobar y liberar Escrow"
                    loading={approvingOrder || approveOrder.isPending}
                    disabled={orderActionBusy}
                    onPress={handleApproveEscrow}
                  />
                ) : null}
                {order.status === 'COMPLETED' ? (
                  <Button
                    variant="secondary"
                    title="Dejar reseña"
                    onPress={() =>
                      router.push(
                        `/create-review?orderId=${encodeURIComponent(order.id!)}` as never,
                      )
                    }
                  />
                ) : null}
              </View>
            </Card>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            s.messagesList,
            messages.length === 0 && !detailQuery.isLoading
              ? s.emptyMessagesContainer
              : null,
          ]}
          onLayout={() => scrollRef.current?.scrollToEnd({ animated: false })}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {detailQuery.isLoading ? (
            <SkeletonRows count={4} />
          ) : messages.length === 0 ? (
            <View style={s.firstContactWrap}>
              <View style={s.overlapAvatars}>
                <Avatar name={myName} avatarUrl={myAvatar} size={54} />
                <View
                  style={[
                    s.partnerAvatarOverlap,
                    {
                      borderColor: colors.background,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Avatar
                    name={partnerName}
                    avatarUrl={partnerAvatar}
                    size={54}
                  />
                </View>
              </View>

              <Text
                variant="title"
                style={{ color: colors.text, fontFamily: fonts.bold }}
              >
                {partnerName}
              </Text>
              <Text variant="body" tone="secondary" style={{ lineHeight: 20 }}>
                Inicia una conversación sobre tus requisitos con {partnerName}.
              </Text>

              <View style={s.helpDividerRow}>
                <Divider style={{ flex: 1 }} />
                <View style={s.helpBadgeRow}>
                  <AppIcon
                    name="shield-check"
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text
                    variant="caption"
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fonts.semibold,
                    }}
                  >
                    Estamos para ayudarte
                  </Text>
                </View>
                <Divider style={{ flex: 1 }} />
              </View>

              <Text
                variant="caption"
                tone="muted"
                style={s.safetyNoticeText}
              >
                Para mayor seguridad, recuerda que debes realizar todos los pagos
                y comunicaciones dentro de la plataforma.
              </Text>
            </View>
          ) : (
            <>
              {messages.map((msg) => {
                const mine = msg.senderId === myUserId;
                const isSelected = selectedIds.includes(msg.id);
                const bubbleEl = (
                  <Pressable
                    onLongPress={() => toggleSelectMessage(msg.id, mine)}
                    onPress={() => {
                      if (selectedIds.length > 0) {
                        toggleSelectMessage(msg.id, mine);
                      }
                    }}
                    style={[
                      s.bubble,
                      {
                        backgroundColor: mine ? colors.primary : colors.surface,
                        borderColor: isSelected
                          ? colors.text
                          : mine
                            ? colors.primary
                            : colors.border,
                        borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Text
                      variant="body"
                      style={{ color: mine ? '#FFFFFF' : colors.text }}
                    >
                      {msg.content}
                    </Text>
                    <View style={s.bubbleFoot}>
                      {msg.metadata?.editedAt ? (
                        <Text
                          variant="caption"
                          style={{
                            color: mine
                              ? 'rgba(255,255,255,0.78)'
                              : colors.textMuted,
                            fontSize: 10,
                          }}
                        >
                          Editado ·
                        </Text>
                      ) : null}
                      <Text
                        variant="caption"
                        style={{
                          color: mine
                            ? 'rgba(255,255,255,0.78)'
                            : colors.textMuted,
                          fontSize: 10,
                        }}
                      >
                        {formatRelativeDate(msg.createdAt)}
                      </Text>
                      {Array.isArray(msg.metadata?.reactions) &&
                      msg.metadata.reactions.length > 0 ? (
                        <Text variant="caption" style={{ fontSize: 12 }}>
                          {msg.metadata.reactions.map((r) => r.emoji).join(' ')}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );

                return (
                  <Pressable
                    key={msg.id}
                    onPress={() => {
                      if (selectedIds.length > 0) {
                        toggleSelectMessage(msg.id, mine);
                      }
                    }}
                    style={[
                      mine ? s.msgRowRight : s.msgRowLeft,
                      isSelected && {
                        backgroundColor: colors.primarySoft,
                        borderRadius: radius.md,
                        padding: 4,
                      },
                    ]}
                  >
                    {!mine ? (
                      <Avatar
                        name={partnerName}
                        avatarUrl={partnerAvatar}
                        size={28}
                      />
                    ) : null}
                    {bubbleEl}
                    {mine ? (
                      <Avatar name={myName} avatarUrl={myAvatar} size={28} />
                    ) : null}
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>

        {editingMessageId ? (
          <View
            style={[
              s.editingBar,
              {
                backgroundColor: colors.surfaceSubtle,
                borderTopColor: colors.border,
              },
            ]}
          >
            <AppIcon name="edit-2" size={14} color={colors.primary} />
            <Text
              variant="caption"
              style={{ color: colors.textSecondary, flex: 1 }}
            >
              Editando mensaje
            </Text>
            <Pressable
              onPress={() => {
                setEditingMessageId(null);
                setDraft('');
              }}
              hitSlop={8}
            >
              <AppIcon name="x" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            s.composer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(bottom, 10),
            },
          ]}
        >
          <IconButton
            name="image"
            label="Adjuntar imagen"
            tone="filled"
            onPress={handlePickImage}
          />
          <View style={{ flex: 1 }}>
            <Field
              icon="message-circle"
              containerStyle={{ marginBottom: 0 }}
              value={draft}
              onChangeText={(txt) => {
                setDraft(txt);
                if (targetConvId && !targetConvId.startsWith('new:')) {
                  realtimeManager.sendChatTyping(targetConvId, Boolean(txt));
                }
              }}
              placeholder="Escribe un mensaje..."
            />
          </View>
          <IconButton
            name="send"
            label="Enviar mensaje"
            tone="accent"
            loading={sending || sendMessage.isPending}
            disabled={sending || sendMessage.isPending}
            onPress={() => handleSend()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAvatarWrap: {
    position: 'relative',
  },
  presenceDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 9999,
    borderWidth: 2,
  },
  headerIdentityCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  orderBarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  orderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  messagesList: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: space.sm,
  },
  emptyMessagesContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  firstContactWrap: {
    paddingBottom: space.md,
    gap: space.sm,
  },
  overlapAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  partnerAvatarOverlap: {
    marginLeft: -14,
    borderRadius: 9999,
    borderWidth: 2,
  },
  helpDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  helpBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  safetyNoticeText: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: space.sm,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: gutter,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: gutter,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  msgRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
  },
  msgRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 8,
  },
  bubble: {
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  bubbleFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: gutter,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
