import { api } from './client';
import type {
  AuthResponse,
  AuthorStatusFeedGroup,
  BudgetBenchmarkApiResponse,
  CategoryNode,
  ChatMessage,
  CheckAvailabilityResult,
  ContactItem,
  ConversationDetail,
  ConversationItem,
  CreditPackageInfo,
  GigDetail,
  MessageReaction,
  NotificationItem,
  OrderItem,
  PortfolioItem,
  ProfessionalSummary,
  PromotionItem,
  QuoteProposalItem,
  ReviewItem,
  ServiceRequestItem,
  StatusCommentItem,
  SubscriptionStatusResponse,
  UserMe,
  UserRole,
  WalletData,
} from './types';

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      sp.append(key, String(val));
    }
  });
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export const authApi = {
  checkAvailability: (dto: {
    email?: string;
    phoneNumber?: string;
    country?: string;
    taxId?: string;
  }) =>
    api.post<CheckAvailabilityResult>('/auth/check-availability', dto, {
      skipAuth: true,
    }),

  login: (dto: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', dto, { skipAuth: true }),

  register: (dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roles?: UserRole[];
    phoneNumber?: string;
    country?: string;
    taxId?: string;
    businessName?: string;
    bio?: string;
    city?: string;
    postalCode?: string;
    address?: string;
    hourlyRate?: number;
    serviceRadiusKm?: number;
    skills?: string[];
  }) => api.post<AuthResponse>('/auth/register', dto, { skipAuth: true }),

  googleLogin: (dto: {
    idToken: string;
    name?: string;
    avatarUrl?: string;
    roles?: UserRole[];
  }) => api.post<AuthResponse>('/auth/google', dto, { skipAuth: true }),

  sendPhoneOtp: (phoneNumber: string) =>
    api.post<{ success: boolean; phoneNumber: string; message: string; devCode?: string }>(
      '/auth/phone/send-otp',
      { phoneNumber },
      { skipAuth: true },
    ),

  verifyPhoneOtp: (dto: {
    phoneNumber: string;
    code: string;
    roles?: UserRole[];
    firstName?: string;
    lastName?: string;
  }) => api.post<AuthResponse>('/auth/phone/verify-otp', dto, { skipAuth: true }),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }, { skipAuth: true }),

  ensureClerkRedirectUrl: (
    redirectUrl: string,
    appRedirectUrl?: string,
    bounceUrl?: string,
  ) =>
    api.post<{ registered: boolean; url: string; bounceUrl?: string }>(
      '/auth/clerk/redirect-url',
      { redirectUrl, appRedirectUrl, bounceUrl },
      { skipAuth: true },
    ),

  watchClerkOAuth: (dto: {
    clientId: string;
    signInId?: string;
    roles?: UserRole[];
  }) =>
    api.post<{
      completed: boolean;
      sessionId: string | null;
      rotatingTokenNonce: string | null;
      auth: AuthResponse | null;
    }>('/auth/clerk/watch-oauth', dto, {
      skipAuth: true,
      timeoutMs: 28_000,
    }),

  logout: () => api.post<{ success: boolean }>('/auth/logout'),
};

export const usersApi = {
  getMe: () => api.get<UserMe>('/users/me'),
  updateProfile: (dto: Partial<{
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string;
    phoneNumber: string;
    country: string;
    region: string;
    province: string;
    city: string;
    postalCode: string;
    address: string;
    bio: string;
  }>) => api.patch('/users/me/profile', dto),
  deleteAccount: () => api.delete<{ success: boolean }>('/users/me'),
};

export const categoriesApi = {
  getTree: () => api.get<CategoryNode[]>('/categories/tree', { skipAuth: true }),
  getByIdentifier: (identifier: string) =>
    api.get<CategoryNode>(`/categories/${encodeURIComponent(identifier)}`, {
      skipAuth: true,
    }),
};

export const gigsApi = {
  list: (filters: {
    search?: string;
    category?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    deliveryDays?: number;
    minRating?: number;
    limit?: number;
    page?: number;
  } = {}) => api.get<GigDetail[]>(`/gigs${qs(filters)}`, { skipAuth: true }),

  myGigs: () => api.get<GigDetail[]>('/gigs/my-gigs'),

  getBySlugOrId: (slugOrId: string) =>
    api.get<GigDetail>(`/gigs/${encodeURIComponent(slugOrId)}`, {
      skipAuth: true,
    }),

  create: (dto: {
    title: string;
    category?: string;
    categoryId?: string;
    description: string;
    price?: number;
    deliveryDays?: number;
    city?: string;
    coverImages?: string[];
    searchTags?: string[];
    packages?: {
      tier: string;
      name: string;
      description: string;
      price: number;
      deliveryDays: number;
      revisions: number;
      features?: unknown;
      isPopular?: boolean;
    }[];
  }) => api.post<GigDetail>('/gigs', dto),

  update: (id: string, dto: Record<string, unknown>) =>
    api.patch<GigDetail>(`/gigs/${encodeURIComponent(id)}`, dto),

  remove: (id: string) =>
    api.delete<{ success: boolean }>(`/gigs/${encodeURIComponent(id)}`),
};

