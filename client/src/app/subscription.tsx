import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSubscription } from '@/api/hooks';
import { paymentsApi } from '@/api/services';
import {
  openStoreSubscriptionsSettings,
  purchaseProSubscriptionIap,
  restoreStorePurchasesIap,
} from '@/lib/iapService';
import { queryClient } from '@/lib/queryClient';
import {
  AppIcon,
  Button,
  Card,
  Divider,
  gutter,
  NavHeader,
  Screen,
  Section,
  SkeletonRows,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

const BENEFITS = [
  'Oportunidades ilimitadas de clientes sin gastar créditos extra',
  'Vídeos y galería destacada en tu portafolio profesional',
  'Insignia destacada Yewi Pro y prioridad en el directorio',
];

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const subQuery = useSubscription();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const isPro = Boolean(subQuery.data?.isPro);
  const cancelAtPeriodEnd = Boolean(
    subQuery.data?.subscription?.cancelAtPeriodEnd,
  );

  const handleCheckout = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await purchaseProSubscriptionIap();
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Suscripción Yewi Pro activada');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la compra integrada',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await restoreStorePurchasesIap();
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Estado de suscripción actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error restaurando compras');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleToggleRenew = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = cancelAtPeriodEnd
        ? await paymentsApi.resumeAutoRenew()
        : await paymentsApi.cancelAutoRenew();
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleManageStore = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await openStoreSubscriptionsSettings();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo abrir la tienda de suscripciones',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const storeManageLabel =
    Platform.OS === 'ios'
      ? 'Gestionar en App Store'
      : 'Gestionar en Google Play';

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Yewi Pro" />

      <ScrollView contentContainerStyle={s.scroll}>
        {subQuery.isLoading ? (
          <SkeletonRows count={3} />
        ) : (
          <Card
            tone={isPro ? 'accentSoft' : 'soft'}
            style={{ gap: space.sm }}
          >
            <Text variant="kicker" style={{ color: colors.accent }}>
              {isPro ? 'Plan activo' : 'Membresía profesional'}
            </Text>
            <Text variant="display" tabular style={{ color: colors.text }}>
              {isPro ? 'Eres miembro Yewi Pro' : '15,99 € / mes'}
            </Text>
            <Text variant="body" tone="secondary">
              {isPro
                ? cancelAtPeriodEnd
                  ? 'Renovación automática pausada al final del periodo.'
                  : 'Tu suscripción está activa con todas las ventajas Pro.'
                : 'Suscríbete mediante compra integrada y destaca frente a tu competencia.'}
            </Text>

            <View style={{ gap: 8, marginTop: space.xs }}>
              {isPro ? (
                <>
                  <Button
                    title={
                      cancelAtPeriodEnd
                        ? 'Reanudar renovación automática'
                        : 'Cancelar renovación automática'
                    }
                    variant="secondary"
                    loading={busy}
                    disabled={busy}
                    onPress={handleToggleRenew}
                  />
                  <Button
                    title={storeManageLabel}
                    variant="ghost"
                    disabled={busy}
                    onPress={handleManageStore}
                  />
                </>
              ) : (
                <Button
                  title="Activar Yewi Pro en la app"
                  loading={busy}
                  disabled={busy}
                  onPress={handleCheckout}
                />
              )}

              <Button
                size="sm"
                variant="ghost"
                title="Restaurar compras"
                disabled={busy}
                onPress={handleRestore}
              />
            </View>
          </Card>
        )}

        <Section title="Incluye con Yewi Pro">
          <View style={s.benefitsList}>
            {BENEFITS.map((item, idx) => (
              <React.Fragment key={item}>
                <View style={s.benefitRow}>
                  <AppIcon name="check-circle" size={18} color={colors.primary} />
                  <Text variant="body" style={{ flex: 1, color: colors.text }}>
                    {item}
                  </Text>
                </View>
                {idx < BENEFITS.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: gutter,
    paddingBottom: 80,
    gap: space.xl,
  },
  benefitsList: {
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
