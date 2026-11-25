import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon, fonts, type IconName, Text, useTheme } from '@/ui';

export interface ProfileTab<T extends string = string> {
  id: T;
  label: string;
  icon: IconName;
}

const ACTIVE_WEIGHT = 2.1;
const TIMING_CONFIG = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
};

function ProfileTabItem<T extends string>({
  tab,
  index,
  tabCount,
  rowWidthSV,
  fromIdxSV,
  toIdxSV,
  progressSV,
  isActive,
  activeColor,
  inactiveColor,
  onPress,
}: {
  tab: ProfileTab<T>;
  index: number;
  tabCount: number;
  rowWidthSV: SharedValue<number>;
  fromIdxSV: SharedValue<number>;
  toIdxSV: SharedValue<number>;
  progressSV: SharedValue<number>;
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const containerStyle = useAnimatedStyle(() => {
    const rowWidth = rowWidthSV.value;
    if (rowWidth <= 0 || tabCount <= 0) {
      return { width: 0 };
    }
    const totalWeight = tabCount - 1 + ACTIVE_WEIGHT;
    const inactiveW = rowWidth / totalWeight;
    const activeW = (rowWidth * ACTIVE_WEIGHT) / totalWeight;

    const from = fromIdxSV.value;
    const to = toIdxSV.value;
    const p = progressSV.value;

    let width = inactiveW;
    if (from === to) {
      width = index === to ? activeW : inactiveW;
    } else if (index === to) {
      width = interpolate(p, [0, 1], [inactiveW, activeW]);
    } else if (index === from) {
      width = interpolate(p, [0, 1], [activeW, inactiveW]);
    }

    return { width };
  });

  const labelStyle = useAnimatedStyle(() => {
    const from = fromIdxSV.value;
    const to = toIdxSV.value;
    const p = progressSV.value;

    let activeRatio = 0;
    if (from === to) {
      activeRatio = index === to ? 1 : 0;
    } else if (index === to) {
      activeRatio = p;
    } else if (index === from) {
      activeRatio = 1 - p;
    }

    return {
      maxWidth: interpolate(activeRatio, [0, 1], [0, 128]),
      marginLeft: interpolate(activeRatio, [0, 1], [0, 6]),
      opacity: interpolate(activeRatio, [0, 0.35, 1], [0, 0, 1]),
    };
  });

  const underlineStyle = useAnimatedStyle(() => {
    const from = fromIdxSV.value;
    const to = toIdxSV.value;
    const p = progressSV.value;

    let activeRatio = 0;
    if (from === to) {
      activeRatio = index === to ? 1 : 0;
    } else if (index === to) {
      activeRatio = p;
    } else if (index === from) {
      activeRatio = 1 - p;
    }

    return {
      opacity: interpolate(activeRatio, [0, 0.35, 1], [0, 0, 1]),
      transform: [
        { scaleX: interpolate(activeRatio, [0, 0.35, 1], [0.4, 0.4, 1]) },
      ],
    };
  });

  return (
    <Animated.View style={[s.tabButtonFixed, containerStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.tabPressable, pressed && { opacity: 0.72 }]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={tab.label}
      >
        <View style={s.tabInner}>
          <AppIcon
            name={tab.icon}
            size={17}
            color={isActive ? activeColor : inactiveColor}
            style={s.tabIconFixed}
          />
          <Animated.View style={[s.tabLabelClip, labelStyle]}>
            <Text
              variant="heading"
              style={[s.activeTabText, { color: activeColor }]}
              numberOfLines={1}
              ellipsizeMode="clip"
            >
              {tab.label}
            </Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              s.activeTabIndicator,
              { backgroundColor: activeColor },
              underlineStyle,
            ]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Pestañas de ancho completo con expansión animada de icono + etiqueta.
 */
export function ProfileTabs<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
}: {
  tabs: readonly ProfileTab<T>[];
  activeTab: T;
  onSelectTab: (tabId: T) => void;
}) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab),
  );
  const prevIndexRef = useRef(activeIndex);

  const rowWidthSV = useSharedValue(windowWidth);
  const fromIdxSV = useSharedValue(activeIndex);
  const toIdxSV = useSharedValue(activeIndex);
  const progressSV = useSharedValue(1);

  useEffect(() => {
    const prevIdx = prevIndexRef.current;
    if (prevIdx !== activeIndex) {
      fromIdxSV.value = prevIdx;
      toIdxSV.value = activeIndex;
      progressSV.value = 0;
      progressSV.value = withTiming(1, TIMING_CONFIG);
      prevIndexRef.current = activeIndex;
    }
  }, [activeIndex, fromIdxSV, toIdxSV, progressSV]);

  return (
    <View
      style={[
        s.tabsContainerFullWidth,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View
        style={s.tabsRow}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            rowWidthSV.value = w;
          }
        }}
      >
        {tabs.map((tab, index) => (
          <ProfileTabItem
            key={tab.id}
            tab={tab}
            index={index}
            tabCount={tabs.length}
            rowWidthSV={rowWidthSV}
            fromIdxSV={fromIdxSV}
            toIdxSV={toIdxSV}
            progressSV={progressSV}
            isActive={activeTab === tab.id}
            activeColor={colors.text}
            inactiveColor={colors.textMuted}
            onPress={() => onSelectTab(tab.id)}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tabsContainerFullWidth: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tabButtonFixed: {
    flexGrow: 0,
    flexShrink: 0,
    height: 48,
    overflow: 'hidden',
  },
  tabPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: '100%',
    position: 'relative',
  },
  tabIconFixed: {
    flexShrink: 0,
  },
  tabLabelClip: {
    overflow: 'hidden',
    flexShrink: 1,
    justifyContent: 'center',
  },
  activeTabText: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
  },
});
