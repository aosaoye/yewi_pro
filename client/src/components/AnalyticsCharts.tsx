import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  computePeriodComparison,
  hexToRgba,
  type MonthlyFinancialPoint,
} from '@/lib/analytics';
import { formatEur } from '@/lib/format';
import { AppIcon, fonts, gutter, type IconName, radius, space, Text, useTheme } from '@/ui';

export interface AnalyticsChartsProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  data: MonthlyFinancialPoint[];
  plotHeight?: number;
}

/**
 * Gráfico dual comparativo abierto sobre colors.background (sin contenedor card),
 * con serie primaria (#00B4D8) y serie comparativa cálida secundaria (#F43F5E / #FB7185)
 * degradadas a transparente, guías difuminadas con LinearGradient, tooltip íntegro en
 * plotArea completo y comparador porcentual dinámico periodo a periodo.
 */
export function AnalyticsCharts({
  title = 'Evolución mensual',
  subtitle = 'Comparativa real de entradas frente a salidas',
  primaryLabel = 'Ingresos',
  secondaryLabel = 'Pagos y retiros',
  data,
  plotHeight = 148,
}: AnalyticsChartsProps) {
  const { colors, isDark } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, data.length - 1),
  );
  const [plotWidth, setPlotWidth] = useState(0);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, data.length - 1));
  const activeItem = data[safeIndex];

  const maxVal = useMemo(() => {
    const rawMax = Math.max(
      ...data.map((d) => Math.max(0, d.income, d.outflow)),
      0,
    );
    return rawMax > 0 ? rawMax : 1;
  }, [data]);

  const meanRatio = useMemo(() => {
    if (data.length === 0) return 0;
    const avg =
      data.reduce((acc, d) => acc + Math.max(0, d.income), 0) / data.length;
    return Math.min(0.95, Math.max(0.1, avg / maxVal));
  }, [data, maxVal]);

  const comparison = useMemo(
    () =>
      computePeriodComparison(
        data.map((d) => d.income),
        data.map((d) => d.capLabel),
        safeIndex,
      ),
    [data, safeIndex],
  );

  const deltaColor =
    comparison.direction === 'up'
      ? colors.success
      : comparison.direction === 'down'
      ? colors.danger
      : colors.textMuted;

  const deltaIcon: IconName =
    comparison.direction === 'up'
      ? 'trending-up'
      : comparison.direction === 'down'
      ? 'trending-down'
      : 'minus';

  const railColor = isDark
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(15, 23, 42, 0.07)';
  const hGuideColor = isDark
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(15, 23, 42, 0.10)';

  const tooltipMinWidth = 220;
  const colCenterX =
    plotWidth > 0 && data.length > 0
      ? ((safeIndex + 0.5) / data.length) * plotWidth
      : 0;
  const tooltipLeft =
    plotWidth > 0
      ? Math.max(
          0,
          Math.min(
            plotWidth - tooltipMinWidth,
            colCenterX - tooltipMinWidth / 2,
          ),
        )
      : 0;

  if (data.length === 0) return null;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" style={{ color: colors.text }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={s.deltaPill}>
          <AppIcon name={deltaIcon} size={13} color={deltaColor} />
          <Text
            variant="caption"
            tabular
            style={{ color: deltaColor, fontFamily: fonts.semibold }}
          >
            {comparison.hasPrevious
              ? `${comparison.formattedPercent} (${comparison.referenceLabel})`
              : comparison.referenceLabel}
          </Text>
        </View>
      </View>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
          <Text variant="caption" tone="secondary">
            {primaryLabel}
          </Text>
        </View>
        <View style={s.legendItem}>
          <View
            style={[s.legendDot, { backgroundColor: colors.chartSecondary }]}
          />
          <Text variant="caption" tone="secondary">
            {secondaryLabel}
          </Text>
        </View>
      </View>

      <View
        style={[s.plotArea, { height: plotHeight + 42 }]}
        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
      >
        {/* Tooltip flotante íntegro sobre plotArea completo */}
        {plotWidth > 0 && activeItem ? (
          <View
            pointerEvents="none"
            style={[
              s.tooltip,
              {
                left: tooltipLeft,
                minWidth: tooltipMinWidth,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Text
              variant="caption"
              tabular
              numberOfLines={1}
              style={{ color: colors.text, fontFamily: fonts.semibold }}
            >
              {activeItem.capLabel} · +{formatEur(activeItem.income)} / -
              {formatEur(activeItem.outflow)}
            </Text>
          </View>
        ) : null}

        {[0.35, meanRatio].map((ratio, idx) => (
          <LinearGradient
            key={`dual-h-${idx}`}
            pointerEvents="none"
            colors={['transparent', hGuideColor, hGuideColor, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              s.hGuide,
              {
                bottom: 24 + Math.round(ratio * plotHeight),
              },
            ]}
          />
        ))}

        <View style={[s.columnsRow, { height: plotHeight + 24 }]}>
          {data.map((item, idx) => {
            const isActive = idx === safeIndex;
            const pHeight = Math.max(
              item.income > 0 ? 16 : 6,
              Math.round((Math.max(0, item.income) / maxVal) * (plotHeight - 18)),
            );
            const sHeight = Math.max(
              item.outflow > 0 ? 16 : 6,
              Math.round((Math.max(0, item.outflow) / maxVal) * (plotHeight - 18)),
            );

            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedIndex(idx)}
                accessibilityRole="button"
                accessibilityLabel={`${item.capLabel}: ingresos ${formatEur(item.income)}, pagos ${formatEur(item.outflow)}`}
                style={s.columnBtn}
              >
                <View style={[s.barTrack, { height: plotHeight }]}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['transparent', railColor, railColor, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.vRail}
                  />

                  <View style={s.dualCapsules}>
                    <LinearGradient
                      colors={[
                        isActive
                          ? colors.primary
                          : hexToRgba(colors.primary, 0.48),
                        hexToRgba(colors.primary, 0),
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[s.capsule, { height: pHeight }]}
                    >
                      {isActive ? <View style={s.peakDot} /> : null}
                    </LinearGradient>

                    <LinearGradient
                      colors={[
                        isActive
                          ? colors.chartSecondary
                          : hexToRgba(colors.chartSecondary, 0.45),
                        hexToRgba(colors.chartSecondary, 0),
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[s.capsule, { height: sHeight }]}
                    >
                      {isActive ? <View style={s.peakDot} /> : null}
                    </LinearGradient>
                  </View>
                </View>

                <Text
                  variant="caption"
                  style={{
                    color: isActive ? colors.primary : colors.textMuted,
                    fontFamily: isActive ? fonts.bold : fonts.medium,
                    marginTop: 6,
                  }}
                >
                  {item.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    paddingHorizontal: gutter,
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  plotArea: {
    position: 'relative',
    justifyContent: 'flex-end',
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    zIndex: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  columnBtn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  vRail: {
    position: 'absolute',
    top: 4,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  dualCapsules: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  capsule: {
    width: 14,
    borderRadius: radius.full,
    alignItems: 'center',
    paddingTop: 4,
  },
  peakDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
  },
});