export const professionalsApi = {
  search: (filters: {
    q?: string;
    category?: string;
    city?: string;
    province?: string;
    skill?: string;
    lat?: number;
    lon?: number;
    radiusKm?: number;
    limit?: number;
    offset?: number;
  } = {}) =>
    api.get<{
      items: ProfessionalSummary[];
      total: number;
      limit: number;
      offset: number;
    }>(`/professionals${qs(filters)}`, { skipAuth: true }),

  nearby: (lat: number, lon: number, categoryId?: string, skill?: string) =>
    api.get<ProfessionalSummary[]>(
      `/professionals/nearby${qs({ lat, lon, categoryId, skill })}`,
      { skipAuth: true },
    ),

  getPublicProfile: (id: string) =>
    api.get<ProfessionalSummary>(`/professionals/${encodeURIComponent(id)}`, {
      skipAuth: true,
    }),

  getMyProfile: () => api.get<ProfessionalSummary>('/professionals/me'),

  updateMyProfile: (dto: {
    businessName?: string;
    taxId?: string;
    bio?: string;
    hourlyRate?: number;
    serviceRadiusKm?: number;
    latitude?: number;
    longitude?: number;
    city?: string;
    postalCode?: string;
    country?: string;
    region?: string;
    province?: string;
    address?: string;
    skills?: string[];
    categoryIds?: string[];
  }) => api.put<ProfessionalSummary>('/professionals/me', dto),

  addPortfolioItem: (dto: {
    title: string;
    description: string;
    imageUrls: string[];
    projectUrl?: string;
    tags?: string[];
  }) => api.post<PortfolioItem>('/professionals/me/portfolio', dto),

  uploadPortfolioImage: (image: string) =>
    api.post<{ url: string }>('/professionals/me/portfolio/upload', { image }),

  deletePortfolioItem: (itemId: string) =>
    api.delete<{ success: boolean }>(
      `/professionals/me/portfolio/${encodeURIComponent(itemId)}`,
    ),

  submitKyc: (documentUrl: string) =>
    api.post('/professionals/me/kyc', { documentUrl }),
};

export const proToolsApi = {
  getBudgetBenchmark: (dto: {
    templateKey?: string;
    itemTitle?: string;
    unit?: string;
    province?: string;
    quantity?: number;
  }) =>
    api.post<BudgetBenchmarkApiResponse>(
      '/professionals/tools/budget-benchmark',
      dto,
    ),
};

export const leadsApi = {
  createRequest: (dto: {
    categoryId?: string;
    category?: string;
    title: string;
    description: string;
    questionnaireAnswers?: Record<string, unknown>;
    budgetEstimated?: number;
    budgetMin?: number;
    budgetMax?: number;
    city?: string;
    postalCode?: string;
    address?: string;
    isUrgent?: boolean;
  }) => api.post<ServiceRequestItem>('/leads/requests', dto),

  myRequests: () => api.get<ServiceRequestItem[]>('/leads/my-requests'),

  opportunities: (filters: {
    category?: string;
    categoryId?: string;
    city?: string;
    isUrgent?: boolean;
    onlyMatchingMyRadius?: boolean;
  } = {}) =>
    api.get<ServiceRequestItem[]>(`/leads/opportunities${qs(filters)}`),

  getRequestById: (id: string) =>
    api.get<ServiceRequestItem>(`/leads/requests/${encodeURIComponent(id)}`),

  unlockLead: (requestId: string) =>
    api.post(`/leads/requests/${encodeURIComponent(requestId)}/unlock`),

  sendProposal: (
    requestId: string,
    dto: { price: number; estimatedDays: number; message: string },
  ) =>
    api.post<QuoteProposalItem>(
      `/leads/requests/${encodeURIComponent(requestId)}/proposals`,
      dto,
    ),

  myProposals: () => api.get<QuoteProposalItem[]>('/leads/my-proposals'),

  acceptProposal: (proposalId: string) =>
    api.post<OrderItem>(
      `/leads/proposals/${encodeURIComponent(proposalId)}/accept`,
    ),

  createLeadCheckout: (proposalId: string) =>
    api.post<{ sessionId: string; url: string }>(
      `/leads/proposals/${encodeURIComponent(proposalId)}/checkout`,
    ),

  deleteRequest: (requestId: string) =>
    api.delete<{ success: boolean }>(
      `/leads/requests/${encodeURIComponent(requestId)}`,
    ),
};

