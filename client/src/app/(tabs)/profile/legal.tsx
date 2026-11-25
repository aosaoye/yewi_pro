import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { gutter, ListGroup, NavHeader, Screen, space, Text, useTheme } from '@/ui';

export default function LegalScreen() {
  const { colors } = useTheme();
  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Legal" solidSurface />
      <ScrollView contentContainerStyle={s.scroll}>
        <ListGroup title="Pagos protegidos">
          <View style={s.block}>
            <Text variant="heading" style={{ color: colors.text }}>
              Protección de pagos Yewi
            </Text>
            <Text variant="body" tone="secondary">
              Los pagos de servicios y presupuestos aceptados quedan protegidos hasta que confirmas la entrega final o finaliza el plazo de revisión.
            </Text>
          </View>
        </ListGroup>

        <ListGroup title="Privacidad y RGPD">
          <View style={s.block}>
            <Text variant="heading" style={{ color: colors.text }}>
              Tus datos y privacidad
            </Text>
            <Text variant="body" tone="secondary">
              Tus datos de contacto solo se comparten al formalizar un encargo o aceptar un presupuesto. Puedes solicitar la eliminación de tu cuenta desde Datos personales.
            </Text>
          </View>
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingBottom: space.xxl,
  },
  block: {
    paddingHorizontal: gutter,
    paddingVertical: space.md,
    gap: space.xs,
  },
});
