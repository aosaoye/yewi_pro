import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useContacts, useConversations, useMe } from '@/api/hooks';
import { AppHeader, type AppHeaderTab } from '@/components/AppHeader';
import { formatRelativeDate } from '@/lib/format';
import { getAccessToken, onSessionChange } from '@/lib/session';
import {
  AppIcon,
  Avatar,
  Divider,
  EmptyState,
  ErrorState,
  gutter,
  PillBadge,
  Screen,
  SkeletonRows,
  space,
  Text,
  useTheme,
} from '@/ui';

const CHAT_TABS: readonly AppHeaderTab[] = [
  { key: 'chats', label: 'Chats', icon: 'message-circle' },
  { key: 'contacts', label: 'Contactos', icon: 'users' },
];

export default function ChatTabScreen() {
  const { colors } = useTheme();
  const [hasSession, setHasSession] = useState(false);
  const [mode, setMode] = useState<'chats' | 'contacts'>('chats');

  useEffect(() => {
    void getAccessToken().then((t) => setHasSession(Boolean(t)));
    return onSessionChange((loggedIn) => setHasSession(loggedIn));
  }, []);

  const meQuery = useMe(hasSession);
  const conversationsQuery = useConversations(hasSession);
  const contactsQuery = useContacts(hasSession && mode === 'contacts');

  const user = meQuery.data;
  const userName =
    user?.profile?.displayName ||
    [user?.profile?.firstName, user?.profile?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Yewi';

  if (!hasSession) {
    return (
      <Screen edges={['bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <AppHeader userName="Yewi" title="Mensajes" />
          <View style={s.centerWrap}>
            <EmptyState
              icon="message-circle"
              title="Tus mensajes"
              message="Inicia sesión para chatear."
              actionLabel="Iniciar sesión"
              onAction={() => router.push('/(auth)/login' as never)}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={
              conversationsQuery.isRefetching || contactsQuery.isRefetching
            }
            onRefresh={() => {
              void conversationsQuery.refetch();
              void contactsQuery.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <AppHeader
          userName={userName}
          avatarUrl={user?.profile?.avatarUrl}
          title="Mensajes"
          tabs={CHAT_TABS}
          activeTab={mode}
          onSelectTab={(k) => setMode(k as 'chats' | 'contacts')}
        />

        {mode === 'chats' ? (
          conversationsQuery.isLoading ? (
            <SkeletonRows count={4} />
          ) : conversationsQuery.isError ? (
            <ErrorState
              error={conversationsQuery.error}
              onRetry={() => void conversationsQuery.refetch()}
            />
          ) : (conversationsQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon="message-square"
              title="Sin chats"
              message="Inicia uno desde Contactos."
              actionLabel="Ver contactos"
              onAction={() => setMode('contacts')}
            />
          ) : (
            (conversationsQuery.data ?? []).map((conv, idx, arr) => {
              const name =
                conv.otherParticipant?.displayName ||
                conv.otherParticipant?.name ||
                'Contacto Yewi';
              const unread = conv.unreadCount ?? 0;

              return (
                <React.Fragment key={conv.id}>
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/conversation?id=${encodeURIComponent(conv.id)}` as never,
                      )
                    }
                    style={({ pressed }) => [
                      s.rowItem,
                      pressed && { opacity: 0.72 },
                    ]}
                  >
                    <Avatar
                      name={name}
                      avatarUrl={conv.otherParticipant?.avatarUrl}
                      size={44}
                    />
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={s.rowTop}>
                        <Text
                          variant="heading"
                          numberOfLines={1}
                          style={{ color: colors.text, flex: 1, fontSize: 16 }}
                        >
                          {name}
                        </Text>
                        <Text variant="caption" tone="muted">
                          {formatRelativeDate(conv.lastMessageAt)}
                        </Text>
                      </View>
                      <Text
                        variant="caption"
                        tone={unread > 0 ? 'default' : 'muted'}
                        numberOfLines={1}
                      >
                        {conv.lastMessage?.content || 'Sin mensajes todavía'}
                      </Text>
                    </View>
                    {unread > 0 ? (
                      <PillBadge
                        label={String(unread)}
                        tone="primary"
                        variant="solid"
                        size="xs"
                      />
                    ) : (
                      <AppIcon
                        name="chevron-right"
                        size={18}
                        color={colors.textMuted}
                      />
                    )}
                  </Pressable>
                  {idx < arr.length - 1 ? <Divider /> : null}
                </React.Fragment>
              );
            })
          )
        ) : contactsQuery.isLoading ? (
          <SkeletonRows count={4} />
        ) : (contactsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon="users"
            title="Sin contactos"
            message="Tus contactos aparecerán aquí."
          />
        ) : (
          (contactsQuery.data ?? []).map((contact, idx, arr) => (
            <React.Fragment key={contact.id}>
              <Pressable
                onPress={() => {
                  const target = contact.conversationId
                    ? `/conversation?id=${encodeURIComponent(contact.conversationId)}`
                    : `/conversation?userId=${encodeURIComponent(contact.id)}`;
                  router.push(target as never);
                }}
                style={({ pressed }) => [
                  s.rowItem,
                  pressed && { opacity: 0.72 },
                ]}
              >
                <Avatar
                  name={contact.displayName}
                  avatarUrl={contact.avatarUrl}
                  size={44}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    variant="heading"
                    style={{ color: colors.text, fontSize: 16 }}
                  >
                    {contact.businessName || contact.displayName}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {contact.city || 'España'}
                    {contact.category ? ` · ${contact.category}` : ''}
                  </Text>
                </View>
                <AppIcon name="send" size={18} color={colors.primary} />
              </Pressable>
              {idx < arr.length - 1 ? <Divider /> : null}
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: gutter,
  },
  list: {
    paddingBottom: space.xxl,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
    paddingVertical: space.md,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