export const ordersApi = {
  myOrders: (role?: 'client' | 'pro') =>
    api.get<OrderItem[]>(`/orders${qs({ role })}`),

  getById: (orderId: string) =>
    api.get<OrderItem>(`/orders/${encodeURIComponent(orderId)}`),

  createGigOrder: (dto: {
    gigPackageId: string;
    gigId?: string;
    extraIds?: string[];
    requirementsAnswers?: Record<string, unknown>;
  }) => api.post<OrderItem>('/orders/gig', dto),

  createGigCheckout: (dto: {
    gigPackageId: string;
    gigId?: string;
    extraIds?: string[];
    requirementsAnswers?: Record<string, unknown>;
  }) =>
    api.post<{ sessionId: string; url: string }>(
      '/orders/gig/checkout-session',
      dto,
    ),

  confirmGigCheckout: (sessionId: string) =>
    api.post<OrderItem>('/orders/gig/confirm-checkout', { sessionId }),

  submitDelivery: (
    orderId: string,
    dto: { message: string; attachmentUrls: string[] },
  ) =>
    api.post(`/orders/${encodeURIComponent(orderId)}/deliveries`, dto),

  requestRevision: (orderId: string, revisionNotes: string) =>
    api.post(`/orders/${encodeURIComponent(orderId)}/revisions`, {
      revisionNotes,
    }),

  approveDelivery: (orderId: string) =>
    api.post(`/orders/${encodeURIComponent(orderId)}/approve`),

  cancelOrder: (orderId: string, reason?: string) =>
    api.post(`/orders/${encodeURIComponent(orderId)}/cancel`, { reason }),
};

export const walletApi = {
  getPackages: () =>
    api.get<CreditPackageInfo[]>('/wallet/packages', { skipAuth: true }),
  getMe: () => api.get<WalletData>('/wallet/me'),
  topupCheckout: (amount: number) =>
    api.post<{ sessionId: string; url: string }>('/wallet/topup', { amount }),
  requestPayout: (amount: number, destinationAccount: string) =>
    api.post<{ success: boolean; message: string }>('/wallet/request-payout', {
      amount,
      destinationAccount,
    }),
};

export interface IapProductItem {
  productId: string;
  purchaseType: 'SUBSCRIPTION' | 'WALLET_TOPUP' | 'GIG_ORDER' | 'LEAD_PROPOSAL';
  title: string;
  priceEur?: number;
  amountEur?: number;
  interval?: 'month';
}

export interface VerifyIapPurchasePayload {
  platform: 'ios' | 'android';
  purchaseType: 'SUBSCRIPTION' | 'WALLET_TOPUP' | 'GIG_ORDER' | 'LEAD_PROPOSAL';
  productId: string;
  transactionId: string;
  receiptData: string;
  amount?: number;
  gigId?: string;
  gigPackageId?: string;
  extraIds?: string[];
  proposalId?: string;
}

export const paymentsApi = {
  getSubscription: () =>
    api.get<SubscriptionStatusResponse>('/payments/subscription'),
  syncSubscription: () =>
    api.post<SubscriptionStatusResponse>('/payments/subscription/sync'),
  createSubscriptionCheckout: () =>
    api.post<{ sessionId: string; url: string }>(
      '/payments/subscription/checkout',
    ),
  createCustomerPortal: () =>
    api.post<{ url: string }>('/payments/subscription/portal'),
  cancelAutoRenew: () =>
    api.post<{ success: boolean; message: string; cancelAtPeriodEnd: boolean }>(
      '/payments/subscription/cancel',
    ),
  resumeAutoRenew: () =>
    api.post<{ success: boolean; message: string; cancelAtPeriodEnd: boolean }>(
      '/payments/subscription/resume',
    ),
  getIapProducts: () =>
    api.get<{ products: IapProductItem[] }>('/payments/iap/products', {
      skipAuth: true,
    }),
  verifyIapPurchase: (dto: VerifyIapPurchasePayload) =>
    api.post<{ verified: boolean; duplicate?: boolean; result?: unknown }>(
      '/payments/iap/verify',
      dto,
    ),
  restoreIapPurchases: (receipts?: VerifyIapPurchasePayload[]) =>
    api.post<SubscriptionStatusResponse>('/payments/iap/restore', {
      receipts,
    }),
  createRedsysBizumCheckout: (dto: CreateRedsysBizumPayload) =>
    api.post<RedsysBizumCheckoutResponse>('/payments/redsys/bizum/checkout', dto),
  getRedsysPaymentStatus: (orderRef: string) =>
    api.get<RedsysPaymentStatusResponse>(
      `/payments/redsys/status/${encodeURIComponent(orderRef)}`,
    ),
};

