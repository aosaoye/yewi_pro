import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { AppIcon, type IconName } from './Icon';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { fonts, gutter, radius, space, useTheme } from './theme';

export type PillTone =
  | 'neutral'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warn'
  | 'danger'
  | 'contrast'
  | 'overlay';

export type PillVariant = 'solid' | 'soft' | 'surface' | 'outline';
export type PillSize = 'xs' | 'sm' | 'md' | 'lg';

export interface PillProps {
  label?: string;
  children?: ReactNode;
  icon?: IconName;
  rightIcon?: IconName;
  leftSlot?: ReactNode;
  tone?: PillTone;
  variant?: PillVariant;
  size?: PillSize;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void | Promise<unknown>;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  numberOfLines?: number;
}

const SIZE_METRICS: Record<
  PillSize,
  { minHeight: number; paddingHorizontal: number; paddingVertical: number; fontSize: number; iconSize: number; gap: number }
> = {
  xs: { minHeight: 26, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, iconSize: 12, gap: 5 },
  sm: { minHeight: 36, paddingHorizontal: 15, paddingVertical: 7, fontSize: 13.5, iconSize: 15, gap: 6 },
  md: { minHeight: 42, paddingHorizontal: 18, paddingVertical: 9, fontSize: 14, iconSize: 16, gap: 7 },
  lg: { minHeight: 50, paddingHorizontal: 22, paddingVertical: 12, fontSize: 15, iconSize: 18, gap: 8 },
};

/**
 * Componente base único para todas las píldoras del proyecto (`PillButton`, `PillTab`,
 * `PillBadge`, `Chip` y `Badge`). Garantiza siempre redondeado al 100% (`radius.pill`)
 * y cero márgenes externos por defecto.
 */
