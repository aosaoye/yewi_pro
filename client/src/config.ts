import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import {
  buildApiUrlCandidates,
  extractHostFromUri,
  toRealtimeOrigin,
} from '@/lib/apiHost';

function detectPackagerHost(): string | null {
  const rawUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost ||
    (
      Constants as {
        manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
      }
    ).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as { manifest?: { debuggerHost?: string } }).manifest
      ?.debuggerHost ||
    (NativeModules as { SourceCode?: { scriptURL?: string } })?.SourceCode
      ?.scriptURL;

  return extractHostFromUri(rawUri);
}

export const API_CANDIDATES = buildApiUrlCandidates({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  packagerHost: detectPackagerHost(),
  platformOs: Platform.OS,
});

let activeApiUrl = API_CANDIDATES[0];

export function getActiveApiUrl(): string {
  return activeApiUrl;
}

export function setActiveApiUrl(nextUrl: string): void {
  const clean = nextUrl.trim().replace(/\/+$/, '');
  if (clean) {
    activeApiUrl = clean;
  }
}

export function getRealtimeUrl(): string {
  return toRealtimeOrigin(activeApiUrl);
}

export const API_URL = activeApiUrl;
export const REALTIME_URL = toRealtimeOrigin(activeApiUrl);
export const APP_SCHEME = 'yewi';
export const REQUEST_TIMEOUT_MS = 12_000;
export const PAGE_SIZE = 20;
export const DEFAULT_CLERK_PUBLISHABLE_KEY =
  'pk_test_Y2VydGFpbi1zYWlsZmlzaC00MjcwLmNsZXJrLmFjY291bnRzLmRldiQ';

const rawClerkKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || '';

export const CLERK_PUBLISHABLE_KEY =
  !rawClerkKey || rawClerkKey === 'pk_live_Y2xlcmsueWV3aS5jb20k'
    ? DEFAULT_CLERK_PUBLISHABLE_KEY
    : rawClerkKey;
