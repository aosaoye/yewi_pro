import React, { useEffect, useRef } from 'react';
import { AppIcon, type IconName } from './Icon';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PillTab, type PillCarouselOption, type PillSize, type PillTone } from './Pill';
import { Text } from './Text';
import { fonts, space, useTheme } from './theme';

export interface TabStripOption<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
}

interface TabLayout {
  x: number;
  width: number;
}

const SLIDE_TIMING = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

function TabStripItem<K extends string>({
  item,
  active,
  variant,
  activeColor,
  inactiveColor,
  onLayout,
  onPress,
}: {
  item: TabStripOption<K>;
  active: boolean;
  variant: 'equal' | 'fitted';
  activeColor: string;
  inactiveColor: string;
  onLayout: (layout: TabLayout) => void;
  onPress: () => void;
}) {
  const activeSV = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    activeSV.value = withTiming(active ? 1 : 0, SLIDE_TIMING);
  }, [active, activeSV]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + activeSV.value * 0.4,
    transform: [{ scale: 0.92 + activeSV.value * 0.08 }],
  }));

  const fg = active ? activeColor : inactiveColor;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        onLayout({ x, width });
      }}
      onPress={onPress}
      style={({ pressed }) => [
        s.tabItem,
        variant === 'equal' ? s.tabEqual : s.tabFitted,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={s.tabContent}>
        {item.icon ? (
          <Animated.View style={[s.tabIconSlot, iconAnimStyle]}>
            <AppIcon name={item.icon} size={15} color={fg} />
          </Animated.View>
        ) : null}
        <Text
          variant="heading"
          numberOfLines={1}
          style={[s.tabText, { color: fg }]}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Barra superior de pestañas a ancho completo (`width: '100%'`), con anchos
 * estables e indicador deslizante 100% GPU en hilo UI (DESIGN_RULES §3 y §8).
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
  const layoutsRef = useRef<Record<string, TabLayout>>({});
  const hasMeasuredRef = useRef(false);

  const indicatorCenterX = useSharedValue(0);
  const indicatorScaleX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  const syncIndicator = (key: K, animate: boolean) => {
    if (key === undefined) return;
    const layout = layoutsRef.current[key];
    if (!layout || layout.width <= 0) return;

    const inset = Math.round(layout.width * 0.16);
    const targetW = Math.max(16, layout.width - inset * 2);
    const targetCenterX = layout.x + inset + targetW / 2;

    if (!animate || !hasMeasuredRef.current) {
      indicatorCenterX.value = targetCenterX;
      indicatorScaleX.value = targetW;
      indicatorOpacity.value = 1;
      hasMeasuredRef.current = true;
    } else {
      indicatorCenterX.value = withTiming(targetCenterX, SLIDE_TIMING);
      indicatorScaleX.value = withTiming(targetW, SLIDE_TIMING);
      indicatorOpacity.value = 1;
    }
  };

  useEffect(() => {
    syncIndicator(value, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorCenterX.value },
      { scaleX: indicatorScaleX.value },
    ],
  }));

  const handleTabLayout = (key: K, layout: TabLayout) => {
    layoutsRef.current[key] = layout;
    if (key === value) {
      syncIndicator(key, hasMeasuredRef.current);
    }
  };

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
          onLayout={(layout) => handleTabLayout(item.key, layout)}
          onPress={() => onChange(item.key)}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          s.indicator,
          { backgroundColor: colors.text },
          indicatorStyle,
        ]}
      />
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
    position: 'relative',
  },
  tabItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 16,
    height: 16,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14.5,
    fontFamily: fonts.semibold,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1,
    height: 2.5,
  },
  segmented: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
