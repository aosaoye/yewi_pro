export type UserRole = 'CLIENT' | 'PROFESSIONAL' | 'ADMIN';

export interface ProfileData {
  firstName: string;
  lastName: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  country?: string | null;
  region?: string | null;
  province?: string | null;
  city?: string | null;
  postalCode?: string | null;
  address?: string | null;
  bio?: string | null;
}

export interface ProfessionalSummary {
  id: string;
  userId?: string;
  businessName?: string | null;
  taxId?: string | null;
  bio?: string | null;
  isPro?: boolean;
  hourlyRate?: number | null;
  serviceRadiusKm?: number;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  postalCode?: string | null;
  address?: string | null;
  country?: string | null;
  kycStatus?: string;
  badges?: string[];
  avgRating?: number;
  totalReviews?: number;
  completedOrdersCount?: number;
  skills?: string[];
  categories?: CategoryNode[];
  portfolioItems?: PortfolioItem[];
  gigs?: GigDetail[];
  reviews?: ReviewItem[];
  distanceKm?: number;
  user?: {
    id?: string;
    isPro?: boolean;
    profile?: Partial<ProfileData> | null;
  } | null;
}

export interface WalletData {
  id: string;
  userId: string;
  creditBalance: number;
  fiatPendingBalance: number;
  fiatAvailableBalance: number;
  currency: string;
  transactions?: TransactionItem[];
}

export interface SubscriptionData {
  id: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionStatusResponse {
  isPro: boolean;
  plan: string;
  priceEur: number;
  interval: string;
  subscription: SubscriptionData | null;
}

export interface UserMe {
  id: string;
  email: string;
  roles: UserRole[];
  isActive: boolean;
  isEmailVerified: boolean;
  isPro: boolean;
  profile?: ProfileData | null;
  professionalProfile?: ProfessionalSummary | null;
  wallet?: WalletData | null;
  subscription?: SubscriptionData | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: UserMe;
  accessToken: string;
  refreshToken: string;
}

export interface FieldAvailability {
  available: boolean;
  message: string;
  formatted?: string;
}

export interface CheckAvailabilityResult {
  email?: FieldAvailability;
  phoneNumber?: FieldAvailability;
  taxId?: FieldAvailability;
}

export interface CategoryNode {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  bannerUrl?: string | null;
  type?: 'GIG' | 'LEAD' | 'HYBRID';
  formSchema?: Record<string, any> | null;
  baseLeadCreditCost?: number;
  children?: CategoryNode[];
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  projectUrl?: string | null;
  tags?: string[];
  createdAt?: string;
}

export interface GigPackage {
  id: string;
  tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | string;
  name: string;
  description: string;
  price: number;
  deliveryDays: number;
  revisions: number;
  features?: unknown;
  isPopular?: boolean;
}

export interface GigExtra {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  additionalDeliveryDays?: number;
}

export interface GigDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  searchTags?: string[];
  coverImages?: string[];
  videoUrl?: string | null;
  faqs?: { question: string; answer: string }[] | unknown;
  requirements?: string[];
  status?: string;
  avgRating?: number;
  totalReviews?: number;
  ordersCount?: number;
  isFeatured?: boolean;
  category?: { id?: string; name?: string; slug?: string } | null;
  packages: GigPackage[];
  extras?: GigExtra[];
  professionalProfile?: ProfessionalSummary;
  reviews?: ReviewItem[];
}

export interface ReviewReplyItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  comment: string;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  orderId?: string | null;
  professionalProfileId?: string | null;
  gigId?: string | null;
  authorId?: string;
  targetUserId?: string;
  rating: number;
  qualityRating?: number;
  communicationRating?: number;
  deliveryRating?: number;
  comment: string;
  sellerReply?: string | null;
  sellerRepliedAt?: string | null;
  replies?: ReviewReplyItem[] | null;
  createdAt: string;
  author?: {
    id?: string;
    profile?: Partial<ProfileData> | null;
  } | null;
}

