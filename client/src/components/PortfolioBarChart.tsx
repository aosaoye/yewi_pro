import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { computePeriodComparison, hexToRgba } from '@/lib/analytics';
import { formatEur } from '@/lib/format';
import { AppIcon, fonts, gutter, type IconName, radius, space, Text, useTheme } from '@/ui';

export interface BarDatum {
  key: string;
  label: string;
  capLabel: string;
  value: number;
}

export interface PortfolioBarChartProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  plotHeight?: number;
}

/**
 * Gráfico de barras estándar abierto sobre colors.background (sin contenedor card),
 * con guías difuminadas en los extremos, barras cápsula con degradado descendente,
 * punto superior de foco (`peakDot`), tooltip íntegro en plotArea y comparador dinámico.
 */
export function PortfolioBarChart({
  title,
  subtitle,
  data,
  plotHeight = 148,
}: PortfolioBarChartProps) {
  const { colors, isDark } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, data.length - 1),
  );
  const [plotWidth, setPlotWidth] = useState(0);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, data.length - 1));
  const activeItem = data[safeIndex];

  const maxVal = useMemo(() => {
    const rawMax = Math.max(...data.map((d) => Math.max(0, d.value)), 0);
    return rawMax > 0 ? rawMax : 1;
  }, [data]);

  const meanRatio = useMemo(() => {
    if (data.length === 0) return 0;
    const avg =
      data.reduce((acc, d) => acc + Math.max(0, d.value), 0) / data.length;
    return Math.min(0.95, Math.max(0.08, avg / maxVal));
  }, [data, maxVal]);

  const comparison = useMemo(
    () =>
      computePeriodComparison(
        data.map((d) => d.value),
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

  const tooltipMinWidth = 146;
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

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text
            variant="title"
            tabular
            style={{ color: colors.text, fontSize: 20, lineHeight: 24 }}
          >
            {formatEur(activeItem?.value ?? 0)}
          </Text>
          <View style={s.deltaRow}>
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
      </View>

      <View
        style={[s.plotArea, { height: plotHeight + 38 }]}
        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
      >
        {/* Tooltip flotante posicionado sobre todo plotArea sin recortes por columna */}
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
              {activeItem.capLabel} · {formatEur(activeItem.value)}
            </Text>
          </View>
        ) : null}

        {/* Guías horizontales difuminadas en ambos bordes laterales */}
        {[0.35, meanRatio].map((ratio, idx) => (
          <LinearGradient
            key={`h-guide-${idx}`}
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
            const rawHeight = (Math.max(0, item.value) / maxVal) * (plotHeight - 16);
            const barHeight = Math.max(item.value > 0 ? 18 : 8, Math.round(rawHeight));
            const topColor = isActive
              ? colors.primary
              : hexToRgba(colors.primary, 0.45);
            const bottomColor = hexToRgba(colors.primary, isActive ? 0.16 : 0.04);

            return (
              <Pressable
                key={item.key}
                onPress={() => setSelectedIndex(idx)}
                accessibilityRole="button"
                accessibilityLabel={`${item.capLabel}: ${formatEur(item.value)}`}
                style={s.columnBtn}
              >
                <View style={[s.barTrack, { height: plotHeight }]}>
                  {/* Raíl vertical difuminado en ambos extremos */}
                  <LinearGradient
                    pointerEvents="none"
                    colors={['transparent', railColor, railColor, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.vRail}
                  />

                  {/* Cápsula con degradado descendente */}
                  <LinearGradient
                    colors={[topColor, bottomColor]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[s.capsule, { height: barHeight }]}
                  >
                    {isActive ? <View style={s.peakDot} /> : null}
                  </LinearGradient>
                </View>

                <Text
                  variant="caption"
                  style={{
                    color: isActive ? colors.primary : colors.textMuted,
                    fontFamily: isActive ? fonts.bold : fonts.medium,
                    marginTop: 6,
                  }}
                >
                  {item.label}
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
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  capsule: {
    width: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    paddingTop: 5,
  },
  peakDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
  },
});
