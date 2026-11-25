import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES_LIST } from '@/lib/categories';
import { usePreferencesStore } from '@/lib/stores';
import {
  AppIcon,
  ChipRow,
  fonts,
  gutter,
  IconButton,
  PillBadge,
  PillButton,
  radius,
  space,
  Text,
  useTheme,
} from '@/ui';

export interface HomeHeaderProps {
  unreadCount?: number;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenSearch: () => void;
  isPro?: boolean;
  canSwitchRole?: boolean;
}

export function HomeHeader({
  unreadCount = 0,
  selectedCategory,
  onSelectCategory,
  onOpenSearch,
  isPro = false,
  canSwitchRole = false,
}: HomeHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const activeRole = usePreferencesStore((s) => s.activeRole);
  const setActiveRole = usePreferencesStore((s) => s.setActiveRole);

  const categoryOptions = useMemo(
    () => [
      { key: '', label: 'Todos' },
      ...CATEGORIES_LIST.map((cat) => ({
        key: cat.name,
        label: cat.name,
      })),
    ],
    [],
  );

  return (
    <View
      style={[
        s.container,
        {
          paddingTop: Math.max(top, space.sm),
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={s.topRow}>
        <View style={s.brandRow}>
          <View
            style={[
              s.logoMark,
              {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Text
              variant="heading"
              style={{ color: colors.primaryForeground, fontSize: 16 }}
            >
              Y
            </Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="title" style={{ color: colors.text, fontSize: 22 }}>
                Yewi
              </Text>
              {isPro ? (
                <PillBadge label="Pro" tone="primary" variant="soft" size="xs" />
              ) : null}
            </View>
            <Text variant="caption" tone="muted">
              {activeRole === 'PROFESSIONAL'
                ? 'Modo Profesional'
                : 'Servicios y Reformas'}
            </Text>
          </View>
        </View>

        <View style={s.actionsRow}>
          {canSwitchRole ? (
            <PillButton
              label={activeRole === 'CLIENT' ? 'Ir a Pro' : 'Cliente'}
              icon={activeRole === 'CLIENT' ? 'briefcase' : 'user'}
              size="md"
              variant="surface"
              tone="contrast"
              onPress={() =>
                setActiveRole(
                  activeRole === 'CLIENT' ? 'PROFESSIONAL' : 'CLIENT',
                )
              }
            />
          ) : null}

          <IconButton
            name={isDark ? 'sun' : 'moon'}
            label="Cambiar tema"
            tone="filled"
            onPress={toggleTheme}
          />

          <View style={{ position: 'relative' }}>
            <IconButton
              name="bell"
              label="Notificaciones"
              tone="filled"
              onPress={() => router.push('/notifications' as never)}
            />
            {unreadCount > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  s.badge,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
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
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Pressable
        onPress={onOpenSearch}
        style={[
          s.searchBox,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <AppIcon name="search" size={16} color={colors.textMuted} />
        <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 14 }}>
          ¿Qué profesional o reforma necesitas hoy?
        </Text>
        <View
          style={[
            s.filterChip,
            { backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <AppIcon name="sliders" size={13} color={colors.primary} />
        </View>
      </Pressable>

      <ChipRow
        options={categoryOptions}
        value={selectedCategory}
        onChange={onSelectCategory}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: space.sm }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  topRow: {
    paddingHorizontal: gutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    marginHorizontal: gutter,
    height: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterChip: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
