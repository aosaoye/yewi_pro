import React, { useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useWallet } from '@/api/hooks';
import { walletApi } from '@/api/services';
import { AnalyticsCharts } from '@/components/AnalyticsCharts';
import { PortfolioBarChart } from '@/components/PortfolioBarChart';
import {
  buildMonthlyFinancialSeries,
  isPositiveTransaction,
} from '@/lib/analytics';
import {
  formatEur,
  formatShortDate,
  formatTransactionType,
} from '@/lib/format';
import { payWalletTopupWithStripe } from '@/lib/stripeCheckoutService';
import { queryClient } from '@/lib/queryClient';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  fonts,
  gutter,
  ListRow,
  NavHeader,
  PillButton,
  Screen,
  Section,
  SkeletonRows,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

const TOPUP_PRESETS = [20, 50, 100];

export default function WalletScreen() {
  const { colors } = useTheme();
  const walletQuery = useWallet();
  const [payoutAmount, setPayoutAmount] = useState('');
  const [iban, setIban] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleTopup = async (amount: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await payWalletTopupWithStripe(amount);
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      toast.success(`Saldo recargado (${formatEur(amount, 0)})`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el pago con Stripe',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handlePayout = async () => {
    if (busyRef.current) return;
    const amt = Number(payoutAmount);
    if (!amt || amt < 20) {
      toast.info('El importe mínimo de retiro es 20,00 €');
      return;
    }
    if (!iban.trim()) {
      toast.info('Introduce tu IBAN de destino');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await walletApi.requestPayout(amt, iban.trim());
      setPayoutAmount('');
      setIban('');
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      toast.success(res.message);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo solicitar el retiro',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const transactions = useMemo(
    () => walletQuery.data?.transactions ?? [],
    [walletQuery.data?.transactions],
  );
  const monthlySeries = useMemo(
    () => buildMonthlyFinancialSeries(transactions, 6),
    [transactions],
  );
  const netSeries = useMemo(
    () =>
      monthlySeries.map((m) => ({
        key: m.key,
        label: m.shortLabel,
        capLabel: m.capLabel,
        value: Math.max(0, m.net),
      })),
    [monthlySeries],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Billetera y Retiros" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={walletQuery.isRefetching}
            onRefresh={() => void walletQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {walletQuery.isLoading ? (
          <View style={s.padded}>
            <SkeletonRows count={3} />
          </View>
        ) : walletQuery.isError ? (
          <ErrorState
            error={walletQuery.error}
            onRetry={() => void walletQuery.refetch()}
          />
        ) : (
          <>
            <View style={s.padded}>
              <Card tone="solid" style={{ gap: space.md }}>
                <View style={s.balanceGrid}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="caption"
                      style={{ color: 'rgba(255,255,255,0.82)' }}
                    >
                      Disponible
                    </Text>
                    <Text
                      variant="display"
                      tabular
                      style={{ color: colors.primaryForeground, fontSize: 28 }}
                    >
                      {formatEur(walletQuery.data?.fiatAvailableBalance ?? 0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="caption"
                      style={{ color: 'rgba(255,255,255,0.82)' }}
                    >
                      En custodia Escrow
                    </Text>
                    <Text
                      variant="heading"
                      tabular
                      style={{
                        color: colors.primaryForeground,
                        fontFamily: fonts.bold,
                      }}
                    >
                      {formatEur(walletQuery.data?.fiatPendingBalance ?? 0)}
                    </Text>
                  </View>
                </View>
              </Card>

              <View style={{ gap: space.xs }}>
                <Text variant="label" tone="secondary">
                  Recarga rápida
                </Text>
                <View style={s.presetsRow}>
                  {TOPUP_PRESETS.map((amt) => (
                    <PillButton
                      key={amt}
                      label={`+${amt} €`}
                      tone="primary"
                      variant="soft"
                      size="md"
                      style={{ flex: 1 }}
                      disabled={busy}
                      onPress={() => void handleTopup(amt)}
                    />
                  ))}
                </View>
              </View>

              <Section title="Retirar saldo a cuenta bancaria">
                <View>
                  <Field
                    icon="dollar-sign"
                    label="Importe a retirar (€, mínimo 20 €)"
                    keyboardType="numeric"
                    placeholder="50"
                    value={payoutAmount}
                    onChangeText={setPayoutAmount}
                  />
                  <Field
                    icon="credit-card"
                    label="IBAN o cuenta de destino"
                    placeholder="ES91 2100 0418 4502 0005 1332"
                    autoCapitalize="characters"
                    value={iban}
                    onChangeText={setIban}
                  />
                  <Button
                    title="Solicitar transferencia SEPA"
                    loading={busy}
                    disabled={busy}
                    onPress={handlePayout}
                  />
                </View>
              </Section>
            </View>

            {transactions.length > 0 ? (
              <>
                <View style={{ paddingTop: space.xl, paddingBottom: space.lg }}>
                  <PortfolioBarChart
                    title="Balance neto mensual"
                    subtitle="Flujo real de últimos 6 meses"
                    data={netSeries}
                  />
                </View>
                <Divider />
                <View style={{ paddingVertical: space.lg }}>
                  <AnalyticsCharts data={monthlySeries} />
                </View>
                <Divider />
              </>
            ) : null}

            <Text variant="label" tone="muted" style={s.listHeading}>
              Últimos movimientos
            </Text>
            <Divider />

            {transactions.length === 0 ? (
              <EmptyState
                icon="credit-card"
                title="Sin movimientos todavía"
                message="Tus recargas, pagos en Escrow y cobros aparecerán aquí."
              />
            ) : (
              transactions.map((tx, idx) => {
                const positive = isPositiveTransaction(tx.type);
                return (
                  <React.Fragment key={tx.id}>
                    <ListRow
                      icon={positive ? 'arrow-down-left' : 'arrow-up-right'}
                      title={formatTransactionType(tx.type)}
                      subtitle={`${formatShortDate(tx.createdAt)} · ${tx.status}`}
                      chevron={false}
                      right={
                        <Text
                          variant="heading"
                          tabular
                          style={{
                            color: positive ? colors.success : colors.text,
                            fontFamily: fonts.bold,
                          }}
                        >
                          {positive ? '+' : ''}
                          {formatEur(tx.amount)}
                        </Text>
                      }
                    />
                    {idx < transactions.length - 1 ? <Divider /> : null}
                  </React.Fragment>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  padded: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    gap: space.xl,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  presetsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: space.sm,
  },
  listHeading: {
    paddingHorizontal: gutter,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    fontSize: 12,
    letterSpacing: 0.6,
  },
});
