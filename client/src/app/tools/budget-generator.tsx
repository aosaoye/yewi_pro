import * as Print from 'expo-print';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useBudgetBenchmark, useMe, useSubscription } from '@/api/hooks';
import type { BudgetItemModel, BudgetUnit } from '@/api/types';
import { buildBudgetHtml } from '@/lib/budgetPdfService';
import { formatEur } from '@/lib/format';
import { useBudgetStore } from '@/lib/stores';
import {
  AppIcon,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  fonts,
  gutter,
  NavHeader,
  PillButton,
  PillCarousel,
  Screen,
  Section,
  SegmentedPills,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

const TEMPLATE_KEYS = [
  { key: 'reforma_bano', label: 'Baño' },
  { key: 'reforma_cocina', label: 'Cocina' },
  { key: 'reforma_integral', label: 'Integral' },
  { key: 'pintura', label: 'Pintura' },
  { key: 'electricidad', label: 'Electricidad' },
  { key: 'fontaneria', label: 'Fontanería' },
];

const VAT_OPTIONS = [
  { key: '10', label: 'IVA Reducido 10%' },
  { key: '21', label: 'IVA General 21%' },
];

export default function BudgetGeneratorScreen() {
  const { colors } = useTheme();
  const meQuery = useMe();
  const subQuery = useSubscription();
  const benchmark = useBudgetBenchmark();

  const {
    title,
    province,
    vatRate,
    estimatedDays,
    validityDays,
    items,
    setTitle,
    setProvince,
    setVatRate,
    setItems,
    addItem,
    removeItem,
    resetDraft,
  } = useBudgetStore();

  const [selectedTemplate, setSelectedTemplate] = useState('reforma_bano');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemQty, setNewItemQty] = useState('10');
  const [newItemUnit, setNewItemUnit] = useState<BudgetUnit>('m²');

  const isPro = Boolean(
    meQuery.data?.isPro ||
      meQuery.data?.professionalProfile?.isPro ||
      subQuery.data?.isPro,
  );

  const totals = useMemo(() => {
    const baseTotal = items.reduce((sum, i) => sum + Number(i.subtotal || 0), 0);
    const laborTotal = items.reduce(
      (sum, i) =>
        sum +
        Number(
          i.laborCost ??
            Number(i.subtotal || 0) * ((i.laborPercent ?? 65) / 100),
        ),
      0,
    );
    const materialTotal = Math.max(0, baseTotal - laborTotal);
    const vatTotal = baseTotal * (vatRate / 100);
    const grandTotal = baseTotal + vatTotal;
    return { baseTotal, laborTotal, materialTotal, vatTotal, grandTotal };
  }, [items, vatRate]);

  if (!isPro) {
    return (
      <Screen edges={['top', 'bottom']}>
        <NavHeader title="Generador de Presupuestos" />
        <View style={s.centerWrap}>
          <EmptyState
            icon="lock"
            title="Herramienta exclusiva Yewi Pro"
            message="Calcula partidas con precios calibrados por provincia en España y exporta presupuestos profesionales en PDF."
            actionLabel="Activar Yewi Pro (15,99 €/mes)"
            onAction={() => router.push('/subscription' as never)}
          />
        </View>
      </Screen>
    );
  }

  const handleLoadTemplate = async (templateKey: string) => {
    setSelectedTemplate(templateKey);
    try {
      const res = await benchmark.mutateAsync({
        templateKey,
        province: province.trim() || 'Madrid',
      });
      if (res.template) {
        setTitle(res.template.title);
        const mapped: BudgetItemModel[] = res.template.items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          unit: i.unit,
          quantity: i.defaultQuantity ?? i.quantity ?? 1,
          unitPrice: i.averagePrice ?? i.unitPrice ?? 0,
          laborPercent: i.laborPercent ?? 65,
          materialPercent: i.materialPercent ?? 35,
          laborCost: i.laborCost,
          materialCost: i.materialCost,
          subtotal: i.subtotal ?? 0,
        }));
        setItems(mapped);
        toast.success(`Plantilla cargada (${res.province})`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error cargando plantilla',
      );
    }
  };

  const handleBenchmarkAddItem = async () => {
    if (!newItemTitle.trim()) {
      toast.info('Escribe el concepto de la partida');
      return;
    }
    const qty = Math.max(1, Number(newItemQty) || 1);
    try {
      const res = await benchmark.mutateAsync({
        itemTitle: newItemTitle.trim(),
        unit: newItemUnit,
        quantity: qty,
        province: province.trim() || 'Madrid',
      });
      const avg = res.averagePrice ?? 35;
      const subtotal = Number((avg * qty).toFixed(2));
      addItem({
        id: `item-${Date.now()}`,
        title: res.itemTitle || newItemTitle.trim(),
        unit: (res.unit as BudgetUnit) || newItemUnit,
        quantity: qty,
        unitPrice: avg,
        laborPercent: res.laborPercent ?? 65,
        materialPercent: res.materialPercent ?? 35,
        laborCost: Number((subtotal * ((res.laborPercent ?? 65) / 100)).toFixed(2)),
        materialCost: Number((subtotal * ((res.materialPercent ?? 35) / 100)).toFixed(2)),
        subtotal,
      });
      setNewItemTitle('');
      toast.success(`Partida añadida: ${formatEur(avg)}/${res.unit ?? newItemUnit}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo estimar la partida',
      );
    }
  };

  const handleExportPdf = async () => {
    try {
      const html = buildBudgetHtml({
        title,
        items,
        province,
        validityDays,
        estimatedDays,
        vatRate,
        ...totals,
        professionalBusiness:
          meQuery.data?.professionalProfile?.businessName ?? undefined,
        professionalName: meQuery.data?.profile?.displayName ?? undefined,
        professionalEmail: meQuery.data?.email,
      });
      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir presupuesto PDF',
        });
      } else {
        toast.success('PDF generado correctamente');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error generando PDF',
      );
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader
        title="Presupuestos IA"
        right={
          <PillButton
            size="sm"
            variant="soft"
            tone="neutral"
            label="Limpiar"
            onPress={resetDraft}
          />
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
          <View style={s.padded}>
            <Field icon="file-text" label="Título del presupuesto" value={title} onChangeText={setTitle} />
            <Field
              icon="map-pin"
              label="Provincia (ajuste de costes regional)"
              placeholder="Madrid, Zaragoza, Barcelona..."
              value={province}
              onChangeText={setProvince}
            />
            <SegmentedPills
              options={VAT_OPTIONS}
              value={String(vatRate)}
              onChange={(val) => setVatRate(val === '10' ? 10 : 21)}
              tone="primary"
              size="sm"
            />
          </View>

          <Text variant="label" tone="muted" style={s.sectionTitle}>
            Plantillas sectoriales rápidas
          </Text>
          <PillCarousel
            options={TEMPLATE_KEYS}
            value={selectedTemplate}
            onChange={(tplKey) => void handleLoadTemplate(tplKey)}
            tone="primary"
            size="sm"
            contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm }}
          />

          <View style={s.padded}>
            <Section title="Añadir partida con benchmarking IA">
              <View>
                <Field
                  icon="layers"
                  label="Concepto de obra o servicio"
                  placeholder="Ej: Alicatado baño gres porcelánico"
                  value={newItemTitle}
                  onChangeText={setNewItemTitle}
                />
                <View style={s.twoCols}>
                  <View style={{ flex: 1 }}>
                    <Field
                      icon="hash"
                      label="Cantidad"
                      keyboardType="numeric"
                      value={newItemQty}
                      onChangeText={setNewItemQty}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      icon="tag"
                      label="Unidad (m², ml, ud, h, pa)"
                      value={newItemUnit}
                      onChangeText={(u) => setNewItemUnit((u as BudgetUnit) || 'ud')}
                    />
                  </View>
                </View>
                <Button
                  size="sm"
                  title="Estimar precio y añadir"
                  loading={benchmark.isPending}
                  onPress={handleBenchmarkAddItem}
                />
              </View>
            </Section>
          </View>

          <Text variant="label" tone="muted" style={s.sectionTitle}>
            Partidas ({items.length})
          </Text>
          <Divider />

          {items.length === 0 ? (
            <EmptyState
              icon="layers"
              title="Sin partidas todavía"
              message="Elige una plantilla rápida o añade partidas personalizadas arriba."
            />
          ) : (
            items.map((item, idx) => (
              <React.Fragment key={item.id}>
                <View style={s.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading" style={{ color: colors.text, fontSize: 15 }}>
                      {item.title}
                    </Text>
                    <Text variant="caption" tone="muted" tabular>
                      {item.quantity} {item.unit} × {formatEur(item.unitPrice)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text
                      variant="heading"
                      tabular
                      style={{ color: colors.primary, fontFamily: fonts.bold }}
                    >
                      {formatEur(item.subtotal)}
                    </Text>
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                      <AppIcon name="trash-2" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
                {idx < items.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))
          )}

          {items.length > 0 ? (
            <View style={s.padded}>
              <Card style={{ gap: 8 }}>
                <View style={s.totalRow}>
                  <Text variant="body" tone="secondary">Base imponible</Text>
                  <Text variant="heading" tabular>{formatEur(totals.baseTotal)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text variant="body" tone="secondary">IVA ({vatRate}%)</Text>
                  <Text variant="heading" tabular>{formatEur(totals.vatTotal)}</Text>
                </View>
                <Divider />
                <View style={s.totalRow}>
                  <Text variant="title" style={{ color: colors.text }}>Total</Text>
                  <Text variant="display" tabular style={{ color: colors.primary, fontSize: 24 }}>
                    {formatEur(totals.grandTotal)}
                  </Text>
                </View>
                <Button
                  title="Exportar y compartir PDF"
                  icon="share"
                  onPress={handleExportPdf}
                  style={{ marginTop: space.xs }}
                />
              </Card>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: gutter,
  },
  padded: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    gap: space.md,
  },
  sectionTitle: {
    paddingHorizontal: gutter,
    paddingTop: space.xl,
    paddingBottom: space.xs,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  twoCols: {
    flexDirection: 'row',
    gap: space.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
