import { getClerkInstance } from '@clerk/expo';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView } from 'react-native';
import {
  useLogout,
  useMe,
  useSubscription,
  useWallet,
} from '@/api/hooks';
import { CLERK_PUBLISHABLE_KEY } from '@/config';
import { formatEur } from '@/lib/format';
import {
  ListGroup,
  ListRow,
  NavHeader,
  PillBadge,
  Screen,
  space,
  toast,
  useTheme,
} from '@/ui';

const MODE_LABELS = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
} as const;

/**
 * Pantalla central de Ajustes usando el primitivo único `<ListGroup />` (sin border-bottom en el último elemento).
 */
export default function ProfileSettingsScreen() {
  const { mode } = useTheme();
  const meQuery = useMe();
  const walletQuery = useWallet();
  const subQuery = useSubscription();
  const logoutMutation = useLogout();

  const isPro = Boolean(
    meQuery.data?.isPro ||
      meQuery.data?.professionalProfile?.isPro ||
      subQuery.data?.isPro,
  );
  const availableEur = formatEur(walletQuery.data?.fiatAvailableBalance ?? 0);

  const handleLogout = async () => {
    if (CLERK_PUBLISHABLE_KEY) {
      try {
        await getClerkInstance({
          publishableKey: CLERK_PUBLISHABLE_KEY,
        })?.signOut();
      } catch {
        // noop
      }
    }
    await logoutMutation.mutateAsync();
    toast.info('Sesión cerrada');
    router.replace('/(auth)/login' as never);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Ajustes" solidSurface />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        <ListGroup title="Aspecto">
          <ListRow
            icon="sun"
            plainIcon
            title="Apariencia"
            subtitle={MODE_LABELS[mode]}
            chevron
            onPress={() => router.push('/(tabs)/profile/preferences' as never)}
          />
        </ListGroup>

        <ListGroup title="Cuenta">
          <ListRow
            icon="user"
            plainIcon
            title="Datos personales"
            chevron
            onPress={() => router.push('/(tabs)/profile/account' as never)}
          />
          <ListRow
            icon="shield"
            plainIcon
            title="Biometría y avisos"
            chevron
            onPress={() => router.push('/(tabs)/profile/preferences' as never)}
          />
          <ListRow
            icon="bell"
            plainIcon
            title="Notificaciones"
            chevron
            onPress={() => router.push('/notification-settings' as never)}
          />
          <ListRow
            icon="credit-card"
            plainIcon
            title="Billetera"
            subtitle={availableEur}
            chevron
            onPress={() => router.push('/wallet' as never)}
          />
        </ListGroup>

        <ListGroup title="Profesional">
          <ListRow
            icon="briefcase"
            plainIcon
            title="Perfil profesional"
            chevron
            onPress={() => router.push('/(tabs)/profile/professional' as never)}
          />
          <ListRow
            icon="zap"
            plainIcon
            title="Yewi Pro"
            right={
              <PillBadge
                label={isPro ? 'Activa' : '15,99 €/mes'}
                tone={isPro ? 'success' : 'accent'}
                size="xs"
              />
            }
            chevron
            onPress={() => router.push('/subscription' as never)}
          />
        </ListGroup>

        <ListGroup title="Soporte">
          <ListRow
            icon="help-circle"
            plainIcon
            title="Ayuda"
            chevron
            onPress={() => router.push('/(tabs)/profile/support' as never)}
          />
          <ListRow
            icon="lock"
            plainIcon
            title="Legal"
            chevron
            onPress={() => router.push('/(tabs)/profile/legal' as never)}
          />
        </ListGroup>

        <ListGroup title="Sesión">
          <ListRow
            icon="log-out"
            plainIcon
            title="Cerrar sesión"
            destructive
            chevron={false}
            loading={logoutMutation.isPending}
            onPress={() => void handleLogout()}
          />
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}
