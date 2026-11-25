import React, { useEffect, useState } from 'react';
import { AppIcon, type IconName } from './Icon';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { PillTab, type PillCarouselOption, type PillSize, type PillTone } from './Pill';
import { Text } from './Text';
import { fonts, space, useTheme } from './theme';

export interface TabStripOption<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
}

function TabStripItem<K extends string>({
  item,
  active,
  variant,
  activeColor,
  inactiveColor,
  onPress,
}: {
  item: TabStripOption<K>;
  active: boolean;
  variant: 'equal' | 'fitted';
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const iconWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });
  const iconMarginRight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });
  const iconOpacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.25, 1],
  });
  const iconScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });
  const iconTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });
  const indicatorScaleX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const fg = active ? activeColor : inactiveColor;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      onPress={onPress}
      style={({ pressed }) => [
        s.tabItem,
        variant === 'equal' ? s.tabEqual : s.tabFitted,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={s.tabContent}>
        {item.icon ? (
          <Animated.View
            style={[
              s.tabIconSlot,
              {
                width: iconWidth,
                marginRight: iconMarginRight,
                opacity: iconOpacity,
                transform: [{ scale: iconScale }, { translateX: iconTranslateX }],
              },
            ]}
          >
            <AppIcon name={item.icon} size={15} color={fg} />
          </Animated.View>
        ) : null}
        <Text
          variant="heading"
          numberOfLines={1}
          style={[
            s.tabText,
            active && s.tabTextActive,
            { color: fg },
          ]}
        >
          {item.label}
        </Text>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          s.indicator,
          {
            backgroundColor: activeColor,
            opacity: progress,
            transform: [{ scaleX: indicatorScaleX }],
          },
        ]}
      />
    </Pressable>
  );
}

/**
 * Barra superior de pestañas a ancho completo (`width: '100%'`), con la misma
 * animación y dimensiones que las pestañas de `AppHeader` (DESIGN_RULES §3 y §8).
 */
export function TabStrip<K extends string>({
  options,
  value,
  onChange,
  variant = 'equal',
  style,
}: {
  options: TabStripOption<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: 'equal' | 'fitted';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        s.strip,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          justifyContent: variant === 'fitted' ? 'space-around' : 'flex-start',
        },
        style,
      ]}
    >
      {options.map((item) => (
        <TabStripItem
          key={item.key}
          item={item}
          active={item.key === value}
          variant={variant}
          activeColor={colors.text}
          inactiveColor={colors.textMuted}
          onPress={() => onChange(item.key)}
        />
      ))}
    </View>
  );
}

/**
 * Selector segmentado de píldoras a ancho completo (`width: '100%'`), heredando
 * íntegramente de `PillTab` con cero márgenes externos (DESIGN_RULES §1 y §17).
 */
export function SegmentedPills<K extends string>({
  options,
  value,
  onChange,
  tone = 'contrast',
  size = 'md',
  style,
}: {
  options: PillCarouselOption<K>[];
  value: K;
  onChange: (key: K) => void;
  tone?: PillTone;
  size?: PillSize;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.segmented, style]}>
      {options.map((item) => (
        <PillTab
          key={item.key}
          label={item.label}
          icon={item.icon}
          active={item.key === value}
          tone={tone}
          size={size}
          style={{ flex: 1 }}
          onPress={() => onChange(item.key)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabEqual: {
    flex: 1,
    paddingHorizontal: space.sm,
  },
  tabFitted: {
    paddingHorizontal: space.md,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconSlot: {
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabText: {
    fontSize: 14.5,
    fontFamily: fonts.semibold,
  },
  tabTextActive: {
    fontFamily: fonts.bold,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: '16%',
    right: '16%',
    height: 2.5,
    borderRadius: 2,
  },
  segmented: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
