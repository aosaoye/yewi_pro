import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  getCountryByCodeOrPrefix,
  SUPPORTED_COUNTRIES,
  validatePhoneNumber,
} from '@/lib/validation';
import { Field, fonts, PillTab, space, Text, useTheme } from '@/ui';

export interface PhoneInputProps {
  label?: string;
  countryCode: string;
  onChangeCountry: (code: 'ES' | 'FR' | 'GB', prefix: string) => void;
  value: string;
  onChangeText: (digits: string) => void;
  error?: string;
}

export function PhoneInput({
  label = 'Teléfono de contacto',
  countryCode,
  onChangeCountry,
  value,
  onChangeText,
  error,
}: PhoneInputProps) {
  const { colors } = useTheme();
  const activeCountry = getCountryByCodeOrPrefix(countryCode);
  const validation = value
    ? validatePhoneNumber(activeCountry.code, activeCountry.prefix, value)
    : null;

  return (
    <View style={{ marginBottom: 12, gap: 6 }}>
      <Text variant="label" style={{ color: colors.text, fontWeight: '600' }}>
        {label}
      </Text>

      <View style={s.countriesRow}>
        {SUPPORTED_COUNTRIES.map((c) => {
          const selected = c.code === activeCountry.code;
          return (
            <PillTab
              key={c.code}
              label={`${c.flag} ${c.prefix}`}
              active={selected}
              tone="primary"
              size="lg"
              style={{ flex: 1 }}
              onPress={() => onChangeCountry(c.code, c.prefix)}
            />
          );
        })}
      </View>

      <Field
        icon="phone"
        leftSlot={
          <Text
            variant="body"
            style={{
              color: colors.textSecondary,
              fontFamily: fonts.semibold,
              paddingRight: 10,
              borderRightWidth: StyleSheet.hairlineWidth,
              borderRightColor: colors.border,
            }}
          >
            {activeCountry.prefix}
          </Text>
        }
        value={value}
        onChangeText={(txt) => onChangeText(txt.replace(/[^\d\s]/g, ''))}
        keyboardType="phone-pad"
        placeholder={activeCountry.placeholder}
        valid={!error && Boolean(validation?.isValid)}
        error={error}
        containerStyle={{ marginBottom: 0 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  countriesRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: 4,
  },
});
