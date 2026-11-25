import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { biometricService } from '@/lib/biometricService';
import { queryClient } from '@/lib/queryClient';
import { clearSession, saveCachedUser, saveTokens } from '@/lib/session';
import { usePreferencesStore } from '@/lib/stores';
import { qk } from './keys';
import {
  authApi,
  categoriesApi,
  chatApi,
  gigsApi,
  leadsApi,
  notificationsApi,
  ordersApi,
  paymentsApi,
  professionalsApi,
  promotionsApi,
  proToolsApi,
  reviewsApi,
  statusesApi,
  usersApi,
  walletApi,
} from './services';
import type { AuthResponse, UserMe, UserRole } from './types';

function syncActiveRole(user: UserMe) {
  const isPro = Boolean(
    user.roles?.includes('PROFESSIONAL') || user.professionalProfile,
  );
  usePreferencesStore
    .getState()
    .setActiveRole(isPro ? 'PROFESSIONAL' : 'CLIENT');
}

async function persistAuth(res: AuthResponse) {
  await saveTokens(res.accessToken, res.refreshToken);
  await saveCachedUser(res.user);
  syncActiveRole(res.user);
  queryClient.setQueryData(qk.me(), res.user);
  if (usePreferencesStore.getState().biometricEnabled) {
    void biometricService.syncCurrentSessionIfEnabled(res.user);
  }
  return res;
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: qk.me(),
    queryFn: async () => {
      const me = await usersApi.getMe();
      await saveCachedUser(me);
      syncActiveRole(me);
      return me;
    },
    enabled,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: persistAuth,
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: persistAuth,
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: authApi.googleLogin,
    onSuccess: persistAuth,
  });
}

export function useVerifyPhoneOtp() {
  return useMutation({
    mutationFn: authApi.verifyPhoneOtp,
    onSuccess: persistAuth,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const keepRefreshForBiometric =
        usePreferencesStore.getState().biometricEnabled &&
        (await biometricService.hasSavedCredentials());

      if (!keepRefreshForBiometric) {
        try {
          await authApi.logout();
        } catch {
          // El cierre local siempre limpia sesión aunque falle la red
        }
      }
      await clearSession();
    },
    onSettled: () => {
      qc.clear();
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me() });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await usersApi.deleteAccount();
      await clearSession();
      return res;
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories(),
    queryFn: categoriesApi.getTree,
  });
}

export function useGigs(filters: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: qk.gigs(filters),
    queryFn: () => gigsApi.list(filters),
  });
}

export function useMyGigs(enabled = true) {
  return useQuery({
    queryKey: qk.myGigs(),
    queryFn: gigsApi.myGigs,
    enabled,
  });
}

export function useGig(slugOrId: string) {
  return useQuery({
    queryKey: qk.gig(slugOrId),
    queryFn: () => gigsApi.getBySlugOrId(slugOrId),
    enabled: Boolean(slugOrId),
  });
}

export function useCreateGig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gigsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}

export function useUpdateGig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      gigsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}

export function useDeleteGig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gigsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}

export function useProfessionals(filters: {
  q?: string;
  category?: string;
  city?: string;
  province?: string;
  skill?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return useQuery({
    queryKey: qk.professionals(filters),
    queryFn: () => professionalsApi.search(filters),
  });
}

export function usePublicPro(id: string) {
  return useQuery({
    queryKey: qk.proPublic(id),
    queryFn: () => professionalsApi.getPublicProfile(id),
    enabled: Boolean(id),
  });
}

export function useMyProProfile(enabled = true) {
  return useQuery({
    queryKey: qk.myProProfile(),
    queryFn: professionalsApi.getMyProfile,
    enabled,
  });
}

export function useUpdateProProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: professionalsApi.updateMyProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me() });
      qc.invalidateQueries({ queryKey: qk.myProProfile() });
      qc.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}

export function useAddPortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: professionalsApi.addPortfolioItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myProProfile() });
      qc.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
}

