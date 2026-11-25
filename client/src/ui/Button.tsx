// src/ui/Button.tsx
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { AppIcon, type IconName } from './Icon';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { radius, useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'light' | 'outline' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label?: string;
  title?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg' | string;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  leftSlot?: ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

export function Button({
  label,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  leftSlot,
  style,
  onPress,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const text = label ?? title ?? '';
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

  const handlePress = (event: GestureResponderEvent) => {
    if (isDisabled || inFlightRef.current || !onPress) return;
    inFlightRef.current = true;
    let isAsync = false;
    try {
      const result = onPress(event) as unknown;
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

  const bgMap: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceSubtle,
    ghost: 'transparent',
    light: colors.surface,
    outline: 'transparent',
    danger: colors.danger,
  };

  const textMap: Record<ButtonVariant, string> = {
    primary: colors.primaryForeground,
    secondary: colors.text,
    ghost: colors.primary,
    light: colors.text,
    outline: colors.text,
    danger: '#FFFFFF',
  };

  const isSmall = size === 'sm';
  const fgColor = textMap[variant] || colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      onPress={onPress ? handlePress : undefined}
      style={({ pressed }) => [
        s.base,
        isSmall ? s.sm : s.md,
        {
          backgroundColor: bgMap[variant],
          borderColor:
            variant === 'outline' || variant === 'secondary'
              ? colors.border
              : 'transparent',
          borderWidth:
            variant === 'outline' || variant === 'secondary' ? 1 : 0,
          opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={fgColor} />
      ) : (
        <View style={s.content}>
          {leftSlot}
          {icon && <AppIcon name={icon} size={isSmall ? 15 : 18} color={fgColor} />}
          <Text
            variant="label"
            style={{
              color: fgColor,
              fontSize: isSmall ? 13 : 15,
              fontWeight: '600',
            }}
          >
            {text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  name: IconName;
  onPress?: PressableProps['onPress'];
  label: string;
  tone?: 'plain' | 'filled' | 'onImage' | 'accent';
  size?: 'sm' | 'md';
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  name,
  onPress,
  label,
  tone = 'plain',
  size = 'md',
  active,
  disabled = false,
  loading = false,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
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

  const handlePress = (event: GestureResponderEvent) => {
    if (isDisabled || inFlightRef.current || !onPress) return;
    inFlightRef.current = true;
    let isAsync = false;
    try {
      const result = onPress(event) as unknown;
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

  const fg =
    tone === 'accent'
      ? '#FFFFFF'
      : active
      ? colors.accent
      : tone === 'onImage'
      ? '#FFFFFF'
      : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      onPress={onPress ? handlePress : undefined}
      hitSlop={8}
      style={({ pressed }) => [
        size === 'sm' ? s.iconSm : s.icon,
        tone === 'filled' && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        tone === 'onImage' && {
          backgroundColor: active ? '#FFFFFF' : 'rgba(0,0,0,0.32)',
        },
        tone === 'accent' && {
          backgroundColor: colors.primary,
        },
        { opacity: isDisabled ? 0.45 : pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <AppIcon name={name} size={size === 'sm' ? 16 : 21} color={fg} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  md: {
    height: 50,
    paddingHorizontal: 22,
  },
  sm: {
    height: 36,
    paddingHorizontal: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSm: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
