import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMe } from '@/api/hooks';
import { getAccessToken } from '@/lib/session';
import { usePreferencesStore } from '@/lib/stores';
import { NavHeader, Screen, SkeletonRows, space, toast } from '@/ui';

export default function PublishDispatcherScreen() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const activeRole = usePreferencesStore((st) => st.activeRole);
  const meQuery = useMe(Boolean(hasSession));

  useEffect(() => {
    void getAccessToken().then((t) => {
      if (!t) {
        setHasSession(false);
        toast.info('Inicia sesión para publicar en Yewi');
        router.replace('/(auth)/login' as never);
      } else {
        setHasSession(true);
      }
    });
  }, []);

  useEffect(() => {
    if (hasSession !== true) return;
    if (!meQuery.data && !meQuery.isFetched) return;

    const me = meQuery.data;
    const isProMode = Boolean(
      me?.roles?.includes('PROFESSIONAL') ||
        me?.professionalProfile ||
        (!me && activeRole === 'PROFESSIONAL'),
    );
    router.replace((isProMode ? '/publish-gig' : '/create-request') as never);
  }, [hasSession, meQuery.data, meQuery.isFetched, activeRole]);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Publicar" solidSurface />
      <View style={{ paddingTop: space.md }}>
        <SkeletonRows count={3} />
      </View>
    </Screen>
  );
}
