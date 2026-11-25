// src/ui/Field.tsx
import React, { ComponentRef, forwardRef, ReactNode, useRef, useState } from 'react';
import { AppIcon, type IconName } from './Icon';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useFormScroll } from './FormScroll';
import { Text } from './Text';
import { fonts, radius, useTheme } from './theme';

export interface FieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  secure?: boolean;
  valid?: boolean;
  icon?: IconName;
  hideIcon?: boolean;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  clearable?: boolean;
  leftSlot?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  boxStyle?: StyleProp<ViewStyle>;
}

/** Campo de texto unificado con icono y cápsula redondeada al 100%, reactivo al tema actual (Light / Dark). */
export const Field = forwardRef<ComponentRef<typeof TextInput>, FieldProps>(function Field(
  {
    label,
    error,
    hint,
    secure,
    valid,
    icon,
    hideIcon,
    rightIcon,
    onRightIconPress,
    clearable,
    leftSlot,
    containerStyle,
    boxStyle,
    multiline,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secure));
  const wrapRef = useRef<ComponentRef<typeof View>>(null);
  const formScroll = useFormScroll();

  const resolvedIcon: IconName =
    icon ?? (multiline ? 'align-left' : secure ? 'lock' : 'edit-3');

  const scrollIntoView = () => {
    if (!formScroll || !wrapRef.current) return;
    wrapRef.current.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      if (typeof y === 'number' && typeof h === 'number') {
        formScroll.ensureVisible(y, h);
      }
    });
  };

  return (
    <View
      ref={wrapRef}
      collapsable={false}
      style={[{ gap: 6, marginBottom: 12 }, containerStyle]}
    >
      {label ? (
        <Text variant="label" style={{ color: colors.text, fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          s.box,
          multiline
            ? [
                s.boxMultiline,
                error
                  ? {
                      borderBottomWidth: 1.5,
                      borderBottomColor: colors.danger,
                      paddingBottom: 6,
                    }
                  : null,
              ]
            : {
                backgroundColor: colors.inputBackground,
                borderWidth: error || focused ? 1.5 : 1,
                borderColor: error
                  ? colors.danger
                  : focused
                  ? colors.primary
                  : valid
                  ? colors.success
                  : colors.inputBorder,
              },
          boxStyle,
        ]}
      >
        {!hideIcon && !multiline ? (
          <AppIcon
            name={resolvedIcon}
            size={18}
            color={error ? colors.danger : focused ? colors.primary : colors.textMuted}
          />
        ) : null}
        {leftSlot}
        <TextInput
          ref={ref}
          {...rest}
          multiline={multiline}
          secureTextEntry={hidden}
          placeholderTextColor={colors.inputPlaceholder}
          selectionColor={colors.primary}
          onFocus={(e) => {
            setFocused(true);
            scrollIntoView();
            setTimeout(scrollIntoView, 220);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label || rest.placeholder}
          style={[
            s.input,
            { color: colors.text },
            multiline && s.multiline,
            style,
          ]}
        />

        {clearable && typeof rest.value === 'string' && rest.value.length > 0 && !secure ? (
          <Pressable
            onPress={() => rest.onChangeText?.('')}
            hitSlop={10}
            accessibilityLabel="Limpiar campo"
          >
            <AppIcon name="x-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {rightIcon && !secure ? (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={10}
          >
            <AppIcon name={rightIcon} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <AppIcon
              name={hidden ? 'eye' : 'eye-off'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={s.errorRow}>
          <AppIcon name="alert-circle" size={14} color={colors.danger} />
          <Text variant="caption" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 18,
    minHeight: 50,
  },
  boxMultiline: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    alignItems: 'flex-start',
    minHeight: 112,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
    fontSize: 17,
    lineHeight: 24,
    paddingTop: 4,
    paddingVertical: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
});
