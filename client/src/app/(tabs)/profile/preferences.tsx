import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMe } from '@/api/hooks';
import { biometricService } from '@/lib/biometricService';
import { usePreferencesStore } from '@/lib/stores';
import {
  CustomSwitch,
  gutter,
  ListGroup,
  NavHeader,
  Screen,
  space,
  Text,
  type ThemeMode,
  toast,
  useTheme,
} from '@/ui';

const THEME_OPTIONS: {
  key: ThemeMode;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'system',
    title: 'Automático (Sistema)',
    subtitle: 'Sigue el tema claro u oscuro configurado en tu dispositivo.',
  },
  {
    key: 'light',
    title: 'Modo Claro',
    subtitle: 'Fondo claro y contraste nítido para entornos luminosos.',
  },
  {
    key: 'dark',
    title: 'Modo Oscuro',
    subtitle: 'Fondo negro profundo (#09090B) y contraste calibrado.',
  },
];

export default function PreferencesScreen() {
  const { mode, setMode, colors } = useTheme();
  const meQuery = useMe();
  const biometricEnabled = usePreferencesStore((s) => s.biometricEnabled);
  const setBiometricEnabled = usePreferencesStore((s) => s.setBiometricEnabled);
  const pushEnabled = usePreferencesStore((s) => s.pushEnabled);
  const setPushEnabled = usePreferencesStore((s) => s.setPushEnabled);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometría');

  useEffect(() => {
    void biometricService.isAvailable().then(setBioAvailable);
    void biometricService.getBiometricLabel().then(setBioLabel);
  }, []);

  const handleToggleBiometric = async (next: boolean) => {
    if (!next) {
      await biometricService.disable();
      setBiometricEnabled(false);
      toast.info('Acceso biométrico desactivado');
      return;
    }
    if (!meQuery.data) {
      toast.error('Debes iniciar sesión para activar la biometría');
      return;
    }
    const ok = await biometricService.enableWithCurrentSession(meQuery.data);
    if (ok) {
      setBiometricEnabled(true);
      toast.success(`${bioLabel} activado`);
    } else {
      toast.error('No se pudo verificar la biometría');
    }
  };

  const handleSelectMode = (selected: ThemeMode) => {
    if (mode === selected) return;
    setMode(selected);
    toast.success(
      selected === 'system'
        ? 'Tema automático del sistema activado'
        : selected === 'dark'
          ? 'Modo oscuro activado'
          : 'Modo claro activado',
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Apariencia y preferencias" solidSurface />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        <ListGroup title="Tema visual">
          {THEME_OPTIONS.map((opt) => {
            const checked = mode === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => handleSelectMode(opt.key)}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.72 }]}
                accessibilityRole="switch"
                accessibilityState={{ checked }}
                accessibilityLabel={opt.title}
              >
                <View style={s.rowText}>
                  <Text variant="heading" style={{ color: colors.text }}>
                    {opt.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {opt.subtitle}
                  </Text>
                </View>
                <CustomSwitch
                  value={checked}
                  onValueChange={() => handleSelectMode(opt.key)}
                />
              </Pressable>
            );
          })}
        </ListGroup>

        <ListGroup title="Seguridad y avisos">
          <View style={s.row}>
            <View style={s.rowText}>
              <Text variant="heading" style={{ color: colors.text }}>
                Acceso rápido con {bioLabel}
              </Text>
              <Text variant="caption" tone="muted">
                {bioAvailable
                  ? 'Entra sin escribir tu contraseña.'
                  : 'No disponible en este dispositivo.'}
              </Text>
            </View>
            <CustomSwitch
              value={biometricEnabled}
              disabled={!bioAvailable}
              onValueChange={(next) => void handleToggleBiometric(next)}
            />
          </View>

          <View style={s.row}>
            <View style={s.rowText}>
              <Text variant="heading" style={{ color: colors.text }}>
                Alertas de pedidos
              </Text>
              <Text variant="caption" tone="muted">
                Avisos en tiempo real de presupuestos y encargos.
              </Text>
            </View>
            <CustomSwitch
              value={pushEnabled}
              onValueChange={setPushEnabled}
            />
          </View>
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: gutter,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
});
