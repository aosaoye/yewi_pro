import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { gutter, ListGroup, ListRow, NavHeader, Screen, space, Text, useTheme } from '@/ui';

export default function SupportScreen() {
  const { colors } = useTheme();
  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Ayuda" solidSurface />
      <ScrollView contentContainerStyle={s.scroll}>
        <ListGroup title="Preguntas frecuentes">
          <View style={s.block}>
            <Text variant="heading" style={{ color: colors.text }}>
              ¿Cómo funciona el pago protegido?
            </Text>
            <Text variant="body" tone="secondary">
              Cuando pagas un servicio o aceptas un presupuesto, Yewi protege el importe y solo lo libera al profesional cuando apruebas el trabajo.
            </Text>
          </View>

          <View style={s.block}>
            <Text variant="heading" style={{ color: colors.text }}>
              ¿Qué incluye Yewi Pro (15,99 €/mes)?
            </Text>
            <Text variant="body" tone="secondary">
              Oportunidades ilimitadas sin gastar créditos, Generador IA de presupuestos por provincia con exportación PDF e insignia destacada.
            </Text>
          </View>
        </ListGroup>

        <ListGroup title="Contacto">
          <ListRow
            icon="mail"
            plainIcon
            title="Soporte"
            subtitle="soporte@yewi.app"
            chevron={false}
          />
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
