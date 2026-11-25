// src/ui/Chip.tsx
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { PillCarousel, PillTab, type PillCarouselOption } from './Pill';

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return <PillTab label={label} active={!!active} onPress={onPress} tone="contrast" size="md" />;
}

/** Fila horizontal de chips full-width heredada directamente de `PillCarousel`. */
export function ChipRow<K extends string>({
  options,
  value,
  onChange,
  fullBleed = false,
  style,
  contentContainerStyle,
}: {
  options: PillCarouselOption<K>[];
  value: K;
  onChange: (k: K) => void;
  fullBleed?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <PillCarousel
      options={options}
      value={value}
      onChange={onChange}
      tone="contrast"
      size="md"
      fullBleed={fullBleed}
      style={style}
      contentContainerStyle={contentContainerStyle}
    />
  );
}
