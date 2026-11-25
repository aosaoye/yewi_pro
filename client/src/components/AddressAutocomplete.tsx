import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SPANISH_REGIONS } from '@/lib/spanishGeoService';
import { Field, PillButton, PillCarousel, space, Text } from '@/ui';

export interface AddressFields {
  region?: string;
  province?: string;
  city: string;
  postalCode: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export function AddressAutocomplete({
  value,
  onChange,
  errors,
}: {
  value: AddressFields;
  onChange: (next: AddressFields) => void;
  errors?: Partial<Record<'city' | 'postalCode' | 'province' | 'address', string>>;
}) {
  const [locating, setLocating] = useState(false);

  const provinces = useMemo(
    () =>
      SPANISH_REGIONS.flatMap((r) => r.provinces).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [],
  );

  const filteredProvinces = useMemo(() => {
    const q = (value.province || '').trim().toLowerCase();
    const list = !q
      ? provinces.slice(0, 8)
      : provinces.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
    return list.map((p) => ({
      key: p.name,
      label: p.name,
      regionName: p.regionName,
    }));
  }, [provinces, value.province]);

  const handleUseGps = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      const rev = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (rev[0]) {
        const place = rev[0];
        onChange({
          ...value,
          city: place.city || place.subregion || value.city,
          province: place.region || value.province,
          postalCode: place.postalCode || value.postalCode,
          address: [place.street, place.streetNumber].filter(Boolean).join(' ') || value.address,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } else {
        onChange({
          ...value,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch {
      // Silencio seguro en web/emulador sin GPS
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: 2 }}>
      <View style={s.geoBar}>
        <Text variant="label" tone="secondary">
          Ubicación en España
        </Text>
        <PillButton
          label={locating ? 'Localizando...' : 'Usar mi ubicación'}
          icon="navigation"
          tone="primary"
          variant="soft"
          size="md"
          loading={locating}
          onPress={() => void handleUseGps()}
        />
      </View>

      <View style={s.twoCols}>
        <View style={{ flex: 1.4 }}>
          <Field
            icon="building-complex"
            label="Ciudad / Municipio"
            placeholder="Madrid"
            value={value.city}
            error={errors?.city}
            onChangeText={(city) => onChange({ ...value, city })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            icon="hash"
            label="C. Postal"
            placeholder="28001"
            keyboardType="number-pad"
            maxLength={5}
            value={value.postalCode}
            error={errors?.postalCode}
            onChangeText={(postalCode) =>
              onChange({ ...value, postalCode: postalCode.replace(/\D/g, '') })
            }
          />
        </View>
      </View>

      <Field
        icon="road"
        label="Provincia"
        placeholder="Ej: Madrid, Zaragoza, Barcelona"
        value={value.province ?? ''}
        error={errors?.province}
        onChangeText={(province) => onChange({ ...value, province })}
      />

      {filteredProvinces.length > 0 ? (
        <PillCarousel
          fullBleed
          size="md"
          tone="primary"
          options={filteredProvinces}
          value={value.province ?? ''}
          onChange={(provName) => {
            const match = filteredProvinces.find((p) => p.key === provName);
            onChange({
              ...value,
              province: provName,
              region: match?.regionName ?? value.region,
            });
          }}
          style={{ marginBottom: space.sm }}
        />
      ) : null}

      <Field
        icon="map-pin"
        label="Dirección (opcional)"
        placeholder="Calle Mayor, 14"
        value={value.address ?? ''}
        onChangeText={(address) => onChange({ ...value, address })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  geoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  twoCols: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
