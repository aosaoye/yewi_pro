import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useConversations, useMe } from '@/api/hooks';
import { getAccessToken, onSessionChange } from '@/lib/session';
import { TabBar } from '@/ui';

export default function TabsLayout() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    void getAccessToken().then((t) => setHasSession(Boolean(t)));
    return onSessionChange((loggedIn) => setHasSession(loggedIn));
  }, []);

  const meQuery = useMe(hasSession);
  const isProUser = Boolean(
    meQuery.data?.roles?.includes('PROFESSIONAL') ||
      meQuery.data?.professionalProfile,
  );

  const conversationsQuery = useConversations(hasSession);
  const unreadChatCount = (conversationsQuery.data ?? []).reduce(
    (sum, conv) => sum + (conv.unreadCount ?? 0),
    0,
  );

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...props}
          badges={{ chat: unreadChatCount }}
          hiddenTabs={hasSession && isProUser ? [] : ['requests']}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="search" options={{ title: 'Buscar' }} />
      <Tabs.Screen name="requests" options={{ title: 'Solicitudes' }} />
      <Tabs.Screen name="chat" options={{ title: 'Mensajes' }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', popToTopOnBlur: true }}
      />
    </Tabs>
  );
}
