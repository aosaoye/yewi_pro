import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Safe dynamic accessor for Notifications in Expo Go (SDK 53/54+)
let Notifications: typeof import('expo-notifications') | null = null;

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo' ||
  !Constants.expoConfig;

if (!isExpoGo) {
  try {
    // Carga perezosa para evitar el error nativo de expo-notifications dentro de Expo Go
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          priority: Notifications?.AndroidNotificationPriority?.HIGH,
        }),
      });
    }
  } catch {
    // Gracefully ignored
  }
}

export const notificationService = {
  // 1. Initialize Android notification channels (MANDATORY for Android 8.0+)
  async init(): Promise<void> {
    if (!Notifications || isExpoGo) return;

    try {
      if (Platform.OS === 'android' && Notifications.setNotificationChannelAsync) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notificaciones Yewi',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0284C7',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });

        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Pedidos y Presupuestos',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 150, 300],
          lightColor: '#0284C7',
          sound: 'default',
        });
      }
    } catch (e) {
      console.warn('Channel init note:', e);
    }
  },

  // 2. Request permissions for push & local notifications
  async requestPermissions(): Promise<boolean> {
    if (!Notifications || isExpoGo) return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (e) {
      console.warn('Permission request note:', e);
      return false;
    }
  },

  // 3. Get Expo Push Token for remote push notifications (requires development build / EAS in production)
  async getPushToken(): Promise<string | null> {
    if (!Notifications || isExpoGo) {
      return null;
    }

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      await this.init();

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      ).catch(() => null);
      return tokenData?.data || null;
    } catch {
      return null;
    }
  },

  // 4. Send an immediate Local Notification (Falls back to Haptic & In-app alert in Expo Go)
  async sendLocalNotification(params: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
  }): Promise<string | null> {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (!Notifications || isExpoGo) {
      return 'local-simulated-notification';
    }

    try {
      await this.init();
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          data: params.data || {},
          sound: 'default',
          color: '#0284C7',
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Local notification note:', e);
      return null;
    }
  },

  // 5. Schedule a timed Local Notification
  async scheduleTimedNotification(params: {
    title: string;
    body: string;
    seconds: number;
    data?: Record<string, any>;
  }): Promise<string | null> {
    if (!Notifications || isExpoGo) {
      return null;
    }

    try {
      await this.init();
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.body,
          data: params.data || {},
          sound: 'default',
          color: '#0284C7',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(params.seconds, 1),
          repeats: false,
        },
      });
    } catch {
      return null;
    }
  },

  // 6. Navigate from notification response data
  navigateFromNotificationData(
    data: unknown,
    router: { push: (route: any) => void },
  ): void {
    const safeId = (value: unknown): string | null =>
      typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
        ? value
        : null;

    const pushIdRoute = (pathname: '/conversation' | '/request-detail' | '/detail', key: string, value: unknown) => {
      const id = safeId(value);
      if (!id) return false;
      router.push({ pathname, params: { [key]: id } });
      return true;
    };

    if (!data || typeof data !== 'object') {
      router.push('/notifications');
      return;
    }

    const payload = data as Record<string, unknown>;
    const conversationId = payload.conversationId;
    const leadId = payload.leadId ?? payload.requestId;
    const gigId = payload.gigId;
    const link = typeof payload.link === 'string' ? payload.link : '';

    if (pushIdRoute('/conversation', 'id', conversationId)) {
      return;
    }

    if (pushIdRoute('/request-detail', 'id', leadId)) {
      return;
    }

    if (pushIdRoute('/detail', 'id', gigId)) {
      return;
    }

    if (link) {
      // Parse only known internal paths. Never pass arbitrary payload paths to Expo Router.
      let parsed: URL;
      try {
        parsed = new URL(link, 'https://yewi.invalid');
      } catch {
        router.push('/notifications');
        return;
      }

      if (parsed.origin !== 'https://yewi.invalid') {
        router.push('/notifications');
        return;
      }

      const path = parsed.pathname;
      if (path === '/conversation' || path === '/chat') {
        if (pushIdRoute('/conversation', 'id', parsed.searchParams.get('id') ?? parsed.searchParams.get('conversationId'))) return;
        router.push('/(tabs)/chat');
        return;
      }

      if (path === '/request-detail' || path === '/requests' || path.startsWith('/requests/')) {
        const pathId = path.startsWith('/requests/') ? path.slice('/requests/'.length) : null;
        if (pushIdRoute('/request-detail', 'id', parsed.searchParams.get('id') ?? pathId)) return;
        router.push('/(tabs)/requests');
        return;
      }

      if (path === '/detail') {
        if (pushIdRoute('/detail', 'id', parsed.searchParams.get('id'))) return;
        router.push('/(tabs)/search');
        return;
      }

      const fixedRoutes: Record<string, string> = {
        '/notifications': '/notifications',
        '/wallet': '/wallet',
        '/search': '/(tabs)/search',
        '/profile': '/(tabs)/profile',
        '/vouchers': '/(tabs)/requests',
        '/orders': '/notifications',
      };
      const destination = fixedRoutes[path];
      if (destination) {
        router.push(destination);
        return;
      }
    }

    router.push('/notifications');
  },

  getNotifications() {
    return Notifications;
  },
};
