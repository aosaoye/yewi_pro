import { router } from 'expo-router';
import React from 'react';
import { AppIcon, type IconName } from './Icon';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { fonts, radius, useTheme } from './theme';

export interface YewiTabBarProps {
  state: {
    index: number;
    routes: readonly {
      key: string;
      name: string;
      state?: { key?: string; index?: number };
    }[];
  };
  emitter: {
    emit: (options: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
  badges?: Partial<Record<string, number>>;
  hiddenTabs?: string[];
}

const TABS: Record<
  string,
  { label: string; icon: IconName }
> = {
  index: { label: 'Inicio', icon: 'home' },
  search: { label: 'Buscar', icon: 'search' },
  requests: { label: 'Solicitudes', icon: 'compass' },
  chat: { label: 'Mensajes', icon: 'message-circle' },
  profile: { label: 'Perfil', icon: 'user' },
};

/** Barra inferior de navegación Yewi alineada con el sistema visual Light/Dark. */
export function TabBar({
  state,
  emitter,
  navigateToTab,
  badges,
  hiddenTabs,
}: YewiTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const { colors } = useTheme();

  const barBg = colors.background;
  const barBorder = colors.divider;
  const inactiveColor = colors.textMuted;
  const activeColor = colors.accent;

  return (
    <View
      style={[
        s.bar,
        {
          backgroundColor: barBg,
          borderTopColor: barBorder,
          paddingBottom: Math.max(bottom, 10),
        },
      ]}
    >
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab || hiddenTabs?.includes(route.name)) return null;
        const focused = state.index === i;
        const color = focused ? activeColor : inactiveColor;
        const badgeCount = badges?.[route.name] ?? 0;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={s.item}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;
              if (!focused) {
                navigateToTab(route.key);
              } else if (
                route.name === 'profile' &&
                route.state?.index !== undefined &&
                route.state.index > 0
              ) {
                if (router.canDismiss()) {
                  router.dismissAll();
                } else {
                  router.navigate('/(tabs)/profile' as never);
                }
              }
            }}
          >
            <View style={s.iconBox}>
              <View style={s.iconWrap}>
                <AppIcon name={tab.icon} size={23} color={color} />
                {badgeCount > 0 ? (
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor: activeColor,
                        borderColor: barBg,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: '#FFFFFF',
                        fontSize: 9,
                        fontFamily: fonts.bold,
                        lineHeight: 11,
                      }}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                variant="caption"
                style={{
                  color,
                  fontFamily: focused ? fonts.bold : fonts.medium,
                  fontSize: 11,
                }}
              >
                {tab.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