export interface ServiceRequestItem {
  id: string;
  clientId: string;
  categoryId?: string;
  category?: CategoryNode | null;
  title: string;
  description: string;
  questionnaireAnswers?: Record<string, any>;
  budgetMin?: number | null;
  budgetMax?: number | null;
  isUrgent?: boolean;
  city: string;
  postalCode?: string;
  address?: string | null;
  status: string;
  unlocksCount?: number;
  maxUnlocks?: number;
  isUnlocked?: boolean;
  distanceKm?: number | null;
  client?: {
    id: string;
    email?: string;
    profile?: Partial<ProfileData> | null;
  };
  proposals?: QuoteProposalItem[];
  orders?: OrderItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface QuoteProposalItem {
  id: string;
  serviceRequestId: string;
  professionalProfileId: string;
  price: number;
  estimatedDays: number;
  message: string;
  breakdown?: Record<string, any> | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN' | string;
  createdAt: string;
  professionalProfile?: ProfessionalSummary;
  serviceRequest?: ServiceRequestItem;
}

export interface OrderDeliveryItem {
  id: string;
  orderId: string;
  deliveryNumber: number;
  message: string;
  attachmentUrls: string[];
  isAccepted: boolean;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderNumber: string;
  clientId: string;
  professionalProfileId: string;
  orderType: string;
  status: string;
  subtotal: number;
  platformFee: number;
  totalAmount: number;
  proEarnings: number;
  escrowStatus: string;
  deliveryDeadline: string;
  createdAt: string;
  gig?: GigDetail | null;
  gigPackage?: GigPackage | null;
  serviceRequest?: ServiceRequestItem | null;
  deliveries?: OrderDeliveryItem[];
  review?: ReviewItem | null;
  conversation?: { id: string } | null;
  client?: { id: string; profile?: Partial<ProfileData> | null };
  professionalProfile?: ProfessionalSummary;
}

export interface CreditPackageInfo {
  id: string;
  name: string;
  credits: number;
  priceEur: number;
  popular: boolean;
}

export interface TransactionItem {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  creditAmount?: number | null;
  currency: string;
  status: string;
  referenceId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface ChatParticipant {
  id: string;
  email?: string;
  displayName?: string;
  name?: string;
  avatarUrl?: string | null;
  businessName?: string | null;
  isPro?: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  city?: string | null;
  rating?: number;
  totalReviews?: number;
  completedOrdersCount?: number;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'ATTACHMENT' | 'CUSTOM_OFFER' | 'SYSTEM_EVENT';
  content: string;
  attachments?: string[];
  metadata?: {
    reactions?: MessageReaction[];
    [key: string]: any;
  } | null;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    profile?: Partial<ProfileData> | null;
  };
}

export interface ConversationItem {
  id: string;
  orderId?: string | null;
  serviceRequestId?: string | null;
  participantAId: string;
  participantBId: string;
  lastMessageAt?: string | null;
  unreadCount?: number;
  otherParticipant?: ChatParticipant | null;
  lastMessage?: ChatMessage | null;
  order?: Partial<OrderItem> | null;
  serviceRequest?: Partial<ServiceRequestItem> | null;
}

export interface ConversationDetail {
  conversationId: string;
  orderId?: string;
  serviceRequestId?: string;
  otherParticipant?: ChatParticipant;
  order?: Partial<OrderItem>;
  serviceRequest?: Partial<ServiceRequestItem>;
  messages: ChatMessage[];
}

export interface ContactItem {
  id: string;
  email?: string;
  roles: string[];
  isPro: boolean;
  displayName: string;
  businessName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  city?: string | null;
  category?: string | null;
  rating: number;
  totalReviews: number;
  conversationId?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  hasExistingConversation?: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PromotionItem {
  id: string;
  title: string;
  description: string;
  discountPercent?: number | null;
  discountAmount?: number | null;
  promoCode?: string | null;
  category?: string | null;
  badge?: string | null;
  expiresAt: string;
  professional?: {
    id: string;
    userId: string;
    name: string;
    avatarUrl?: string | null;
    city?: string | null;
    avgRating?: number;
    totalReviews?: number;
    isPro?: boolean;
  };
}

export interface StatusCommentItem {
  id: string;
  statusId?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  createdAt: string;
}

export interface StatusItem {
  id: string;
  authorId: string;
  mediaUrl: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'TEXT';
  caption: string | null;
  backgroundColor?: string | null;
  viewCount: number;
  expiresAt: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  myReaction: string | null;
  comments: StatusCommentItem[];
}

export interface AuthorStatusFeedGroup {
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  businessName: string | null;
  isPro: boolean;
  category: string | null;
  hasUnseen: boolean;
  latestStatusCreatedAt: string;
  statuses: StatusItem[];
}

export type BudgetUnit = 'm²' | 'ml' | 'ud' | 'h' | 'pa';

export interface BudgetItemModel {
  id: string;
  title: string;
  description?: string;
  unit: BudgetUnit;
  quantity: number;
  unitPrice: number;
  laborPercent?: number;
  materialPercent?: number;
  laborCost?: number;
  materialCost?: number;
  subtotal: number;
}

export interface BudgetTemplateSummary {
  key: string;
  title: string;
  shortDesc: string;
  category: string;
  icon: string;
  estimatedDays: number;
  itemCount?: number;
}

export interface BudgetBenchmarkApiResponse {
  mode?: 'template' | 'item_benchmark';
  province?: string;
  provinceFactor?: number;
  marketSource?: string;
  template?: {
    key: string;
    title: string;
    shortDesc: string;
    category: string;
    icon: string;
    estimatedDays: number;
    tradeTip?: string;
    estimatedTotal?: number;
    items: (BudgetItemModel & {
      averagePrice: number;
      minPrice: number;
      maxPrice: number;
      defaultQuantity?: number;
      tradeCategory?: string;
    })[];
  };
  availableTemplates?: BudgetTemplateSummary[];
  itemTitle?: string;
  unit?: BudgetUnit;
  quantity?: number;
  averagePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  laborCost?: number;
  materialCost?: number;
  laborPercent?: number;
  materialPercent?: number;
  tradeCategory?: string;
  confidenceScore?: number;
  recommendation?: string;
}
