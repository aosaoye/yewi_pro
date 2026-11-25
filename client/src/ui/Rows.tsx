import React, { type ReactNode } from 'react';
import { AppIcon, type IconName } from './Icon';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { fonts, gutter, space, useTheme } from './theme';

type RowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  left?: ReactNode;
  plainIcon?: boolean;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
  loading?: boolean;
};

/** Fila genérica de lista abierta sobre `colors.background` con icono, subtítulo y chevron. */
export function ListRow({
  title,
  subtitle,
  icon,
  left,
  plainIcon = false,
  right,
  onPress,
  chevron,
  destructive,
  tone = 'default',
  disabled = false,
  loading = false,
}: RowProps) {
  const { colors } = useTheme();
  const resolvedTone = destructive ? 'danger' : tone;
  const fgColor =
    resolvedTone === 'danger'
      ? colors.danger
      : resolvedTone === 'accent'
        ? colors.accent
        : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled || loading}
      style={({ pressed }) => [
        s.row,
        disabled && !loading && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={
        onPress ? { disabled: disabled || loading, busy: loading } : undefined
      }
    >
      {left ? (
        left
      ) : icon ? (
        <View
          style={[
            plainIcon ? s.iconPlain : s.iconWrap,
            !plainIcon && { backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <AppIcon name={icon} size={20} color={fgColor} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text
          variant="heading"
          style={{ color: fgColor, fontSize: 15.5, lineHeight: 21 }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            tone="muted"
            style={{ marginTop: 2 }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {loading ? <ActivityIndicator size="small" color={fgColor} /> : right}
      {!loading && (chevron ?? Boolean(onPress)) ? (
        <AppIcon name="chevron-right" size={20} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.divider,
      }}
    />
  );
}

/**
 * Contenedor estándar heredable para secciones de listas (Ajustes, Legal, Soporte, Perfil, Sheets).
 * Inserta `<Divider />` únicamente ENTRE hijos consecutivos — nunca en el último elemento (`last-child`).
 */
export function ListGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <View>
      {title ? (
        <Text style={[s.groupTitle, { color: colors.textMuted }]}>{title}</Text>
      ) : null}
      {items.map((child, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 ? <Divider /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  groupTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    paddingHorizontal: gutter,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: gutter,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlain: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
