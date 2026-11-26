import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  paymentsApi,
  type CreateStripeCheckoutPayload,
} from '@/api/services';
import type { OrderItem } from '@/api/types';

async function runStripeCheckout(payload: CreateStripeCheckoutPayload) {
  const checkout = await paymentsApi.createStripeCheckout(payload);
  const redirectUri = Linking.createURL('payment-return');

  const browserResult = await WebBrowser.openAuthSessionAsync(
    checkout.url,
    redirectUri,
  );

  if (browserResult.type === 'cancel') {
    throw new Error('Pago con Stripe cancelado.');
  }

  if (browserResult.type === 'success' && browserResult.url) {
    const parsed = Linking.parse(browserResult.url);
    if (parsed.queryParams?.status === 'cancel') {
      throw new Error('Pago con Stripe cancelado.');
    }
  }

  return paymentsApi.confirmStripeCheckout(checkout.sessionId);
}

export async function payWalletTopupWithStripe(amount: number) {
  return runStripeCheckout({
    purchaseType: 'WALLET_TOPUP',
    amount,
  });
}

export async function payGigOrderWithStripe(params: {
  gigId: string;
  gigPackageId: string;
  extraIds?: string[];
}) {
  const res = await runStripeCheckout({
    purchaseType: 'GIG_ORDER',
    gigId: params.gigId,
    gigPackageId: params.gigPackageId,
    extraIds: params.extraIds,
  });
  return {
    verified: res.confirmed,
    order: res.result as OrderItem | undefined,
  };
}

export async function payLeadProposalWithStripe(proposalId: string) {
  const res = await runStripeCheckout({
    purchaseType: 'LEAD_PROPOSAL',
    proposalId,
  });
  return {
    verified: res.confirmed,
    order: res.result as OrderItem | undefined,
  };
}
