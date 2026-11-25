export const qk = {
  me: () => ['users', 'me'] as const,
  wallet: () => ['wallet', 'me'] as const,
  creditPackages: () => ['wallet', 'packages'] as const,
  subscription: () => ['payments', 'subscription'] as const,
  categories: () => ['categories', 'tree'] as const,
  category: (idOrSlug: string) => ['categories', idOrSlug] as const,
  gigs: (filters?: Record<string, unknown>) =>
    ['gigs', 'list', filters ?? {}] as const,
  myGigs: () => ['gigs', 'mine'] as const,
  gig: (slugOrId: string) => ['gigs', 'detail', slugOrId] as const,
  professionals: (filters?: Record<string, unknown>) =>
    ['professionals', 'search', filters ?? {}] as const,
  myProProfile: () => ['professionals', 'me'] as const,
  proPublic: (id: string) => ['professionals', 'detail', id] as const,
  proNearby: (lat: number, lon: number, categoryId?: string) =>
    ['professionals', 'nearby', lat, lon, categoryId ?? ''] as const,
  myRequests: () => ['leads', 'my-requests'] as const,
  opportunities: (filters?: Record<string, unknown>) =>
    ['leads', 'opportunities', filters ?? {}] as const,
  request: (id: string) => ['leads', 'request', id] as const,
  myProposals: () => ['leads', 'my-proposals'] as const,
  orders: (role?: string) => ['orders', 'list', role ?? 'all'] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  conversations: () => ['chat', 'conversations'] as const,
  messages: (id: string) => ['chat', 'messages', id] as const,
  contacts: () => ['chat', 'contacts'] as const,
  statuses: () => ['statuses', 'feed'] as const,
  promotions: (category?: string) =>
    ['promotions', 'active', category ?? 'all'] as const,
  myPromotions: () => ['promotions', 'mine'] as const,
  notifications: () => ['notifications', 'list'] as const,
  unreadCount: () => ['notifications', 'unread'] as const,
  reviewsByPro: (proId: string) => ['reviews', 'pro', proId] as const,
  reviewsByUser: (userId: string) => ['reviews', 'user', userId] as const,
};
