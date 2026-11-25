import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type NotificationSettingsValues,
  useNotificationSettingsStore,
} from '@/lib/stores';
import {
  AppIcon,
  CustomSwitch,
  Divider,
  gutter,
  IconButton,
  ListGroup,
  ListRow,
  NavHeader,
  Screen,
  Sheet,
  space,
  Text,
  useTheme,
} from '@/ui';

type NotifSettingsView = 'menu' | 'filters' | 'preferences';
type ModeFieldKey =
  | 'followedPostsMode'
  | 'mentionsMode'
  | 'repostsMode'
  | 'likesMode';

type BooleanFieldKey = {
  [K in keyof NotificationSettingsValues]: NotificationSettingsValues[K] extends boolean
    ? K
    : never;
}[keyof NotificationSettingsValues];

interface SwitchRowDef {
  key: BooleanFieldKey;
  title: string;
}

const FILTER_ROWS: readonly SwitchRowDef[] = [
  { key: 'muteNotFollowing', title: 'A las que no sigues' },
  { key: 'muteNotFollowedBy', title: 'Que no te siguen' },
  { key: 'muteNewAccounts', title: 'Cuya cuenta es nueva' },
  {
    key: 'muteDefaultAvatar',
    title: 'Que aún usan la foto de perfil predeterminada',
  },
  {
    key: 'muteUnverifiedEmail',
    title: 'Que no confirmaron su correo electrónico',
  },
  {
    key: 'muteUnverifiedPhone',
    title: 'Que no confirmaron su número de teléfono',
  },
];

const INTERACTION_MODE_ROWS: readonly { key: ModeFieldKey; title: string }[] = [
  { key: 'mentionsMode', title: 'Menciones y respuestas' },
  { key: 'repostsMode', title: 'Reposts' },
  { key: 'likesMode', title: 'Me gusta' },
];

const RELATION_SWITCH_ROWS: readonly SwitchRowDef[] = [
  { key: 'photoTags', title: 'Etiquetas de fotos' },
  { key: 'moments', title: 'Momentos' },
];

const FOLLOWER_SWITCH_ROWS: readonly SwitchRowDef[] = [
  { key: 'newFollowers', title: 'Nuevos seguidores' },
  { key: 'contactJoins', title: 'Un contacto se une a Yewi' },
];

const RECOMMENDATION_SWITCH_ROWS: readonly SwitchRowDef[] = [
  { key: 'recTopics', title: 'Temas' },
  { key: 'recGeneral', title: 'Recomendaciones' },
];

const NEWS_SWITCH_ROWS: readonly SwitchRowDef[] = [
  { key: 'newFeatures', title: 'Presentación de funciones nuevas' },
];

const SHEET_META: Record<
  ModeFieldKey,
  { title: string; options: readonly string[] }
