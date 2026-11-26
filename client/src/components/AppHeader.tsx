import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon, Avatar, fonts, gutter, type IconName, space, Text, useTheme } from '@/ui';

export interface AppHeaderTab {
  key: string;
  label: string;
  icon?: IconName;
}

export interface AppHeaderAction {
  icon: IconName;
  label: string;
  badgeCount?: number;
  onPress: () => void;
}

interface AppHeaderProps {
  userName?: string;
  avatarUrl?: string | null;
  title?: string;
  tabs?: readonly AppHeaderTab[];
  activeTab?: string;
  onSelectTab?: (key: string) => void;
  onPressAdd?: () => void;
  addLabel?: string;
  actions?: AppHeaderAction[];
  showSettings?: boolean;
  insetTop?: boolean;
}

interface TabLayout {
  x: number;
  width: number;
}

const SLIDE_TIMING = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

function HeaderTabItem({
  item,
  isActive,
  expanded,
  activeColor,
  inactiveColor,
  onLayout,
  onPress,
}: {
  item: AppHeaderTab;
  isActive: boolean;
  expanded: boolean;
  activeColor: string;
  inactiveColor: string;
  onLayout: (layout: TabLayout) => void;
  onPress: () => void;
}) {
  const activeSV = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeSV.value = withTiming(isActive ? 1 : 0, SLIDE_TIMING);
  }, [isActive, activeSV]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + activeSV.value * 0.4,
    transform: [{ scale: 0.92 + activeSV.value * 0.08 }],
  }));

  return (
    <Pressable
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        onLayout({ x, width });
      }}
      onPress={onPress}
      style={({ pressed }) => [
        expanded ? s.tabExpandedItem : s.tabItem,
        pressed && { opacity: 0.72 },
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      <View style={s.tabLabelRow}>
        {item.icon ? (
          <Animated.View style={[s.tabIconSlot, iconAnimStyle]}>
            <AppIcon
              name={item.icon}
              size={15}
              color={isActive ? activeColor : inactiveColor}
            />
          </Animated.View>
        ) : null}
        <Text
          variant="heading"
          numberOfLines={1}
          style={[
            s.tabText,
            { color: isActive ? activeColor : inactiveColor },
          ]}
        >
          {item.label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Topbar limpio y equilibrado en 3 zonas (`Avatar | Título centrado | Acciones`)
 * más barra animada de pestañas al 100% de ancho con indicador deslizante 100% GPU.
 */
export function AppHeader({
  userName = 'Yewi',
  avatarUrl,
  title = 'Yewi',
  tabs,
  activeTab,
  onSelectTab,
  onPressAdd,
  addLabel = 'Publicar',
  actions,
  showSettings = false,
  insetTop = true,
}: AppHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  const activeColor = colors.text;
  const inactiveColor = colors.textMuted;
  const hasTabs = Boolean(tabs && tabs.length > 0);
  const isFewTabs = Boolean(tabs && tabs.length <= 3);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const layoutsRef = useRef<Record<string, TabLayout>>({});
  const scrollWidthRef = useRef(0);
  const hasMeasuredRef = useRef(false);

  const indicatorCenterX = useSharedValue(0);
  const indicatorScaleX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  const syncIndicator = (key: string | undefined, animate: boolean) => {
    if (key === undefined) return;
    const layout = layoutsRef.current[key];
    if (!layout || layout.width <= 0) return;

    const inset = isFewTabs ? Math.round(layout.width * 0.16) : 4;
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

    if (!isFewTabs && scrollRef.current && scrollWidthRef.current > 0) {
      const centerOffset = layout.x + layout.width / 2 - scrollWidthRef.current / 2;
      scrollRef.current.scrollTo({ x: Math.max(0, centerOffset), animated: animate });
    }
  };

  useEffect(() => {
    syncIndicator(activeTab, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isFewTabs, tabs?.length]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorCenterX.value },
      { scaleX: indicatorScaleX.value },
    ],
  }));

  const rightActions: AppHeaderAction[] = actions
    ? actions
    : [
        ...(onPressAdd
          ? [{ icon: 'plus' as const, label: addLabel, onPress: onPressAdd }]
          : []),
        ...(showSettings
          ? [
              {
                icon: 'settings' as const,
                label: 'Ajustes',
                onPress: () => router.push('/(tabs)/profile/settings' as never),
              },
            ]
          : []),
      ];

  const handleTabLayout = (key: string, layout: TabLayout) => {
    layoutsRef.current[key] = layout;
    if (key === activeTab) {
      syncIndicator(key, hasMeasuredRef.current);
    }
  };

  return (
    <View
      style={[
        s.container,
        {
          paddingTop: insetTop ? Math.max(top, space.sm) : space.xs,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={s.topBar}>
        <Pressable
          onPress={() => router.navigate('/(tabs)/profile' as never)}
          accessibilityRole="button"
          accessibilityLabel="Ver mi perfil"
          hitSlop={8}
          style={({ pressed }) => [s.avatarBtn, pressed && { opacity: 0.75 }]}
        >
          <Avatar name={userName} avatarUrl={avatarUrl ?? undefined} size={34} />
        </Pressable>

        <View pointerEvents="none" style={s.centerTitleWrap}>
          <Text numberOfLines={1} style={[s.centerTitle, { color: colors.text }]}>
            {title}
          </Text>
        </View>

        <View style={s.centerSpacer} />

        <View style={s.topBarActions}>
          {rightActions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              hitSlop={8}
              style={({ pressed }) => [s.topBarBtn, pressed && { opacity: 0.65 }]}
            >
              <AppIcon name={action.icon} size={20} color={colors.text} />
              {action.badgeCount && action.badgeCount > 0 ? (
                <View
                  style={[
                    s.actionDot,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.background,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {hasTabs && tabs ? (
        isFewTabs ? (
          <View style={s.fullWidthTabsRow}>
            {tabs.map((item) => (
              <HeaderTabItem
                key={item.key}
                item={item}
                isActive={activeTab === item.key}
                expanded
                activeColor={activeColor}
                inactiveColor={inactiveColor}
                onLayout={(layout) => handleTabLayout(item.key, layout)}
                onPress={() => onSelectTab?.(item.key)}
              />
            ))}
            <Animated.View
              pointerEvents="none"
              style={[
                s.indicator,
                { backgroundColor: activeColor },
                indicatorStyle,
              ]}
            />
          </View>
        ) : (
          <View
            style={s.tabsWrapper}
            onLayout={(e) => {
              scrollWidthRef.current = e.nativeEvent.layout.width;
            }}
          >
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabsScrollContent}
            >
              <View style={s.tabsScrollTrack}>
                {tabs.map((item) => (
                  <HeaderTabItem
                    key={item.key}
                    item={item}
                    isActive={activeTab === item.key}
                    expanded={false}
                    activeColor={activeColor}
                    inactiveColor={inactiveColor}
                    onLayout={(layout) => handleTabLayout(item.key, layout)}
                    onPress={() => onSelectTab?.(item.key)}
                  />
                ))}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.indicator,
                    { backgroundColor: activeColor },
                    indicatorStyle,
                  ]}
                />
              </View>
            </ScrollView>
          </View>
        )
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    position: 'relative',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitleWrap: {
    position: 'absolute',
    left: 56,
    right: 96,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.bold,
    letterSpacing: -0.4,
  },
  centerSpacer: {
    flex: 1,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  actionDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  fullWidthTabsRow: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: space.sm,
    position: 'relative',
  },
  tabExpandedItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabsWrapper: {
    height: 46,
  },
  tabsScrollContent: {
    paddingHorizontal: gutter,
  },
  tabsScrollTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    height: 46,
    position: 'relative',
  },
  tabItem: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabIconSlot: {
    width: 16,
    height: 18,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 1,
    height: 2.5,
  },
});
