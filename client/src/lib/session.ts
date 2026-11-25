import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'yewi_access_token';
const REFRESH_KEY = 'yewi_refresh_token';
const USER_KEY = 'yewi_cached_user';
const ONBOARDING_KEY = 'yewi_onboarding_seen';

let memAccess: string | null = null;
let memRefresh: string | null = null;

type SessionListener = (loggedIn: boolean) => void;
const listeners = new Set<SessionListener>();

async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | null> {
  if (memAccess) return memAccess;
  try {
    memAccess = await getSecureItem(ACCESS_KEY);
    return memAccess;
  } catch {
    return null;
  }
}

export async function setAccessToken(token: string | null): Promise<void> {
  memAccess = token;
  if (token) {
    await setSecureItem(ACCESS_KEY, token);
  } else {
    await deleteSecureItem(ACCESS_KEY);
  }
  listeners.forEach((cb) => cb(Boolean(token)));
}

export async function getRefreshToken(): Promise<string | null> {
  if (memRefresh) return memRefresh;
  try {
    memRefresh = await getSecureItem(REFRESH_KEY);
    return memRefresh;
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  memRefresh = token;
  if (token) {
    await setSecureItem(REFRESH_KEY, token);
  } else {
    await deleteSecureItem(REFRESH_KEY);
  }
}

export async function saveTokens(
  accessToken: string,
  refreshToken?: string | null,
): Promise<void> {
  await setAccessToken(accessToken);
  if (refreshToken !== undefined) {
    await setRefreshToken(refreshToken);
  }
}

export async function saveCachedUser<T>(user: T | null): Promise<void> {
  if (!user) {
    await AsyncStorage.removeItem(USER_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getCachedUser<T>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
}

export async function clearSession(): Promise<void> {
  memAccess = null;
  memRefresh = null;
  await Promise.all([
    deleteSecureItem(ACCESS_KEY),
    deleteSecureItem(REFRESH_KEY),
    AsyncStorage.removeItem(USER_KEY),
  ]);
  listeners.forEach((cb) => cb(false));
}

export function onSessionChange(cb: SessionListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
