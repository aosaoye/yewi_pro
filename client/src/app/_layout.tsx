import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkAuthSync } from '@/components/ClerkAuthSync';
import { CLERK_PUBLISHABLE_KEY } from '@/config';
import { bindQueryLifecycle, persistOptions, queryClient } from '@/lib/queryClient';
import { realtimeManager } from '@/lib/realtime';
import { notificationService } from '@/lib/notifications';
import { notificationsApi } from '@/api/services';
import { getAccessToken, onSessionChange } from '@/lib/session';
import { ThemeProvider, Toaster, useTheme } from '@/ui';

WebBrowser.maybeCompleteAuthSession();
void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { navigationTheme, isDark } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const syncPushToken = () => {
      void notificationService
        .getPushToken()
        .then((pushToken) => {
          if (pushToken) {
            return notificationsApi.registerPushToken(pushToken);
          }
          return undefined;
        })
        .catch(() => {});
    };

    const unbindQueryLifecycle = bindQueryLifecycle();
    void getAccessToken().then((token) => {
      if (token) {
        void realtimeManager.start();
        syncPushToken();
      }
    });

    const unsub = onSessionChange((loggedIn) => {
      if (loggedIn) {
        void realtimeManager.start();
        syncPushToken();
      } else {
        realtimeManager.stop();
      }
    });

    const Notifications = notificationService.getNotifications();
    let pendingNotificationData: unknown;
    const openNotification = async (data: unknown) => {
      const token = await getAccessToken();
      if (!token) {
        pendingNotificationData = data;
        return;
      }
      notificationService.navigateFromNotificationData(data, router);
    };
    const onLogin = onSessionChange((loggedIn) => {
      if (loggedIn && pendingNotificationData) {
        const data = pendingNotificationData;
        pendingNotificationData = undefined;
        notificationService.navigateFromNotificationData(data, router);
      }
    });
    const responseSubscription = Notifications?.addNotificationResponseReceivedListener(
      (response) => {
        void openNotification(response.notification.request.content.data);
      },
    );
    void Notifications?.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        void openNotification(response.notification.request.content.data);
      }
    });

    return () => {
      unbindQueryLifecycle();
      unsub();
      onLogin();
      responseSubscription?.remove();
    };
  }, [router]);

  return (
    <NavThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search-settings" />
        <Stack.Screen name="detail" />
        <Stack.Screen name="professional-profile" />
        <Stack.Screen name="portfolio-detail" />
        <Stack.Screen name="request-detail" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="publish" />
        <Stack.Screen name="publish-gig" />
        <Stack.Screen name="create-request" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="create-review" options={{ presentation: 'modal' }} />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="tools/budget-generator" />
        <Stack.Screen name="sso-callback" />
      </Stack>
      <Toaster />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const tree = (
    <ThemeProvider>
      {CLERK_PUBLISHABLE_KEY ? (
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY}
          tokenCache={tokenCache}
        >
          <ClerkAuthSync />
          <RootNavigator />
        </ClerkProvider>
      ) : (
        <RootNavigator />
      )}
    </ThemeProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          {tree}
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
