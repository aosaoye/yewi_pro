import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from '@/api/hooks';
import { notificationsApi } from '@/api/services';
import { formatRelativeDate } from '@/lib/format';
import { queryClient } from '@/lib/queryClient';
import {
  AppIcon,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  gutter,
  IconButton,
  NavHeader,
  PillBadge,
  PillButton,
  radius,
  Screen,
  SkeletonRows,
  space,
  TabStrip,
  Text,
  toast,
  useTheme,
} from '@/ui';

const NOTIF_TABS = [
  { key: 'all' as const, label: 'Todas', icon: 'bell' as const },
  { key: 'unread' as const, label: 'Sin leer', icon: 'circle' as const },
];

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const notifQuery = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const items = useMemo(() => {
    const list = notifQuery.data ?? [];
    if (tab === 'unread') return list.filter((item) => !item.isRead);
    return list;
  }, [notifQuery.data, tab]);

  const handleClearAll = async () => {
    try {
      await notificationsApi.clearAll();
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.info('Notificaciones limpiadas');
    } catch {
      toast.error('No se pudieron eliminar');
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader
        title="Notificaciones"
        right={
          <View style={s.headerRight}>
            {(notifQuery.data?.length ?? 0) > 0 ? (
              <PillButton
                size="md"
                variant="soft"
                tone="primary"
                label="Leer todo"
                loading={markAllRead.isPending}
                onPress={() => void markAllRead.mutateAsync()}
              />
            ) : null}
            <IconButton
              name="settings"
              label="Ajustes de notificaciones"
              tone="plain"
              onPress={() => router.push('/notification-settings' as never)}
            />
          </View>
        }
      />

      <TabStrip options={NOTIF_TABS} value={tab} onChange={setTab} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={notifQuery.isRefetching}
            onRefresh={() => void notifQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {notifQuery.isLoading ? (
          <SkeletonRows count={4} />
        ) : notifQuery.isError ? (
          <ErrorState
            error={notifQuery.error}
            onRetry={() => void notifQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="bell-off"
            title="Todo al día"
            message={
              tab === 'unread'
                ? 'No tienes notificaciones pendientes por leer.'
                : 'No tienes notificaciones pendientes.'
            }
          />
        ) : (
          <>
            {items.map((item, idx) => (
              <React.Fragment key={item.id}>
                <Pressable
                  onPress={async () => {
                    if (!item.isRead) {
                      await notificationsApi.markRead(item.id);
                      void queryClient.invalidateQueries({
                        queryKey: ['notifications'],
                      });
                    }
                    if (item.link) router.push(item.link as never);
                  }}
                  style={({ pressed }) => [
                    s.rowItem,
                    !item.isRead && { backgroundColor: colors.primarySoft },
                    pressed && { opacity: 0.78 },
                  ]}
                >
                  <View
                    style={[
                      s.iconCircle,
                      {
                        backgroundColor: item.isRead
                          ? colors.surfaceSubtle
                          : colors.surface,
                      },
                    ]}
                  >
                    <AppIcon
                      name="bell"
                      size={18}
                      color={item.isRead ? colors.textMuted : colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.rowTop}>
                      <Text
                        variant="heading"
                        style={{ color: colors.text, flex: 1, fontSize: 15 }}
                      >
                        {item.title}
                      </Text>
                      {!item.isRead ? (
                        <PillBadge label="Nueva" tone="primary" size="xs" />
                      ) : null}
                    </View>
                    <Text variant="body" tone="secondary" style={{ fontSize: 14 }}>
                      {item.message}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {formatRelativeDate(item.createdAt)}
                    </Text>
                  </View>
                </Pressable>
                {idx < items.length - 1 ? <Divider /> : null}
              </React.Fragment>
            ))}

            <View style={{ paddingHorizontal: gutter, paddingTop: space.lg }}>
              <Button
                variant="secondary"
                title="Vaciar historial de notificaciones"
                onPress={handleClearAll}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
