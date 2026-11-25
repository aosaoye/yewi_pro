import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useDeleteAccount, useMe, useUpdateProfile } from '@/api/hooks';
import { professionalsApi } from '@/api/services';
import {
  AppIcon,
  Avatar,
  Cover,
  Divider,
  Field,
  fonts,
  FormScroll,
  gutter,
  radius,
  Screen,
  space,
  Text,
  toast,
  useTheme,
} from '@/ui';

export default function AccountProfileScreen() {
  const { colors } = useTheme();
  const meQuery = useMe();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const p = meQuery.data?.profile;
  const taxId = meQuery.data?.professionalProfile?.taxId || '';
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    Partial<{
      bio: string;
      phoneNumber: string;
      city: string;
      postalCode: string;
      address: string;
    }>
  >({});

  const firstName = p?.firstName || '';
  const lastName = p?.lastName || '';
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    p?.displayName ||
    meQuery.data?.email?.split('@')[0] ||
    'Usuario Yewi';

  const bio = draft.bio ?? (p?.bio || '');
  const phoneNumber = draft.phoneNumber ?? (p?.phoneNumber || '');
  const city = draft.city ?? (p?.city || '');
  const postalCode = draft.postalCode ?? (p?.postalCode || '');
  const address = draft.address ?? (p?.address || '');
  const avatarUrl = localAvatarUri ?? p?.avatarUrl ?? undefined;

  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        toast.error('Permiso de galería requerido');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const asset = res.assets[0];
      setLocalAvatarUri(asset.uri);
      try {
        const payload = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        const uploaded = await professionalsApi.uploadPortfolioImage(payload);
        await updateProfile.mutateAsync({ avatarUrl: uploaded.url });
        toast.success('Foto actualizada');
      } catch {
        toast.info('Vista previa local aplicada');
      }
    } catch {
      toast.error('No se pudo abrir la galería');
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        bio: bio.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        address: address.trim() || undefined,
      });
      setDraft({});
      toast.success('Perfil guardado');
      router.back();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error al guardar los datos',
      );
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esta acción eliminará tu cuenta de Yewi permanentemente. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount.mutateAsync();
              toast.info('Cuenta eliminada');
              router.replace('/(auth)/login' as never);
            } catch (err) {
              toast.error(
                err instanceof Error
                  ? err.message
                  : 'No se pudo eliminar la cuenta.',
              );
            }
          },
        },
      ],
    );
  };

  const underlineBoxStyle = [
    s.underlineBox,
    { borderBottomColor: colors.divider },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Cabecera estilo Editar perfil: ← Editar perfil | Guardar */}
      <View style={s.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={s.backBtn}
        >
          <AppIcon name="arrow-left" size={22} color={colors.text} />
        </Pressable>

        <Text
          variant="heading"
          style={{ flex: 1, color: colors.text, fontSize: 18 }}
        >
          Editar perfil
        </Text>

        <Pressable
          onPress={() => void handleSave()}
          disabled={updateProfile.isPending}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Guardar"
        >
          {updateProfile.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              variant="label"
              style={{
                color: colors.primary,
                fontFamily: fonts.bold,
                fontSize: 15.5,
              }}
            >
              Guardar
            </Text>
          )}
        </Pressable>
      </View>

      <FormScroll contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
        {/* Portada + Avatar solapado con icono de cámara */}
        <View style={s.coverWrap}>
          <Cover seed={fullName} style={s.coverImg} />
          <View style={s.coverOverlay}>
            <AppIcon name="camera" size={24} color="#FFFFFF" />
          </View>
        </View>

        <View style={s.avatarRow}>
          <Pressable
            onPress={() => void handlePickAvatar()}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            style={[
              s.avatarRing,
              {
                borderColor: colors.background,
                backgroundColor: colors.surfaceSubtle,
              },
            ]}
          >
            <Avatar name={fullName} avatarUrl={avatarUrl} size={76} />
            <View style={s.avatarCameraOverlay}>
              <AppIcon name="camera" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {/* Campos limpios con línea inferior (Nombre/Apellidos y NIF bloqueados) */}
        <View style={s.fieldsWrap}>
          <Field
            hideIcon
            label="Nombre y apellidos"
            value={fullName}
            editable={false}
            rightIcon="lock"
            boxStyle={[underlineBoxStyle, { opacity: 0.6 }]}
            style={s.underlineInput}
          />

          {taxId ? (
            <Field
              hideIcon
              label="NIF / CIF"
              value={taxId}
              editable={false}
              rightIcon="lock"
              boxStyle={[underlineBoxStyle, { opacity: 0.6 }]}
              style={s.underlineInput}
            />
          ) : null}

          <Field
            hideIcon
            multiline
            label="Biografía"
            placeholder="Cuéntanos brevemente sobre ti..."
            value={bio}
            onChangeText={(v) => setDraft((d) => ({ ...d, bio: v }))}
            boxStyle={underlineBoxStyle}
            style={s.underlineMultiline}
          />

          <Field
            hideIcon
            label="Teléfono"
            placeholder="+34600112233"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={(v) => setDraft((d) => ({ ...d, phoneNumber: v }))}
            boxStyle={underlineBoxStyle}
            style={s.underlineInput}
          />

          <Field
            hideIcon
            label="Ubicación"
            placeholder="Ciudad o municipio"
            value={city}
            onChangeText={(v) => setDraft((d) => ({ ...d, city: v }))}
            boxStyle={underlineBoxStyle}
            style={s.underlineInput}
          />

          <Field
            hideIcon
            label="Dirección"
            placeholder="Calle y número"
            value={address}
            onChangeText={(v) => setDraft((d) => ({ ...d, address: v }))}
            boxStyle={underlineBoxStyle}
            style={s.underlineInput}
          />

          <Field
            hideIcon
            label="Código postal"
            placeholder="28001"
            keyboardType="number-pad"
            maxLength={5}
            value={postalCode}
            onChangeText={(v) =>
              setDraft((d) => ({ ...d, postalCode: v.replace(/\D/g, '') }))
            }
            boxStyle={underlineBoxStyle}
            style={s.underlineInput}
          />
        </View>

        <View style={{ paddingTop: space.xl, paddingHorizontal: gutter }}>
          <Divider />
          <Pressable
            onPress={handleDeleteAccount}
            disabled={deleteAccount.isPending}
            style={({ pressed }) => [s.deleteRow, pressed && { opacity: 0.7 }]}
          >
            <AppIcon name="trash-2" size={18} color={colors.danger} />
            <Text
              variant="label"
              style={{ color: colors.danger, fontFamily: fonts.semibold }}
            >
              Eliminar cuenta
            </Text>
          </Pressable>
        </View>
      </FormScroll>
    </Screen>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter,
    paddingVertical: 12,
    gap: 14,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrap: {
    width: '100%',
    height: 118,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRow: {
    paddingHorizontal: gutter,
    marginTop: -38,
    marginBottom: space.md,
  },
  avatarRing: {
    width: 82,
    height: 82,
    borderRadius: radius.full,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarCameraOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldsWrap: {
    paddingHorizontal: gutter,
    gap: 4,
  },
  underlineBox: {
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minHeight: 42,
  },
  underlineInput: {
    minHeight: 40,
    paddingVertical: 6,
    fontSize: 16,
  },
  underlineMultiline: {
    minHeight: 68,
    paddingTop: 6,
    paddingBottom: 8,
    fontSize: 16,
    lineHeight: 22,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: space.lg,
  },
});
