import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  QueryClient,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

const MAX_PERSISTED_CACHE_BYTES = 900_000;
const PERSISTABLE_QUERY_ROOTS = new Set([
  'me',
  'categories',
  'subscription',
  'wallet',
]);

const safePersisterStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      // Android SQLite CursorWindow (~2 MB limit) puede lanzar Row too big si quedó caché antigua
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length > MAX_PERSISTED_CACHE_BYTES) {
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      await AsyncStorage.removeItem(key).catch(() => undefined);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: safePersisterStorage,
  key: 'yewi_react_query_cache_v1',
  throttleTime: 1000,
});

export const persistOptions = {
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: {
      state: { status: string };
      queryKey: readonly unknown[];
    }) => {
      if (query.state.status !== 'success') return false;
      const root = String(query.queryKey[0] ?? '');
      return PERSISTABLE_QUERY_ROOTS.has(root);
    },
  },
};

let lifecycleBound = false;

export function bindQueryLifecycle(): () => void {
  if (lifecycleBound) {
    return () => undefined;
  }
  lifecycleBound = true;

  const unsubscribeNet = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(
      state.isConnected && state.isInternetReachable !== false,
    );
    onlineManager.setOnline(isOnline);
  });

  const subApp = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    },
  );

  return () => {
    lifecycleBound = false;
    unsubscribeNet();
    subApp.remove();
  };
}
