import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  paymentsApi,
  type CreateRedsysBizumPayload,
} from '@/api/services';

export interface RedsysBizumResult {
  orderRef: string;
  orderId?: string;
  orderNumber?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Inicia el pago con Bizum vía Redsys TPV Virtual en navegador in-app,
 * espera el retorno por deep link (yewi://payment-return) y confirma el estado
 * del pedido en el servidor.
 */
export async function payWithRedsysBizum(
  payload: CreateRedsysBizumPayload,
): Promise<RedsysBizumResult> {
  const checkout = await paymentsApi.createRedsysBizumCheckout(payload);
  const redirectUri = Linking.createURL('payment-return');

  const browserResult = await WebBrowser.openAuthSessionAsync(
    checkout.launchUrl,
    redirectUri,
  );

  // Redsys puede enviar la notificación S2S unos milisegundos después de redirigir URLOK
  const maxAttempts = browserResult.type === 'success' ? 6 : 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await paymentsApi.getRedsysPaymentStatus(checkout.orderRef);
    if (status.status === 'PAID') {
      return {
        orderRef: checkout.orderRef,
        orderId: status.orderId,
        orderNumber: status.orderNumber,
      };
    }
    if (status.status === 'FAILED') {
      throw new Error(
        status.errorMessage || 'El pago con Bizum no se ha completado.',
      );
    }
    if (attempt < maxAttempts - 1) {
      await sleep(1000);
    }
  }

  if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
    throw new Error('Pago con Bizum cancelado por el usuario.');
  }

  throw new Error(
    'El pago con Bizum sigue pendiente de confirmación bancaria. Revisa tus pedidos en unos segundos.',
  );
}
