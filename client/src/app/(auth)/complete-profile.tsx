import { router } from 'expo-router';
import React, { useState } from 'react';
import { useMe, useUpdateProfile } from '@/api/hooks';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import {
  Button,
  Field,
  FormScroll,
  NavHeader,
  Screen,
  Text,
  toast,
  useTheme,
} from '@/ui';

export default function CompleteProfileScreen() {
  const { colors } = useTheme();
  const meQuery = useMe();
  const updateProfile = useUpdateProfile();

  const [firstName, setFirstName] = useState(
    meQuery.data?.profile?.firstName || '',
  );
  const [lastName, setLastName] = useState(
    meQuery.data?.profile?.lastName || '',
  );
  const [phoneNumber, setPhoneNumber] = useState(
    meQuery.data?.profile?.phoneNumber || '+34',
  );
  const [address, setAddress] = useState({
    city: meQuery.data?.profile?.city || 'Madrid',
    postalCode: meQuery.data?.profile?.postalCode || '28001',
    province: meQuery.data?.profile?.province || 'Madrid',
    region: meQuery.data?.profile?.region || 'Comunidad de Madrid',
    address: meQuery.data?.profile?.address || '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'firstName' | 'lastName' | 'city', string>>
  >({});

  const clearFieldError = (key: 'firstName' | 'lastName' | 'city') => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    const errors: Partial<Record<'firstName' | 'lastName' | 'city', string>> = {};
    if (!firstName.trim()) {
      errors.firstName = 'Introduce tu nombre.';
    }
    if (!lastName.trim()) {
      errors.lastName = 'Introduce tus apellidos.';
    }
    if (!address.city.trim()) {
      errors.city = 'Indica tu ciudad.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        city: address.city.trim() || undefined,
        postalCode: address.postalCode.trim() || undefined,
        province: address.province?.trim() || undefined,
        region: address.region?.trim() || undefined,
        address: address.address?.trim() || undefined,
      });
      toast.success('Perfil completado correctamente');
      router.replace('/(tabs)' as never);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo guardar el perfil.',
      );
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavHeader title="Completar perfil" />
      <FormScroll>
        <Text variant="kicker" style={{ color: colors.accent }}>
          Último paso
        </Text>
        <Text variant="title" style={{ color: colors.text }}>
          Personaliza tus datos para contratar o recibir presupuestos
        </Text>

        <Field
          icon="user"
          label="Nombre"
          placeholder="Nombre"
          value={firstName}
          error={fieldErrors.firstName}
          onChangeText={(val) => {
            setFirstName(val);
            clearFieldError('firstName');
          }}
        />
        <Field
          icon="user"
          label="Apellidos"
          placeholder="Apellidos"
          value={lastName}
          error={fieldErrors.lastName}
          onChangeText={(val) => {
            setLastName(val);
            clearFieldError('lastName');
          }}
        />
        <Field
          icon="phone"
          label="Teléfono"
          placeholder="+34600112233"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />

        <AddressAutocomplete
          value={address}
          errors={{ city: fieldErrors.city }}
          onChange={(next) => {
            setAddress({ ...address, ...next });
            if (next.city.trim()) clearFieldError('city');
          }}
        />

        <Button
          title="Guardar y continuar"
          loading={updateProfile.isPending}
          onPress={handleSave}
        />
      </FormScroll>
    </Screen>
  );
}