export interface CreateRedsysBizumPayload {
  purchaseType: 'GIG_ORDER' | 'LEAD_PROPOSAL';
  gigId?: string;
  gigPackageId?: string;
  extraIds?: string[];
  proposalId?: string;
}

export interface RedsysBizumCheckoutResponse {
  orderRef: string;
  amount: number;
  launchUrl: string;
  redsysUrl: string;
}

export interface RedsysPaymentStatusResponse {
  orderRef: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  amount: number;
  orderId?: string;
  orderNumber?: string;
  errorMessage?: string;
}

export const chatApi = {
  getStreamToken: () =>
    api.get<{
      apiKey: string;
      token: string;
      userId: string;
      user: { id: string; name: string; image?: string | null; isPro?: boolean };
    }>('/chat/stream-token'),
  getContacts: () => api.get<ContactItem[]>('/chat/contacts'),
  getConversations: () => api.get<ConversationItem[]>('/chat/conversations'),
  getMessages: (conversationId: string) =>
    api.get<ConversationDetail>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    ),
  sendMessage: (dto: {
    conversationId: string;
    content: string;
    type?: 'TEXT' | 'ATTACHMENT' | 'CUSTOM_OFFER' | 'SYSTEM_EVENT';
    attachments?: string[];
    metadata?: Record<string, unknown>;
  }) => api.post<ChatMessage>('/chat/messages', dto),
  toggleReaction: (messageId: string, emoji: string) =>
    api.post<{
      messageId: string;
      conversationId: string;
      reactions: MessageReaction[];
    }>(`/chat/messages/${encodeURIComponent(messageId)}/reaction`, { emoji }),
  editMessage: (messageId: string, content: string) =>
    api.patch<ChatMessage>(
      `/chat/messages/${encodeURIComponent(messageId)}`,
      { content },
    ),
  deleteMessages: (messageIds: string[]) =>
    api.delete<{ deletedIds: string[] }>('/chat/messages', { messageIds }),
  uploadAttachment: (dto: {
    file: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
  }) => api.post<{ url: string; name: string; type: string }>('/chat/upload', dto),
};

export const notificationsApi = {
  list: () => api.get<NotificationItem[]>('/notifications'),
  unreadCount: () =>
    api.get<{ unreadCount: number; count: number }>(
      '/notifications/unread-count',
    ),
  markRead: (id: string) =>
    api.patch(`/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  deleteOne: (id: string) =>
    api.delete(`/notifications/${encodeURIComponent(id)}`),
  clearAll: () => api.delete('/notifications/clear-all'),
};

export const reviewsApi = {
  byProfessional: (proId: string) =>
    api.get<ReviewItem[]>(
      `/reviews/professional/${encodeURIComponent(proId)}`,
      { skipAuth: true },
    ),
  byUser: (userId: string) =>
    api.get<ReviewItem[]>(`/reviews/user/${encodeURIComponent(userId)}`, {
      skipAuth: true,
    }),
  create: (dto: {
    orderId?: string;
    professionalProfileId?: string;
    rating: number;
    qualityRating?: number;
    communicationRating?: number;
    deliveryRating?: number;
    comment: string;
  }) => api.post<ReviewItem>('/reviews', dto),
  reply: (reviewId: string, reply: string) =>
    api.post<ReviewItem>(
      `/reviews/${encodeURIComponent(reviewId)}/reply`,
      { reply },
    ),
};

export const promotionsApi = {
  active: (category?: string) =>
    api.get<PromotionItem[]>(`/promotions${qs({ category })}`, {
      skipAuth: true,
    }),
  myPromotions: () => api.get<PromotionItem[]>('/promotions/my-promotions'),
  create: (dto: {
    title: string;
    description: string;
    discountPercent?: number;
    discountAmount?: number;
    promoCode?: string;
    category?: string;
    badge?: string;
    isPermanent?: boolean;
    expiresAt?: string;
  }) => api.post<PromotionItem>('/promotions', dto),
  remove: (id: string) =>
    api.delete<{ success: boolean }>(
      `/promotions/${encodeURIComponent(id)}`,
    ),
};

export const statusesApi = {
  feed: () => api.get<AuthorStatusFeedGroup[]>('/statuses/feed'),
  create: (dto: {
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'TEXT';
    caption?: string;
    backgroundColor?: string;
  }) => api.post('/statuses', dto),
  addComment: (statusId: string, content: string) =>
    api.post<StatusCommentItem>(
      `/statuses/${encodeURIComponent(statusId)}/comments`,
      { content },
    ),
  react: (statusId: string, reactionType = 'LIKE') =>
    api.post<{ reacted: boolean; reactionType: string | null }>(
      `/statuses/${encodeURIComponent(statusId)}/react`,
      { reactionType },
    ),
  remove: (statusId: string) =>
    api.delete(`/statuses/${encodeURIComponent(statusId)}`),
};
