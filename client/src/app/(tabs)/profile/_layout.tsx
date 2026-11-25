import { Stack } from 'expo-router';
import React from 'react';

export default function ProfileStackLayout() {
  return (
    <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="following" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="account" />
      <Stack.Screen name="professional" />
      <Stack.Screen name="portfolio" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="support" />
    </Stack>
  );
}
