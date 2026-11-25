import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ProfileTab, ProfileTabs } from '@/components/ProfileTabs';
import {
  AppIcon,
  Avatar,
  Cover,
  fonts,
  gutter,
  type IconName,
  PillBadge,
  type PillTone,
  radius,
  Screen,
  SkeletonRows,
  space,
  Text,
  useTheme,
} from '@/ui';

export interface ProfileHeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export interface ProfileStatItem {
  value: string | number;
  label: string;
  accent?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export interface ProfileActionButton {
  label: string;
  variant?: 'outline' | 'primary';
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface ProfileShellProps<TabId extends string> {
  displayName: string;
  stickySubtitle?: string;
  avatarUrl?: string | null;
  coverSeed?: string;
  coverImageUrl?: string | null;
  badge?: { label?: string; icon?: IconName; tone?: PillTone };
  handleLine?: string;
  bio?: string | null;
  metaIcon?: IconName;
  metaText?: string;
  onBack?: () => void;
  headerActions?: ProfileHeaderAction[];
  onAvatarPress?: () => void;
  stats: ProfileStatItem[];
  actions?: ProfileActionButton[];
  afterActions?: React.ReactNode;
  tabs: readonly ProfileTab<TabId>[];
  activeTab: TabId;
  onSelectTab: (tabId: TabId) => void;
  loading?: boolean;
  children: React.ReactNode;
  overlays?: React.ReactNode;
}

/**
 * Estructura canónica de perfil compartida entre "Mi perfil" y "Perfil público profesional".
 * Mantiene portada, cabecera flotante reactiva al scroll, avatar superpuesto,
 * métricas, barra de acciones simétricas y pestañas con expansión animada.
 */
export function ProfileShell<TabId extends string>({
  displayName,
  stickySubtitle,
  avatarUrl,
  coverSeed,
  coverImageUrl,
  badge,
  handleLine,
  bio,
  metaIcon = 'calendar',
  metaText,
  onBack,
  headerActions = [],
  onAvatarPress,
  stats,
  actions = [],
  afterActions,
  tabs,
  activeTab,
  onSelectTab,
  loading = false,
  children,
  overlays,
}: ProfileShellProps<TabId>) {
  const { isDark, colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const [scrollY, setScrollY] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const prevTabRef = useRef<TabId>(activeTab);

  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    fadeAnim.setValue(0.35);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeTab, fadeAnim]);

  const isScrolled = scrollY > 60;
  const circleBgStyle = isScrolled
    ? isDark
      ? s.circleBtnScrolled
      : s.circleBtnScrolledLight
    : s.circleBtnTransparent;
  const circleIconColor = isScrolled ? colors.text : '#FFFFFF';

  const avatarContent = (
    <>
      <Avatar name={displayName} avatarUrl={avatarUrl ?? undefined} size={74} />
      {onAvatarPress ? (
        <View
          style={[
            s.cameraBadge,
            {
              backgroundColor: colors.primary,
              borderColor: colors.background,
            },
          ]}
        >
          <AppIcon name="camera" size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </>
  );

  return (
    <Screen edges={['bottom']}>
      {/* Cabecera flotante sobre portada */}
      <View
        style={[
          s.stickyHeader,
          { paddingTop: Math.max(top, space.sm) },
          isScrolled && {
            backgroundColor: colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              s.circleBtn,
              circleBgStyle,
              { marginRight: space.sm },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <AppIcon name="arrow-left" size={18} color={circleIconColor} />
          </Pressable>
        ) : null}

        <View style={s.stickyTitleWrap}>
          {isScrolled ? (
            <>
              <Text
                variant="heading"
                style={[s.stickyTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {stickySubtitle ? (
                <Text
                  style={[s.stickySubtitle, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {stickySubtitle}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {headerActions.length > 0 ? (
          <View style={s.headerRightActions}>
            {headerActions.map((act) => (
              <Pressable
                key={act.label}
                onPress={act.onPress}
                hitSlop={8}
                style={({ pressed }) => [
                  s.circleBtn,
                  circleBgStyle,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={act.label}
              >
                <AppIcon name={act.icon} size={18} color={circleIconColor} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        {/* Banner de portada */}
        <View
          style={[
            s.coverBanner,
            {
              height: 132 + Math.max(top, 16),
              backgroundColor: isDark ? '#16181C' : colors.primarySoft,
            },
          ]}
        >
          <Cover
            seed={coverSeed || displayName}
            imageUrl={coverImageUrl ?? undefined}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {loading ? (
          <View style={{ paddingTop: space.xl }}>
            <SkeletonRows count={4} />
          </View>
        ) : (
          <>
            {/* Identidad, metadatos, estadísticas y acciones */}
            <View style={s.profileHeaderInfo}>
              {onAvatarPress ? (
                <Pressable
                  onPress={onAvatarPress}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar foto de perfil"
                  style={[
                    s.avatarWrapper,
                    {
                      borderColor: colors.background,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  {avatarContent}
                </Pressable>
              ) : (
                <View
                  style={[
                    s.avatarWrapper,
                    {
                      borderColor: colors.background,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  {avatarContent}
                </View>
              )}

              <View style={s.nameWrap}>
                <View style={s.nameRow}>
                  <Text
                    variant="title"
                    style={[s.profileName, { color: colors.text }]}
                  >
                    {displayName}
                  </Text>
                  {badge ? (
                    badge.icon && !badge.label ? (
                      <AppIcon
                        name={badge.icon}
                        size={20}
                        color={
                          badge.tone === 'success'
                            ? colors.success
                            : colors.primary
                        }
                      />
                    ) : badge.label ? (
                      <PillBadge
                        label={badge.label}
                        icon={badge.icon}
                        tone={badge.tone ?? 'primary'}
                        variant="soft"
                        size="xs"
                      />
                    ) : null
                  ) : null}
                </View>
                {handleLine ? (
                  <Text
                    style={[s.profileHandle, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {handleLine}
                  </Text>
                ) : null}
              </View>

              {bio ? (
                <Text
                  variant="body"
                  tone="secondary"
                  style={s.bioText}
                >
                  {bio}
                </Text>
              ) : null}

              {metaText ? (
                <View style={s.joinedRow}>
                  <AppIcon name={metaIcon} size={14} color={colors.textMuted} />
                  <Text style={[s.joinedText, { color: colors.textMuted }]}>
                    {metaText}
                  </Text>
                </View>
              ) : null}

              {stats.length > 0 ? (
                <View style={s.statsRow}>
                  {stats.map((item) => {
                    const inner = (
                      <>
                        <Text
                          tabular
                          style={[
                            s.statNumber,
                            { color: item.accent ? colors.primary : colors.text },
                          ]}
                        >
                          {item.value}
                        </Text>
                        <Text style={[s.statLabel, { color: colors.textMuted }]}>
                          {item.label}
                        </Text>
                      </>
                    );

                    if (item.onPress) {
                      return (
                        <Pressable
                          key={item.label}
                          onPress={item.onPress}
                          style={s.statItem}
                          accessibilityRole="button"
                          accessibilityLabel={
                            item.accessibilityLabel || item.label
                          }
                        >
                          {inner}
                        </Pressable>
                      );
                    }

                    return (
                      <View key={item.label} style={s.statItem}>
                        {inner}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {actions.length > 0 ? (
                <View style={s.actionsRow}>
                  {actions.map((act) => {
                    const isPrimary = act.variant === 'primary';
                    return (
                      <Pressable
                        key={act.label}
                        onPress={act.onPress}
                        style={({ pressed }) => [
                          s.actionBtn,
                          isPrimary
                            ? {
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                              }
                            : {
                                borderColor: colors.borderStrong,
                              },
                          pressed && { opacity: 0.78 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={act.accessibilityLabel || act.label}
                      >
                        <Text
                          variant="heading"
                          style={[
                            s.actionBtnText,
                            {
                              color: isPrimary
                                ? colors.primaryForeground
                                : colors.text,
                            },
                          ]}
                        >
                          {act.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {afterActions}
            </View>

            {/* Pestañas horizontales de ancho completo */}
            <ProfileTabs
              tabs={tabs}
              activeTab={activeTab}
              onSelectTab={onSelectTab}
            />

            <Animated.View style={{ opacity: fadeAnim }}>
              {children}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {overlays}
    </Screen>
  );
}

const s = StyleSheet.create({
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingBottom: 8,
  },
  stickyTitleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  stickyTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    lineHeight: 21,
  },
  stickySubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnTransparent: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  circleBtnScrolled: {
    backgroundColor: 'transparent',
  },
  circleBtnScrolledLight: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  coverBanner: {
    width: '100%',
  },
  profileHeaderInfo: {
    paddingHorizontal: gutter,
    paddingBottom: 14,
  },
  avatarWrapper: {
    marginTop: -38,
    alignSelf: 'flex-start',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: {
    paddingTop: 10,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  profileName: {
    fontSize: 22,
    fontFamily: fonts.bold,
    lineHeight: 26,
  },
  profileHandle: {
    fontSize: 14.5,
  },
  bioText: {
    paddingTop: 8,
    lineHeight: 21,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
  },
  joinedText: {
    fontSize: 13.5,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingTop: 12,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  statLabel: {
    fontSize: 14.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 14,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
});
