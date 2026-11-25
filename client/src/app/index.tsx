import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/session';
import { AppIcon, Button, fonts, gutter, radius, Screen, space, Spinner, Text, useTheme } from '@/ui';

const SLIDES = [
  {
    kicker: 'Marketplace verificado',
    title: 'Contrata profesionales de confianza cerca de ti',
    body: 'Compara precios cerrados o recibe múltiples presupuestos para reformas, reparaciones y servicios digitales en España.',
    icon: 'shield' as const,
  },
  {
    kicker: 'Custodia Escrow',
    title: 'Tu pago 100% protegido hasta la entrega final',
    body: 'Los fondos se retienen en custodia segura y solo se liberan al profesional cuando apruebas el trabajo terminado.',
    icon: 'lock' as const,
  },
  {
    kicker: 'Yewi Pro',
    title: 'Presupuestos IA y oportunidades directas',
    body: 'Si eres profesional o empresa, desbloquea clientes sin pagar por cada contacto y genera presupuestos en PDF al instante.',
    icon: 'zap' as const,
  },
];

export default function IndexGateScreen() {
  const { colors } = useTheme();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const seen = await hasSeenOnboarding();
      if (!active) return;
      if (seen) {
        router.replace('/(tabs)' as never);
        return;
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <Screen>
        <View style={s.loader}>
          <Spinner label="Iniciando Yewi..." />
        </View>
      </Screen>
    );
  }

  const current = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = async (target: '/(tabs)' | '/(auth)/login') => {
    await markOnboardingSeen();
    router.replace(target as never);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.container}>
        <View style={s.topBar}>
          <View style={s.brand}>
            <View style={[s.logo, { backgroundColor: colors.primary }]}>
              <Text variant="heading" style={{ color: '#fff', fontSize: 16 }}>
                Y
              </Text>
            </View>
            <Text variant="title" style={{ color: colors.text }}>
              Yewi
            </Text>
          </View>
          <Pressable onPress={() => void finish('/(tabs)')}>
            <Text
              variant="label"
              style={{ color: colors.textSecondary, fontFamily: fonts.semibold }}
            >
              Omitir
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            s.heroBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Image
            source={require('../../assets/images/hero_room.jpg')}
            style={s.heroImage}
            resizeMode="cover"
          />
          <View
            style={[
              s.badgeFloat,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                s.iconCircle,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <AppIcon name={current.icon} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                variant="caption"
                style={{ color: colors.primary, fontFamily: fonts.bold }}
              >
                {current.kicker}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                Pagos seguros · Reseñas verificadas
              </Text>
            </View>
          </View>
        </View>

        <View style={s.copyBox}>
          <Text variant="display" style={{ color: colors.text }}>
            {current.title}
          </Text>
          <Text variant="body" tone="secondary" style={{ lineHeight: 22 }}>
            {current.body}
          </Text>
        </View>

        <View style={s.dots}>
          {SLIDES.map((item, idx) => (
            <Pressable
              key={item.kicker}
              onPress={() => setStep(idx)}
              style={[
                s.dot,
                {
                  width: idx === step ? 24 : 8,
                  backgroundColor:
                    idx === step ? colors.primary : colors.borderStrong,
                },
              ]}
            />
          ))}
        </View>

        <View style={s.footer}>
          <Button
            title={isLast ? 'Explorar servicios' : 'Continuar'}
            onPress={() => {
              if (isLast) {
                void finish('/(tabs)');
              } else {
                setStep((prev) => prev + 1);
              }
            }}
          />
          <Button
            title="Iniciar sesión o registrarse"
            variant="secondary"
            onPress={() => void finish('/(auth)/login')}
          />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    justifyContent: 'space-between',
    gap: space.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBox: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  badgeFloat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBox: {
    gap: space.sm,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: radius.pill,
  },
  footer: {
    gap: space.sm,
  },
});
