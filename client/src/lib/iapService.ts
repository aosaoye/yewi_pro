import { Linking, Platform } from 'react-native';
import {
  paymentsApi,
  type VerifyIapPurchasePayload,
} from '@/api/services';

export const IAP_PRODUCTS = {
  PRO_MONTHLY: 'yewi_pro_monthly',
} as const;

type ExpoIapModule = typeof import('expo-iap');

function loadExpoIap(): ExpoIapModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // Carga diferida para evitar fallo en Web o Expo Go sin módulo nativo
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-iap') as ExpoIapModule;
  } catch {
    return null;
  }
}

function resolvePlatform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

/**
 * Inicia la compra de suscripción Yewi Pro mediante Google Play Billing / StoreKit
 * usando `expo-iap`, verifica el recibo en el backend y finaliza la transacción.
 */
export async function purchaseProSubscriptionIap() {
  const iap = loadExpoIap();
  if (!iap) {
    throw new Error(
      'Las suscripciones integradas (App Store / Google Play) requieren una compilación nativa con expo-iap.',
    );
  }

  await iap.initConnection();

  const products = await iap
    .fetchProducts({
      skus: [IAP_PRODUCTS.PRO_MONTHLY],
      type: 'subs',
    })
    .catch(() => []);

  const firstSub = Array.isArray(products)
    ? (products[0] as
        | {
            subscriptionOfferDetailsAndroid?: { offerToken?: string }[];
          }
        | undefined)
    : undefined;
  const offerToken =
    firstSub?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;

  const purchase = await new Promise<import('expo-iap').Purchase>(
    (resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        updateSub.remove();
        errorSub.remove();
      };

      const updateSub = iap.purchaseUpdatedListener((p) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(p);
      });

      const errorSub = iap.purchaseErrorListener((err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new Error(
            err?.message || 'Compra de suscripción cancelada o rechazada.',
          ),
        );
      });

      void iap
        .requestPurchase({
          type: 'subs',
          request: {
            apple: { sku: IAP_PRODUCTS.PRO_MONTHLY },
            google: {
              skus: [IAP_PRODUCTS.PRO_MONTHLY],
              ...(offerToken
                ? {
                    subscriptionOffers: [
                      { sku: IAP_PRODUCTS.PRO_MONTHLY, offerToken },
                    ],
                  }
                : {}),
            },
          },
        })
        .catch((err: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(
            err instanceof Error
              ? err
              : new Error('No se pudo iniciar la suscripción en la tienda.'),
          );
        });
    },
  );

  const transactionId = (
    purchase.transactionId ||
    purchase.id ||
    ''
  ).trim();
  const receiptData = (purchase.purchaseToken || '').trim();

  if (!transactionId || !receiptData) {
    throw new Error('No se recibió un recibo válido de la tienda.');
  }

  const verified = await paymentsApi.verifyIapPurchase({
    platform: resolvePlatform(),
    purchaseType: 'SUBSCRIPTION',
    productId: IAP_PRODUCTS.PRO_MONTHLY,
    transactionId,
    receiptData,
  });

  await iap
    .finishTransaction({ purchase, isConsumable: false })
    .catch(() => undefined);

  return verified;
}

export async function restoreStorePurchasesIap() {
  const iap = loadExpoIap();
  let receipts: VerifyIapPurchasePayload[] = [];

  if (iap) {
    await iap.initConnection();
    const list = await iap.getAvailablePurchases().catch(() => []);
    receipts = list
      .filter((it) => Boolean(it.transactionId || it.id) && Boolean(it.purchaseToken))
      .map((it) => ({
        platform: resolvePlatform(),
        purchaseType: 'SUBSCRIPTION' as const,
        productId: it.productId || IAP_PRODUCTS.PRO_MONTHLY,
        transactionId: (it.transactionId || it.id)!,
        receiptData: it.purchaseToken!,
      }));
  }

  return paymentsApi.restoreIapPurchases(receipts);
}

export async function openStoreSubscriptionsSettings() {
  const iap = loadExpoIap();
  if (iap?.deepLinkToSubscriptions) {
    try {
      await iap.deepLinkToSubscriptions({
        skuAndroid: IAP_PRODUCTS.PRO_MONTHLY,
        packageNameAndroid: 'com.yewi.pro',
      });
      return;
    } catch {
      // Fallback a URL estándar de tienda
    }
  }

  const url =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  await Linking.openURL(url);
}
