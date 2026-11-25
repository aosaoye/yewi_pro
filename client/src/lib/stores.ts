import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BudgetItemModel } from '@/api/types';

export type ActiveRoleMode = 'CLIENT' | 'PROFESSIONAL';

interface AppPreferencesState {
  activeRole: ActiveRoleMode;
  biometricEnabled: boolean;
  pushEnabled: boolean;
  setActiveRole: (role: ActiveRoleMode) => void;
  setBiometricEnabled: (val: boolean) => void;
  setPushEnabled: (val: boolean) => void;
}

export const usePreferencesStore = create<AppPreferencesState>()(
  persist(
    (set) => ({
      activeRole: 'CLIENT',
      biometricEnabled: false,
      pushEnabled: true,
      setActiveRole: (activeRole) => set({ activeRole }),
      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
    }),
    {
      name: 'yewi_preferences_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

interface FavoritesState {
  savedGigIds: string[];
  savedProIds: string[];
  toggleGig: (id: string) => void;
  togglePro: (id: string) => void;
  followManyPros: (ids: string[]) => void;
  isGigSaved: (id: string) => boolean;
  isProSaved: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      savedGigIds: [],
      savedProIds: [],
      toggleGig: (id) =>
        set((state) => ({
          savedGigIds: state.savedGigIds.includes(id)
            ? state.savedGigIds.filter((item) => item !== id)
            : [...state.savedGigIds, id],
        })),
      togglePro: (id) =>
        set((state) => ({
          savedProIds: state.savedProIds.includes(id)
            ? state.savedProIds.filter((item) => item !== id)
            : [...state.savedProIds, id],
        })),
      followManyPros: (ids) =>
        set((state) => {
          const allFollowed = ids.every((id) => state.savedProIds.includes(id));
          if (allFollowed) {
            return {
              savedProIds: state.savedProIds.filter((id) => !ids.includes(id)),
            };
          }
          return {
            savedProIds: Array.from(new Set([...state.savedProIds, ...ids])),
          };
        }),
      isGigSaved: (id) => get().savedGigIds.includes(id),
      isProSaved: (id) => get().savedProIds.includes(id),
    }),
    {
      name: 'yewi_favorites_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

interface UserPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

interface RealtimeState {
  connected: boolean;
  unreadNotifications: number;
  unreadChats: number;
  presenceByUser: Record<string, UserPresence>;
  setConnected: (connected: boolean) => void;
  setUnreadNotifications: (count: number) => void;
  setUnreadChats: (count: number) => void;
  setUserPresence: (
    userId: string,
    isOnline: boolean,
    lastSeenAt: string | null,
  ) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  unreadNotifications: 0,
  unreadChats: 0,
  presenceByUser: {},
  setConnected: (connected) => set({ connected }),
  setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
  setUnreadChats: (unreadChats) => set({ unreadChats }),
  setUserPresence: (userId, isOnline, lastSeenAt) =>
    set((state) => ({
      presenceByUser: {
        ...state.presenceByUser,
        [userId]: { isOnline, lastSeenAt },
      },
    })),
  reset: () =>
    set({
      connected: false,
      unreadNotifications: 0,
      unreadChats: 0,
      presenceByUser: {},
    }),
}));

interface BudgetDraftState {
  title: string;
  province: string;
  vatRate: number;
  estimatedDays: number;
  validityDays: number;
  items: BudgetItemModel[];
  setTitle: (title: string) => void;
  setProvince: (province: string) => void;
  setVatRate: (vatRate: number) => void;
  setEstimatedDays: (days: number) => void;
  setItems: (items: BudgetItemModel[]) => void;
  addItem: (item: BudgetItemModel) => void;
  removeItem: (id: string) => void;
  resetDraft: () => void;
}

export const useBudgetStore = create<BudgetDraftState>()(
  persist(
    (set) => ({
      title: 'Presupuesto de Reforma',
      province: 'Madrid',
      vatRate: 21,
      estimatedDays: 7,
      validityDays: 30,
      items: [],
      setTitle: (title) => set({ title }),
      setProvince: (province) => set({ province }),
      setVatRate: (vatRate) => set({ vatRate }),
      setEstimatedDays: (estimatedDays) => set({ estimatedDays }),
      setItems: (items) => set({ items }),
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      resetDraft: () =>
        set({
          title: 'Presupuesto de Reforma',
          province: 'Madrid',
          vatRate: 21,
          estimatedDays: 7,
          validityDays: 30,
          items: [],
        }),
    }),
    {
      name: 'yewi_budget_draft_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

interface ExploreSettingsState {
  useCurrentLocation: boolean;
  selectedCity: string;
  distanceRadiusKm: number;
  selectedInterests: string[];
  onlyAvailableToday: boolean;
  includeFreePlans: boolean;
  trendingAndNew: boolean;
  priceRange: string;
  setUseCurrentLocation: (val: boolean) => void;
  setSelectedCity: (city: string) => void;
  setDistanceRadiusKm: (km: number) => void;
  toggleInterest: (tag: string) => void;
  setOnlyAvailableToday: (val: boolean) => void;
  setIncludeFreePlans: (val: boolean) => void;
  setTrendingAndNew: (val: boolean) => void;
  setPriceRange: (range: string) => void;
}

export const useExploreSettingsStore = create<ExploreSettingsState>()(
  persist(
    (set) => ({
      useCurrentLocation: true,
      selectedCity: 'Zaragoza',
      distanceRadiusKm: 15,
      selectedInterests: ['Conciertos', 'Gastronomía', 'Teatro'],
      onlyAvailableToday: false,
      includeFreePlans: true,
      trendingAndNew: true,
      priceRange: 'Cualquier precio',
      setUseCurrentLocation: (useCurrentLocation) => set({ useCurrentLocation }),
      setSelectedCity: (selectedCity) => set({ selectedCity }),
      setDistanceRadiusKm: (distanceRadiusKm) => set({ distanceRadiusKm }),
      toggleInterest: (tag) =>
        set((state) => ({
          selectedInterests: state.selectedInterests.includes(tag)
            ? state.selectedInterests.filter((item) => item !== tag)
            : [...state.selectedInterests, tag],
        })),
      setOnlyAvailableToday: (onlyAvailableToday) => set({ onlyAvailableToday }),
      setIncludeFreePlans: (includeFreePlans) => set({ includeFreePlans }),
      setTrendingAndNew: (trendingAndNew) => set({ trendingAndNew }),
      setPriceRange: (priceRange) => set({ priceRange }),
    }),
    {
      name: 'yewi_explore_settings_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export interface NotificationSettingsValues {
  muteNotFollowing: boolean;
  muteNotFollowedBy: boolean;
  muteNewAccounts: boolean;
  muteDefaultAvatar: boolean;
  muteUnverifiedEmail: boolean;
  muteUnverifiedPhone: boolean;
  followedPostsMode: string;
  mentionsMode: string;
  repostsMode: string;
  likesMode: string;
  photoTags: boolean;
  moments: boolean;
  newFollowers: boolean;
  contactJoins: boolean;
  directMessages: boolean;
  recTopics: boolean;
  recGeneral: boolean;
  newFeatures: boolean;
}

interface NotificationSettingsState extends NotificationSettingsValues {
  setSetting: <K extends keyof NotificationSettingsValues>(
    key: K,
    value: NotificationSettingsValues[K],
  ) => void;
}

export const useNotificationSettingsStore = create<NotificationSettingsState>()(
  persist(
    (set) => ({
      muteNotFollowing: false,
      muteNotFollowedBy: false,
      muteNewAccounts: false,
      muteDefaultAvatar: false,
      muteUnverifiedEmail: false,
      muteUnverifiedPhone: false,
      followedPostsMode: 'Activado',
      mentionsMode: 'Activado',
      repostsMode: 'Activado',
      likesMode: 'Activado',
      photoTags: true,
      moments: true,
      newFollowers: true,
      contactJoins: true,
      directMessages: true,
      recTopics: true,
      recGeneral: true,
      newFeatures: true,
      setSetting: (key, value) => set({ [key]: value }),
    }),
    {
      name: 'yewi_notification_settings_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
