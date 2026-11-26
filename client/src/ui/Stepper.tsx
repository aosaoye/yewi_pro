import React, { Fragment } from 'react';
import { AppIcon } from './Icon';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { fonts, gutter, radius, space, useTheme } from './theme';

export type StepItem = {
  title: string;
  subtitle?: string;
};

type Props = {
  steps: StepItem[];
  current: number;
  onSelect?: (index: number) => void;
};

/**
 * Stepper progresivo reactivo al tema (estilo Google / Gmail) a ancho completo:
 * muestra barra lineal proporcional + nodos conectados y etiquetas claras.
 */
export function Stepper({ steps, current, onSelect }: Props) {
  const { colors } = useTheme();
  const safeTotal = Math.max(1, steps.length);
  const clamped = Math.max(0, Math.min(current, safeTotal - 1));

  return (
    <View
      style={[
        s.wrap,
        {
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Fila de círculos distribuidos al 100% del ancho */}
      <View style={s.trackRow}>
        {steps.map((step, i) => {
          const active = i === clamped;
          const done = i < clamped;
          const clickable = Boolean(onSelect && i <= clamped);

          return (
            <Fragment key={step.title}>
              <Pressable
                disabled={!clickable}
                onPress={() => onSelect?.(i)}
                hitSlop={10}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Paso ${i + 1}: ${step.title}`}
                style={[
                  s.badge,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                  active && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                  done && {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
              >
                {done ? (
                  <AppIcon name="check" size={14} color={colors.primary} />
                ) : (
                  <Text
                    variant="caption"
                    style={{
                      fontFamily: fonts.bold,
                      color: active ? colors.primaryForeground : colors.textMuted,
                    }}
                  >
                    {i + 1}
                  </Text>
                )}
              </Pressable>

              {i < steps.length - 1 && (
                <View
                  style={[
                    s.line,
                    { backgroundColor: colors.border },
                    done && { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </Fragment>
          );
        })}
      </View>

      {/* Fila inferior de etiquetas */}
      <View style={s.labelsRow}>
        {steps.map((step, i) => {
          const active = i === clamped;
          const done = i < clamped;
          const clickable = Boolean(onSelect && i <= clamped);
          const align =
            i === 0 ? 'flex-start' : i === steps.length - 1 ? 'flex-end' : 'center';
          const textAlign =
            i === 0 ? 'left' : i === steps.length - 1 ? 'right' : 'center';

          return (
            <Pressable
              key={step.title}
              disabled={!clickable}
              onPress={() => onSelect?.(i)}
              style={[s.labelCell, { alignItems: align }]}
            >
              <Text
                variant="caption"
                numberOfLines={1}
                style={{
                  textAlign,
                  fontFamily: active || done ? fonts.bold : fonts.medium,
                  color: active
                    ? colors.text
                    : done
                      ? colors.primary
                      : colors.textMuted,
                }}
              >
                {step.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  trackRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: space.xs,
    borderRadius: 1,
  },
  labelsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelCell: {
    flex: 1,
  },
});