> = {
  followedPostsMode: {
    title: 'Posts de las personas que sigues',
    options: ['Activado', 'Solo destacados', 'Desactivado'],
  },
  mentionsMode: {
    title: 'Menciones y respuestas',
    options: ['Activado', 'De personas que sigues', 'Desactivado'],
  },
  repostsMode: {
    title: 'Reposts',
    options: ['Activado', 'De personas que sigues', 'Desactivado'],
  },
  likesMode: {
    title: 'Me gusta',
    options: ['Activado', 'De personas que sigues', 'Desactivado'],
  },
};

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [view, setView] = useState<NotifSettingsView>('menu');
  const [activeSheet, setActiveSheet] = useState<ModeFieldKey | null>(null);

  const settings = useNotificationSettingsStore();

  const renderSwitchRows = (rows: readonly SwitchRowDef[]) =>
    rows.map((row) => {
      const checked = settings[row.key];
      return (
        <ListRow
          key={row.key}
          title={row.title}
          chevron={false}
          right={
            <CustomSwitch
              value={checked}
              onValueChange={(next) => settings.setSetting(row.key, next)}
            />
          }
          onPress={() => settings.setSetting(row.key, !checked)}
        />
      );
    });

  const activeMeta = activeSheet ? SHEET_META[activeSheet] : null;

  return (
    <Screen edges={['top', 'bottom']}>
      {view === 'menu' ? (
        <>
          <NavHeader title="Notificaciones" solidSurface />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: space.xxxl }}
          >
            <ListGroup>
              <ListRow
                icon="sliders"
                plainIcon
                title="Filtros"
                chevron
                onPress={() => setView('filters')}
              />
              <ListRow
                icon="bell"
                plainIcon
                title="Preferencias"
                chevron
                onPress={() => setView('preferences')}
              />
            </ListGroup>
          </ScrollView>
        </>
      ) : view === 'filters' ? (
        <>
          <NavHeader
            title="Filtros"
            solidSurface
            onBack={() => {
              setActiveSheet(null);
              setView('menu');
            }}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: space.xxxl }}
          >
            <ListGroup title="Silencia notificaciones de personas">
              {renderSwitchRows(FILTER_ROWS)}
            </ListGroup>
          </ScrollView>
        </>
      ) : (
        <>
          <NavHeader
            title="Preferencias"
            solidSurface
            onBack={() => {
              setActiveSheet(null);
              setView('menu');
            }}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: space.xxxl }}
          >
            <ListGroup title="Posts de las personas que sigues">
              <ListRow
                title="Posts"
                right={
                  settings.followedPostsMode !== 'Activado' ? (
                    <Text variant="caption" tone="muted">
                      {settings.followedPostsMode}
                    </Text>
                  ) : undefined
                }
                chevron
                onPress={() => setActiveSheet('followedPostsMode')}
              />
            </ListGroup>

            <Divider />

            <ListGroup title="En relación contigo y con tus posts">
              {INTERACTION_MODE_ROWS.map((row) => (
                <ListRow
                  key={row.key}
                  title={row.title}
                  chevron={false}
                  right={
                    <View style={s.moreValue}>
                      <Text variant="body" tone="muted">
                        {settings[row.key]}
                      </Text>
                      <AppIcon
                        name="more-vertical"
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  }
                  onPress={() => setActiveSheet(row.key)}
                />
              ))}
              {renderSwitchRows(RELATION_SWITCH_ROWS)}
            </ListGroup>

            <Divider />

            <ListGroup title="Seguidores y contactos">
              {renderSwitchRows(FOLLOWER_SWITCH_ROWS)}
            </ListGroup>

            <Divider />

            <ListGroup title="Mensajes Directos">
              {renderSwitchRows([
                { key: 'directMessages', title: 'Mensajes Directos' },
              ])}
            </ListGroup>

            <Divider />

            <ListGroup title="Recomendaciones de Yewi">
              {renderSwitchRows(RECOMMENDATION_SWITCH_ROWS)}
            </ListGroup>

            <Divider />

            <ListGroup title="Novedades de Yewi">
              {renderSwitchRows(NEWS_SWITCH_ROWS)}
            </ListGroup>
          </ScrollView>
        </>
      )}

      {activeSheet !== null && activeMeta ? (
        <View style={[s.sheetBackdrop, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActiveSheet(null)}
          />
          <Sheet
            style={{
              paddingHorizontal: 0,
              paddingBottom: Math.max(bottom, space.xl),
              gap: space.sm,
            }}
          >
            <View style={s.sheetHeader}>
              <Text variant="heading" style={{ color: colors.text, flex: 1 }}>
                {activeMeta.title}
              </Text>
              <IconButton
                name="x"
                label="Cerrar"
                tone="plain"
                onPress={() => setActiveSheet(null)}
              />
            </View>
            <Divider />
            <ListGroup>
              {activeMeta.options.map((opt) => (
                <ListRow
                  key={opt}
                  title={opt}
                  chevron={false}
                  right={
                    settings[activeSheet] === opt ? (
                      <AppIcon name="check" size={18} color={colors.primary} />
                    ) : undefined
                  }
                  onPress={() => {
                    settings.setSetting(activeSheet, opt);
                    setActiveSheet(null);
                  }}
                />
              ))}
            </ListGroup>
          </Sheet>
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  moreValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 10,
    justifyContent: 'flex-end',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: gutter,
    paddingRight: space.sm,
  },
});
