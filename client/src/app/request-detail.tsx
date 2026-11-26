import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import {
  useAcceptProposal,
  useDeleteRequest,
  useMe,
  useRequestDetail,
  useSendProposal,
  useUnlockLead,
} from '@/api/hooks';
import { formatEur, formatLeadStatus, formatShortDate } from '@/lib/format';
import { payLeadProposalWithStripe } from '@/lib/stripeCheckoutService';
import { queryClient } from '@/lib/queryClient';
import { payWithRedsysBizum } from '@/lib/redsysService';
import { zodErrorsToMap } from '@/lib/schemas';
import {
  AppIcon,
  Avatar,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  fonts,
  gutter,
  type IconName,
  ListGroup,
  ListRow,
  NavHeader,
  Screen,
  SkeletonRows,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

const proposalSchema = z.object({
  price: z
    .string()
    .trim()
    .refine((v) => {
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) && n > 0;
    }, 'Introduce un importe válido mayor que 0'),
  days: z
    .string()
    .trim()
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1;
    }, 'Indica al menos 1 día'),
  message: z
    .string()
    .trim()
    .min(10, 'Describe qué incluye tu presupuesto (mín. 10 caracteres)'),
});

function proposalStatusInfo(status: string): { icon: IconName; label: string } {
  switch (status) {
    case 'ACCEPTED':
      return { icon: 'check-circle', label: 'Aceptado' };
    case 'REJECTED':
      return { icon: 'x-circle', label: 'Rechazado' };
    default:
      return { icon: 'clock', label: 'Pendiente' };
  }
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const meQuery = useMe();
  const requestQuery = useRequestDetail(id ?? '');
  const unlockLead = useUnlockLead();
  const sendProposal = useSendProposal();
  const acceptProposal = useAcceptProposal();
  const deleteRequest = useDeleteRequest();

  const [price, setPrice] = useState('');
  const [days, setDays] = useState('3');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'price' | 'days' | 'message', string>>
  >({});
  const [unlocking, setUnlocking] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [acceptingProposalId, setAcceptingProposalId] = useState<string | null>(
    null,
  );
  const [payingProposalId, setPayingProposalId] = useState<string | null>(null);
  const [bizumProposalId, setBizumProposalId] = useState<string | null>(null);
  const actionLockRef = useRef(false);

  if (requestQuery.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Detalle de solicitud" solidSurface />
        <View style={{ paddingTop: space.md }}>
          <SkeletonRows count={3} />
        </View>
      </Screen>
    );
  }

  if (requestQuery.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Detalle de solicitud" solidSurface />
        <ErrorState
          error={requestQuery.error}
          onRetry={() => void requestQuery.refetch()}
        />
      </Screen>
    );
  }

  const req = requestQuery.data;
  if (!req) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Detalle de solicitud" solidSurface />
        <EmptyState icon="file" title="Solicitud no encontrada" />
      </Screen>
    );
  }

  const isOwner = req.clientId === meQuery.data?.id;
  const isProUser = Boolean(
    meQuery.data?.roles?.includes('PROFESSIONAL') ||
      meQuery.data?.professionalProfile,
  );
  const isProViewer = !isOwner && isProUser;
  const statusInfo = formatLeadStatus(req.status);
  const statusIcon: IconName =
    req.status === 'FULFILLED'
      ? 'check-circle'
      : req.status === 'EXPIRED' || req.status === 'CANCELLED'
        ? 'x-circle'
        : 'clock';

  const handleUnlock = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setUnlocking(true);
    try {
      await unlockLead.mutateAsync(req.id);
      toast.success('Solicitud desbloqueada con Yewi Pro');
      void requestQuery.refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Requiere Yewi Pro activo',
      );
      router.push('/subscription' as never);
    } finally {
      actionLockRef.current = false;
      setUnlocking(false);
    }
  };

  const handleSendProposal = async () => {
    if (actionLockRef.current) return;
    const parsed = proposalSchema.safeParse({ price, days, message });
    if (!parsed.success) {
      setFieldErrors(zodErrorsToMap(parsed.error));
      return;
    }
    setFieldErrors({});
    actionLockRef.current = true;
    setSendingProposal(true);
    try {
      await sendProposal.mutateAsync({
        requestId: req.id,
        price: Number(price.replace(',', '.')),
        estimatedDays: Math.max(1, Number(days) || 3),
        message: message.trim(),
      });
      setPrice('');
      setMessage('');
      toast.success('Presupuesto enviado al cliente');
      void requestQuery.refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error enviando presupuesto',
      );
    } finally {
      actionLockRef.current = false;
      setSendingProposal(false);
    }
  };

  const handleAcceptWallet = async (proposalId: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setAcceptingProposalId(proposalId);
    try {
      const order = await acceptProposal.mutateAsync(proposalId);
      toast.success(`Presupuesto aceptado · Pedido ${order.orderNumber}`);
      router.replace(
        `/conversation?orderId=${encodeURIComponent(order.id)}` as never,
      );
    } catch (err) {
      actionLockRef.current = false;
      setAcceptingProposalId(null);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Saldo insuficiente o error aceptando propuesta',
      );
    }
  };

  const handleCheckoutProposal = async (
    proposalId: string,
    amount?: number,
  ) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setPayingProposalId(proposalId);
    try {
      const { order } = await payLeadProposalWithStripe(proposalId);
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(
        order?.orderNumber
          ? `Presupuesto aceptado · Pedido ${order.orderNumber}`
          : 'Pago completado con Stripe',
      );
      if (order?.id) {
        router.replace(
          `/conversation?orderId=${encodeURIComponent(order.id)}` as never,
        );
        return;
      }
      actionLockRef.current = false;
      setPayingProposalId(null);
    } catch (err) {
      actionLockRef.current = false;
      setPayingProposalId(null);
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la compra integrada',
      );
    }
  };

  const handleBizumProposal = async (proposalId: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setBizumProposalId(proposalId);
    try {
      const res = await payWithRedsysBizum({
        purchaseType: 'LEAD_PROPOSAL',
        proposalId,
      });
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(
        res.orderNumber
          ? `Presupuesto pagado con Bizum · Pedido ${res.orderNumber}`
          : 'Presupuesto pagado con Bizum',
      );
      if (res.orderId) {
        router.replace(
          `/conversation?orderId=${encodeURIComponent(res.orderId)}` as never,
        );
        return;
      }
      actionLockRef.current = false;
      setBizumProposalId(null);
    } catch (err) {
      actionLockRef.current = false;
      setBizumProposalId(null);
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el pago con Bizum',
      );
    }
  };

  const handleDelete = () => {
    if (actionLockRef.current || deleteRequest.isPending) return;
    Alert.alert(
      'Eliminar solicitud',
      '¿Deseas cancelar y eliminar esta solicitud?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (actionLockRef.current) return;
            actionLockRef.current = true;
            try {
              await deleteRequest.mutateAsync(req.id);
              toast.info('Solicitud eliminada');
              router.back();
            } catch (err) {
              actionLockRef.current = false;
              toast.error(
                err instanceof Error ? err.message : 'No se pudo eliminar',
              );
            }
          },
        },
      ],
    );
  };

  const proposalPaymentBusy =
    acceptProposal.isPending ||
    Boolean(acceptingProposalId) ||
    Boolean(payingProposalId) ||
    Boolean(bizumProposalId);

  const proposals = req.proposals ?? [];
  const budgetText = req.budgetMax
    ? formatEur(req.budgetMax, 0)
    : req.budgetMin
      ? `Desde ${formatEur(req.budgetMin, 0)}`
      : 'A valorar';

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Detalle de solicitud" solidSurface />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Cabecera abierta de la solicitud */}
        <View style={s.summarySection}>
          <View style={s.metaRow}>
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
            {req.isUrgent ? (
              <View style={s.inlineMeta}>
                <AppIcon name="zap" size={12} color={colors.textMuted} />
                <Text variant="caption" tone="muted">
                  Urgente
                </Text>
              </View>
            ) : null}
            {req.category?.name ? (
              <Text
                variant="caption"
                style={{ fontFamily: fonts.semibold, color: colors.text }}
              >
                · {req.category.name}
              </Text>
            ) : null}
            <Text variant="caption" tone="muted">
              · {formatShortDate(req.createdAt)}
            </Text>
          </View>

          <Text variant="title" style={{ color: colors.text }}>
            {req.title}
          </Text>
          <Text variant="body" tone="secondary" style={{ lineHeight: 22 }}>
            {req.description}
          </Text>
        </View>

        <Divider />

        {/* Datos clave en formato ListGroup homogéneo */}
        <ListGroup>
          <ListRow
            icon="map-pin"
            plainIcon
            title="Ubicación"
            subtitle={
              req.postalCode ? `${req.city} (${req.postalCode})` : req.city
            }
            chevron={false}
          />
          <ListRow
            icon="dollar-sign"
            plainIcon
            title="Presupuesto orientativo"
            right={
              <Text
                variant="heading"
                tabular
                style={{ color: colors.text, fontFamily: fonts.bold }}
              >
                {budgetText}
              </Text>
            }
            chevron={false}
          />
          <ListRow
            icon="users"
            plainIcon
            title="Profesionales interesados"
            right={
              <Text variant="body" tone="muted" tabular>
                {req.unlocksCount ?? 0} / {req.maxUnlocks ?? 5}
              </Text>
            }
            chevron={false}
          />
        </ListGroup>

        {req.isUnlocked && req.client ? (
          <>
            <Divider />
            <ListGroup title="Contacto del cliente">
              <ListRow
                icon="user"
                plainIcon
                title={
                  req.client.profile?.displayName ||
                  req.client.profile?.firstName ||
                  'Cliente Yewi'
                }
                chevron={false}
              />
              {req.client.profile?.phoneNumber ? (
                <ListRow
                  icon="phone"
                  plainIcon
                  title={req.client.profile.phoneNumber}
                  chevron={false}
                />
              ) : null}
              {req.address ? (
                <ListRow
                  icon="map-pin"
                  plainIcon
                  title={req.address}
                  chevron={false}
                />
              ) : null}
            </ListGroup>
          </>
        ) : null}

        {isProViewer && req.status === 'OPEN' ? (
          <>
            <Divider />
            {!req.isUnlocked ? (
              <View style={s.sectionBlock}>
                <Card tone="soft" style={{ gap: space.sm }}>
                  <Text variant="heading" style={{ color: colors.text }}>
                    Desbloquea los datos de contacto
                  </Text>
                  <Text variant="body" tone="secondary">
                    Accede al teléfono del cliente y envía tu presupuesto con Yewi
                    Pro.
                  </Text>
                  <Button
                    title="Desbloquear solicitud"
                    loading={unlockLead.isPending || unlocking}
                    disabled={unlockLead.isPending || unlocking}
                    onPress={handleUnlock}
                  />
                </Card>
              </View>
            ) : (
              <View style={s.sectionBlock}>
                <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
                  Enviar presupuesto
                </Text>
                <View style={s.twoCols}>
                  <View style={{ flex: 1 }}>
                    <Field
                      icon="dollar-sign"
                      label="Precio total (€)"
                      keyboardType="numeric"
                      placeholder="150"
                      value={price}
                      error={fieldErrors.price}
                      onChangeText={(val) => {
                        setPrice(val);
                        if (fieldErrors.price) {
                          setFieldErrors((e) => ({ ...e, price: undefined }));
                        }
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      icon="clock"
                      label="Días estimados"
                      keyboardType="numeric"
                      placeholder="3"
                      value={days}
                      error={fieldErrors.days}
                      onChangeText={(val) => {
                        setDays(val);
                        if (fieldErrors.days) {
                          setFieldErrors((e) => ({ ...e, days: undefined }));
                        }
                      }}
                    />
                  </View>
                </View>
                <Field
                  icon="file-text"
                  label="Detalle del presupuesto"
                  placeholder="Incluye materiales, desplazamiento y garantía..."
                  multiline
                  numberOfLines={3}
                  value={message}
                  error={fieldErrors.message}
                  onChangeText={(val) => {
                    setMessage(val);
                    if (fieldErrors.message) {
                      setFieldErrors((e) => ({ ...e, message: undefined }));
                    }
                  }}
                />
                <Button
                  title="Enviar presupuesto"
                  loading={sendProposal.isPending || sendingProposal}
                  disabled={sendProposal.isPending || sendingProposal}
                  onPress={handleSendProposal}
                />
              </View>
            )}
          </>
        ) : null}

        <Divider />

        {/* Presupuestos recibidos en formato abierto */}
        <View style={s.proposalsWrap}>
          <Text style={[s.sectionLabel, s.proposalsHeading, { color: colors.textMuted }]}>
            Presupuestos recibidos
          </Text>
          {proposals.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="Sin presupuestos todavía"
              message="Cuando los profesionales envíen sus ofertas aparecerán aquí."
            />
          ) : (
            <ListGroup>
              {proposals.map((prop) => {
                const proName =
                  prop.professionalProfile?.businessName ||
                  prop.professionalProfile?.user?.profile?.displayName ||
                  'Profesional Yewi';
                const propStatus = proposalStatusInfo(prop.status);
                return (
                  <View key={prop.id} style={s.proposalRow}>
                    <View style={s.proposalTop}>
                      <Avatar
                        name={proName}
                        avatarUrl={
                          prop.professionalProfile?.user?.profile?.avatarUrl
                        }
                        size={38}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          variant="heading"
                          numberOfLines={1}
                          style={{ color: colors.text }}
                        >
                          {proName}
                        </Text>
                        <View style={s.inlineMeta}>
                          <AppIcon
                            name={propStatus.icon}
                            size={13}
                            color={colors.textMuted}
                          />
                          <Text variant="caption" tone="muted">
                            {prop.estimatedDays} días · {propStatus.label}
                          </Text>
                        </View>
                      </View>
                      <Text
                        variant="title"
                        tabular
                        style={{ color: colors.text, fontFamily: fonts.bold }}
                      >
                        {formatEur(prop.price)}
                      </Text>
                    </View>

                    <Text variant="body" tone="secondary" style={{ lineHeight: 21 }}>
                      {prop.message}
                    </Text>

                    {isOwner && prop.status === 'PENDING' ? (
                      <View style={s.twoCols}>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Saldo"
                          style={{ flex: 1 }}
                          loading={acceptingProposalId === prop.id}
                          disabled={proposalPaymentBusy}
                          onPress={() => handleAcceptWallet(prop.id)}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="smartphone"
                          title="Bizum"
                          style={{ flex: 1 }}
                          loading={bizumProposalId === prop.id}
                          disabled={proposalPaymentBusy}
                          onPress={() => handleBizumProposal(prop.id)}
                        />
                        <Button
                          size="sm"
                          title="En la app"
                          style={{ flex: 1 }}
                          loading={payingProposalId === prop.id}
                          disabled={proposalPaymentBusy}
                          onPress={() =>
                            handleCheckoutProposal(prop.id, Number(prop.price))
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ListGroup>
          )}
        </View>

        {isOwner ? (
          <View style={s.deleteWrap}>
            <Button
              variant="danger"
              title="Eliminar solicitud"
              loading={deleteRequest.isPending}
              disabled={deleteRequest.isPending}
              onPress={handleDelete}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingBottom: space.xxxl,
  },
  summarySection: {
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    gap: space.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionBlock: {
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    gap: space.sm,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: fonts.bold,
    marginBottom: space.xs,
  },
  twoCols: {
    flexDirection: 'row',
    gap: space.sm,
  },
  proposalsWrap: {
    paddingTop: space.lg,
  },
  proposalsHeading: {
    paddingHorizontal: gutter,
  },
  proposalRow: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: space.sm,
  },
  proposalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  deleteWrap: {
    paddingHorizontal: gutter,
    paddingTop: space.lg,
  },
});
