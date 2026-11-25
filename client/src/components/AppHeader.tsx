import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

function HeaderTabItem({
  item,
  isActive,
  expanded,
  activeColor,
  inactiveColor,
  onPress,
}: {
  item: AppHeaderTab;
  isActive: boolean;
  expanded: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const [progress] = useState(() => new Animated.Value(isActive ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isActive, progress]);

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

  return (
    <Pressable
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
            isActive && s.tabTextActive,
            { color: isActive ? activeColor : inactiveColor },
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
 * Topbar limpio y equilibrado en 3 zonas (`Avatar | Título centrado | Acciones`)
 * más barra animada de pestañas al 100% de ancho. Se inserta dentro del scroll.
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
                onPress={() => onSelectTab?.(item.key)}
              />
            ))}
          </View>
        ) : (
          <View style={s.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabsScrollContent}
            >
              {tabs.map((item) => (
                <HeaderTabItem
                  key={item.key}
                  item={item}
                  isActive={activeTab === item.key}
                  expanded={false}
                  activeColor={activeColor}
                  inactiveColor={inactiveColor}
                  onPress={() => onSelectTab?.(item.key)}
                />
              ))}
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
  },
  tabExpandedItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  tabsWrapper: {
    height: 46,
  },
  tabsScrollContent: {
    paddingHorizontal: gutter,
    alignItems: 'center',
    gap: space.lg,
  },
  tabItem: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabIconSlot: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabText: {
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  tabTextActive: {
    fontFamily: fonts.bold,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
  },
});
