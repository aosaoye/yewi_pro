import { Linking, NativeModules, Platform } from 'react-native';
import {
  paymentsApi,
  type VerifyIapPurchasePayload,
} from '@/api/services';
import type { OrderItem } from '@/api/types';

export const IAP_PRODUCTS = {
  PRO_MONTHLY: 'yewi_pro_monthly',
  WALLET_20: 'yewi_wallet_20',
  WALLET_50: 'yewi_wallet_50',
  WALLET_100: 'yewi_wallet_100',
  SERVICE_ORDER: 'yewi_service_order',
} as const;

interface StorePurchaseResult {
  transactionId?: string;
  transactionReceipt?: string;
  purchaseToken?: string;
  productId?: string;
}

interface NativeIapBridge {
  initConnection?: () => Promise<unknown>;
  requestSubscription?: (params: { sku: string }) => Promise<StorePurchaseResult>;
  requestPurchase?: (params: {
    sku?: string;
    skus?: string[];
  }) => Promise<StorePurchaseResult | StorePurchaseResult[]>;
  getAvailablePurchases?: () => Promise<StorePurchaseResult[]>;
}

function getNativeIapBridge(): NativeIapBridge | null {
  if (Platform.OS === 'web') return null;
  const mods = NativeModules as Record<string, NativeIapBridge | undefined>;
  return mods.ExpoIap ?? mods.RNIapIos ?? mods.RNIapModule ?? null;
}

function resolvePlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

async function performStorePurchase(
  productId: string,
  kind: 'subscription' | 'product',
): Promise<{ transactionId: string; receiptData: string }> {
  const bridge = getNativeIapBridge();
  if (!bridge) {
    throw new Error(
      'Las compras integradas (App Store / Google Play) requieren una compilación nativa (EAS Build).',
    );
  }

  if (bridge.initConnection) {
    await bridge.initConnection();
  }

  const raw =
    kind === 'subscription' && bridge.requestSubscription
      ? await bridge.requestSubscription({ sku: productId })
      : bridge.requestPurchase
        ? await bridge.requestPurchase({ sku: productId, skus: [productId] })
        : null;

  const purchase = Array.isArray(raw) ? raw[0] : raw;
  const transactionId = purchase?.transactionId?.trim();
  const receiptData = (
    purchase?.purchaseToken ??
    purchase?.transactionReceipt ??
    ''
  ).trim();

  if (!transactionId || !receiptData) {
    throw new Error('No se recibió un recibo válido de la tienda.');
  }

  return { transactionId, receiptData };
}

export async function purchaseProSubscriptionIap() {
  const storeRes = await performStorePurchase(
    IAP_PRODUCTS.PRO_MONTHLY,
    'subscription',
  );
  return paymentsApi.verifyIapPurchase({
    platform: resolvePlatform(),
    purchaseType: 'SUBSCRIPTION',
    productId: IAP_PRODUCTS.PRO_MONTHLY,
    transactionId: storeRes.transactionId,
    receiptData: storeRes.receiptData,
  });
}

export async function purchaseWalletTopupIap(amount: number) {
  const productId =
    amount >= 100
      ? IAP_PRODUCTS.WALLET_100
      : amount >= 50
        ? IAP_PRODUCTS.WALLET_50
        : IAP_PRODUCTS.WALLET_20;
  const storeRes = await performStorePurchase(productId, 'product');
  return paymentsApi.verifyIapPurchase({
    platform: resolvePlatform(),
    purchaseType: 'WALLET_TOPUP',
    productId,
    amount,
    transactionId: storeRes.transactionId,
    receiptData: storeRes.receiptData,
  });
}

export async function purchaseGigOrderIap(params: {
  gigId: string;
  gigPackageId: string;
  extraIds?: string[];
  amount?: number;
}): Promise<{ order?: OrderItem }> {
  const storeRes = await performStorePurchase(
    IAP_PRODUCTS.SERVICE_ORDER,
    'product',
  );
  const res = await paymentsApi.verifyIapPurchase({
    platform: resolvePlatform(),
    purchaseType: 'GIG_ORDER',
    productId: IAP_PRODUCTS.SERVICE_ORDER,
    gigId: params.gigId,
    gigPackageId: params.gigPackageId,
    extraIds: params.extraIds,
    amount: params.amount,
    transactionId: storeRes.transactionId,
    receiptData: storeRes.receiptData,
  });
  return { order: res.result as OrderItem | undefined };
}

export async function purchaseLeadProposalIap(
  proposalId: string,
  amount?: number,
): Promise<{ order?: OrderItem }> {
  const storeRes = await performStorePurchase(
    IAP_PRODUCTS.SERVICE_ORDER,
    'product',
  );
  const res = await paymentsApi.verifyIapPurchase({
    platform: resolvePlatform(),
    purchaseType: 'LEAD_PROPOSAL',
    productId: IAP_PRODUCTS.SERVICE_ORDER,
    proposalId,
    amount,
    transactionId: storeRes.transactionId,
    receiptData: storeRes.receiptData,
  });
  return { order: res.result as OrderItem | undefined };
}

export async function restoreStorePurchasesIap() {
  const bridge = getNativeIapBridge();
  let receipts: VerifyIapPurchasePayload[] = [];
  if (bridge?.getAvailablePurchases) {
    if (bridge.initConnection) {
      await bridge.initConnection();
    }
    const items = await bridge.getAvailablePurchases();
    receipts = (items ?? [])
      .filter((it) => it.transactionId && (it.purchaseToken || it.transactionReceipt))
      .map((it) => ({
        platform: resolvePlatform(),
        purchaseType: 'SUBSCRIPTION' as const,
        productId: it.productId || IAP_PRODUCTS.PRO_MONTHLY,
        transactionId: it.transactionId!,
        receiptData: (it.purchaseToken || it.transactionReceipt)!,
      }));
  }
  return paymentsApi.restoreIapPurchases(receipts);
}

export async function openStoreSubscriptionsSettings() {
  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  await Linking.openURL(url);
}
