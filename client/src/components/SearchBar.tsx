import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, Field, gutter, radius, space, Text, useTheme } from '@/ui';

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  onPress?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
};

/**
 * Barra de búsqueda uniforme 100% cápsula basada en el único primitivo `<Field />`.
 */
export function SearchBar({
  value = '',
  onChangeText,
  onPress,
  autoFocus,
  placeholder = 'Buscar...',
}: Props) {
  const { colors } = useTheme();

  if (onPress) {
    return (
      <View style={s.outer}>
        <Pressable
          onPress={onPress}
          accessibilityRole="search"
          accessibilityLabel={placeholder}
          style={({ pressed }) => [
            s.pressBox,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <AppIcon name="search" size={18} color={colors.textMuted} />
          <Text
            variant="body"
            style={[s.placeholderText, { color: colors.inputPlaceholder }]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.outer}>
      <Field
        icon="search"
        clearable
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        containerStyle={{ marginBottom: 0 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  outer: {
    paddingHorizontal: gutter,
    paddingBottom: space.md,
  },
  pressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 18,
    minHeight: 50,
  },
  placeholderText: {
    flex: 1,
    fontSize: 16,
  },
});