export function Pill({
  label,
  children,
  icon,
  rightIcon,
  leftSlot,
  tone = 'neutral',
  variant = 'surface',
  size = 'md',
  active = false,
  disabled = false,
  loading = false,
  onPress,
  style,
  textStyle,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  numberOfLines = 1,
}: PillProps) {
  const { colors } = useTheme();
  const metrics = SIZE_METRICS[size];
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [asyncBusy, setAsyncBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isLoading = Boolean(loading || asyncBusy);
  const isDisabled = Boolean(disabled || isLoading);

  const handlePress = () => {
    if (isDisabled || inFlightRef.current || !onPress) return;
    inFlightRef.current = true;
    let isAsync = false;
    try {
      const result = onPress() as unknown;
      if (
        result !== null &&
        (typeof result === 'object' || typeof result === 'function') &&
        typeof (result as PromiseLike<unknown>).then === 'function'
      ) {
        isAsync = true;
        setAsyncBusy(true);
        void Promise.resolve(result).finally(() => {
          inFlightRef.current = false;
          if (mountedRef.current) {
            setAsyncBusy(false);
          }
        });
      }
    } finally {
      if (!isAsync) {
        inFlightRef.current = false;
      }
    }
  };

  const paletteByTone: Record<
    PillTone,
    { solidBg: string; solidFg: string; softBg: string; softFg: string; border: string }
  > = {
    neutral: {
      solidBg: colors.text,
      solidFg: colors.textInverse,
      softBg: colors.surfaceSubtle,
      softFg: colors.textSecondary,
      border: colors.border,
    },
    contrast: {
      solidBg: colors.text,
      solidFg: colors.textInverse,
      softBg: colors.surface,
      softFg: colors.textSecondary,
      border: colors.border,
    },
    primary: {
      solidBg: colors.primary,
      solidFg: colors.primaryForeground,
      softBg: colors.primarySoft,
      softFg: colors.accent,
      border: colors.primary,
    },
    accent: {
      solidBg: colors.accent,
      solidFg: '#FFFFFF',
      softBg: colors.primarySoft,
      softFg: colors.accent,
      border: colors.accent,
    },
    success: {
      solidBg: colors.success,
      solidFg: '#FFFFFF',
      softBg: colors.successSoft,
      softFg: colors.success,
      border: colors.success,
    },
    warn: {
      solidBg: colors.warning,
      solidFg: '#FFFFFF',
      softBg: colors.warningSoft,
      softFg: colors.warning,
      border: colors.warning,
    },
    danger: {
      solidBg: colors.danger,
      solidFg: '#FFFFFF',
      softBg: colors.dangerSoft,
      softFg: colors.danger,
      border: colors.danger,
    },
    overlay: {
      solidBg: 'rgba(15, 20, 25, 0.78)',
      solidFg: '#FFFFFF',
      softBg: 'rgba(15, 20, 25, 0.78)',
      softFg: '#FFFFFF',
      border: 'rgba(255, 255, 255, 0.22)',
    },
  };

  const token = paletteByTone[tone] ?? paletteByTone.neutral;

  let backgroundColor = colors.surface;
  let borderColor = 'transparent';
  let borderWidth = 0;
  let foregroundColor = colors.text;

  if (variant === 'solid') {
    backgroundColor = token.solidBg;
    foregroundColor = token.solidFg;
  } else if (variant === 'soft') {
    backgroundColor = token.softBg;
    foregroundColor = token.softFg;
  } else if (variant === 'surface') {
    backgroundColor = tone === 'neutral' ? colors.surfaceSubtle : colors.surface;
    borderColor = colors.border;
    borderWidth = 1;
    foregroundColor = tone === 'contrast' || tone === 'neutral' ? colors.textSecondary : token.softFg;
  } else if (variant === 'outline') {
    backgroundColor = 'transparent';
    borderColor = tone === 'neutral' ? colors.border : token.border;
    borderWidth = 1;
    foregroundColor = tone === 'neutral' ? colors.text : token.softFg;
  }

  const inner = isLoading ? (
    <ActivityIndicator size="small" color={foregroundColor} />
  ) : (
    <>
      {leftSlot}
      {icon ? <AppIcon name={icon} size={metrics.iconSize} color={foregroundColor} /> : null}
      {label !== undefined ? (
        <Text
          numberOfLines={numberOfLines}
          style={[
            {
              color: foregroundColor,
              fontSize: metrics.fontSize,
              lineHeight: metrics.fontSize + 4,
              fontFamily: active || variant === 'solid' ? fonts.semibold : fonts.medium,
            },
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
      {children}
      {rightIcon ? <AppIcon name={rightIcon} size={metrics.iconSize} color={foregroundColor} /> : null}
    </>
  );

  const containerStyle: ViewStyle = {
    minHeight: metrics.minHeight,
    paddingHorizontal: metrics.paddingHorizontal,
    paddingVertical: metrics.paddingVertical,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: metrics.gap,
    margin: 0,
    backgroundColor,
    borderColor,
    borderWidth,
  };

  if (!onPress) {
    return (
      <View
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={accessibilityState}
        style={[containerStyle, isDisabled && { opacity: 0.45 }, style]}
      >
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        accessibilityState ?? { disabled: isDisabled, busy: isLoading }
      }
      style={({ pressed }) => [
        containerStyle,
        isDisabled && { opacity: 0.45 },
        pressed && !isDisabled && { opacity: 0.78 },
        style,
      ]}
    >
      {inner}
    </Pressable>
  );
}

/** Botón píldora estándar heredado de `Pill`. */
export function PillButton({
  variant = 'solid',
  tone = 'primary',
  size = 'md',
  ...props
}: PillProps) {
  return (
    <Pill
      accessibilityRole="button"
      variant={variant}
      tone={tone}
      size={size}
      {...props}
    />
  );
}

/** Pestaña / filtro píldora heredado de `Pill`. */
export function PillTab({
  active = false,
  tone = 'contrast',
  size = 'md',
  ...props
}: PillProps) {
  return (
    <Pill
      accessibilityRole="tab"
      accessibilityState={{ selected: !!active }}
      active={active}
      tone={tone}
      variant={active ? 'solid' : 'surface'}
      size={size}
      {...props}
    />
  );
}

/** Etiqueta o badge píldora heredado de `Pill`. */
export function PillBadge({
  variant = 'soft',
  tone = 'neutral',
  size = 'xs',
  ...props
}: PillProps) {
  return <Pill variant={variant} tone={tone} size={size} {...props} />;
}

export interface PillCarouselOption<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
}

/**
 * Carrusel horizontal de píldoras a ancho completo (`width: '100%'`), sin márgenes externos
 * que recorten el primer elemento al iniciar el scroll (estilo Home/Index).
 */
export function PillCarousel<K extends string>({
  options,
  value,
  onChange,
  tone = 'contrast',
  size = 'md',
  fullBleed = false,
  style,
  contentContainerStyle,
}: {
  options: PillCarouselOption<K>[];
  value: K;
  onChange: (key: K) => void;
  tone?: PillTone;
  size?: PillSize;
  fullBleed?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[
        carouselStyles.scroll,
        fullBleed && carouselStyles.fullBleed,
        style,
      ]}
      contentContainerStyle={[
        carouselStyles.content,
        fullBleed && { paddingHorizontal: gutter },
        contentContainerStyle,
      ]}
    >
      {options.map((item) => (
        <PillTab
          key={item.key}
          label={item.label}
          icon={item.icon}
          active={item.key === value}
          tone={tone}
          size={size}
          onPress={() => onChange(item.key)}
        />
      ))}
    </ScrollView>
  );
}

const carouselStyles = StyleSheet.create({
  scroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: 0,
  },
  fullBleed: {
    width: 'auto',
    marginHorizontal: -gutter,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    gap: space.sm,
    alignItems: 'center',
  },
});
