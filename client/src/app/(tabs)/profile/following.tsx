import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useMe, useProfessionals } from '@/api/hooks';
import { FollowProRow } from '@/components/YewiCards';
import { isOwnProfessional } from '@/lib/format';
import { useFavoritesStore } from '@/lib/stores';
import {
  EmptyState,
  ListGroup,
  NavHeader,
  Screen,
  SkeletonRows,
  space,
  TabStrip,
} from '@/ui';

type NetworkTab = 'following' | 'followers';

const NETWORK_TABS = [
  { key: 'following' as const, label: 'Siguiendo' },
  { key: 'followers' as const, label: 'Seguidores' },
];

export default function ProfileFollowingScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tabOverride, setTabOverride] = useState<NetworkTab | null>(null);
  const activeTab: NetworkTab =
    tabOverride ?? (params.tab === 'followers' ? 'followers' : 'following');

  const meQuery = useMe();
  const prosQuery = useProfessionals({ limit: 50 });
  const savedProIds = useFavoritesStore((st) => st.savedProIds);
  const togglePro = useFavoritesStore((st) => st.togglePro);

  const me = meQuery.data;
  const fullName =
    me?.profile?.displayName ||
    [me?.profile?.firstName, me?.profile?.lastName].filter(Boolean).join(' ') ||
    me?.email?.split('@')[0] ||
    'Perfil';

  const allPros = prosQuery.data?.items ?? [];
  const followedPros = allPros.filter(
    (pro) => savedProIds.includes(pro.id) && !isOwnProfessional(pro, me),
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title={fullName} solidSurface />
      <TabStrip
        options={NETWORK_TABS}
        value={activeTab}
        onChange={setTabOverride}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        {activeTab === 'following' ? (
          prosQuery.isLoading ? (
            <SkeletonRows count={4} />
          ) : followedPros.length > 0 ? (
            <ListGroup>
              {followedPros.map((pro) => (
                <FollowProRow
                  key={pro.id}
                  pro={pro}
                  following={savedProIds.includes(pro.id)}
                  onToggleFollow={() => togglePro(pro.id)}
                  onPress={() =>
                    router.push(
                      `/professional-profile?id=${encodeURIComponent(pro.id)}` as never,
                    )
                  }
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState
              icon="users"
              title="Aún no sigues a nadie"
              actionLabel="Explorar profesionales"
              onAction={() => router.push('/(tabs)/search?tab=pros' as never)}
            />
          )
        ) : (
          <EmptyState
            icon="user"
            title="Sin seguidores todavía"
            message="Cuando otros usuarios te sigan, aparecerán aquí."
          />
        )}
      </ScrollView>
    </Screen>
  );
}