export function useDeletePortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: professionalsApi.deletePortfolioItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myProProfile() });
    },
  });
}

export function useSubmitKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: professionalsApi.submitKyc,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myProProfile() });
      qc.invalidateQueries({ queryKey: qk.me() });
    },
  });
}

export function useBudgetBenchmark() {
  return useMutation({
    mutationFn: proToolsApi.getBudgetBenchmark,
  });
}

export function useMyRequests(enabled = true) {
  return useQuery({
    queryKey: qk.myRequests(),
    queryFn: leadsApi.myRequests,
    enabled,
  });
}

export function useOpportunities(
  filters: Record<string, unknown> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: qk.opportunities(filters),
    queryFn: () => leadsApi.opportunities(filters),
    enabled,
  });
}

export function useMyProposals(enabled = true) {
  return useQuery({
    queryKey: qk.myProposals(),
    queryFn: leadsApi.myProposals,
    enabled,
  });
}

export function useRequestDetail(id: string) {
  return useQuery({
    queryKey: qk.request(id),
    queryFn: () => leadsApi.getRequestById(id),
    enabled: Boolean(id),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadsApi.createRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUnlockLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadsApi.unlockLead,
    onSuccess: (_res, requestId) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: qk.request(requestId) });
      qc.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}

export function useSendProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      ...dto
    }: {
      requestId: string;
      price: number;
      estimatedDays: number;
      message: string;
    }) => leadsApi.sendProposal(requestId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useAcceptProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadsApi.acceptProposal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: qk.wallet() });
      qc.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leadsApi.deleteRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useOrders(role?: 'client' | 'pro', enabled = true) {
  return useQuery({
    queryKey: qk.orders(role),
    queryFn: () => ordersApi.myOrders(role),
    enabled,
  });
}

export function useCreateGigOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.createGigOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: qk.wallet() });
      qc.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}

export function useApproveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.approveDelivery,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: qk.wallet() });
    },
  });
}

export function useWallet(enabled = true) {
  return useQuery({
    queryKey: qk.wallet(),
    queryFn: walletApi.getMe,
    enabled,
  });
}

export function useSubscription(enabled = true) {
  return useQuery({
    queryKey: qk.subscription(),
    queryFn: paymentsApi.getSubscription,
    enabled,
  });
}

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: qk.conversations(),
    queryFn: chatApi.getConversations,
    enabled,
  });
}

export function useContacts(enabled = true) {
  return useQuery({
    queryKey: qk.contacts(),
    queryFn: chatApi.getContacts,
    enabled,
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: qk.messages(conversationId),
    queryFn: () => chatApi.getMessages(conversationId),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: chatApi.sendMessage,
    onSuccess: (_msg, vars) => {
      qc.invalidateQueries({ queryKey: qk.messages(vars.conversationId) });
      qc.invalidateQueries({ queryKey: qk.conversations() });
    },
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: notificationsApi.list,
    enabled,
  });
}

export function useUnreadNotificationsCount(enabled = true) {
  return useQuery({
    queryKey: qk.unreadCount(),
    queryFn: notificationsApi.unreadCount,
    enabled,
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications() });
      qc.invalidateQueries({ queryKey: qk.unreadCount() });
    },
  });
}

export function useActivePromotions(category?: string) {
  return useQuery({
    queryKey: qk.promotions(category),
    queryFn: () => promotionsApi.active(category),
  });
}

export function useStatusesFeed(enabled = true) {
  return useQuery({
    queryKey: qk.statuses(),
    queryFn: statusesApi.feed,
    enabled,
  });
}

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: statusesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.statuses() });
    },
  });
}

export function useUserReviews(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ['reviews', 'user', userId] as const,
    queryFn: () => reviewsApi.byUser(userId!),
    enabled: enabled && Boolean(userId),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reviewsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['professionals'] });
      qc.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}

export type RoleMode = Extract<UserRole, 'CLIENT' | 'PROFESSIONAL'>;
