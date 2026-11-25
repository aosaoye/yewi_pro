import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { PaymentsService } from './payments.service';
import {
  createRedsysSignature,
  encodeMerchantParameters,
  verifyRedsysSignature,
} from './redsys.utils';

describe('PaymentsService (TypeORM)', () => {
  const mockOrdersService = {
    confirmGigCheckoutSession: vi.fn(),
  };
  const mockWalletService = {
    creditFiatDeposit: vi.fn(),
  };
  const mockLeadsService = {
    confirmLeadCheckoutSession: vi.fn(),
  };
  const mockRedisCache = {
    get: vi.fn(),
    set: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  };
  const mockConfig = {
    get: vi.fn((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return '';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_valid_secret';
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService(
      mockConfig,
      {} as any,
      mockOrdersService as any,
      mockWalletService as any,
      mockLeadsService as any,
      mockRedisCache as any,
    );
  });

  it('rejects payment verification when Stripe is not configured', async () => {
    await expect(
      service.verifyPaymentIntent('pi_missing', 'user_1', 45),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects createPaymentIntent when Stripe is unavailable', async () => {
    await expect(
      service.createPaymentIntent('user_1', { amount: 45, currency: 'EUR' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('processes WALLET_TOPUP webhook once and deduplicates subsequent calls', async () => {
    const mockEvent = {
      id: 'evt_stripe_100',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_topup_1',
          payment_intent: 'pi_test_100',
          amount_total: 5000,
          metadata: {
            userId: 'user_1',
            paymentType: 'WALLET_TOPUP',
            amount: '50',
          },
        },
      },
    };

    (service as any).stripe = {
      webhooks: {
        constructEvent: vi.fn().mockReturnValue(mockEvent),
      },
    };

    mockRedisCache.get.mockResolvedValue(null);
    mockRedisCache.acquireLock.mockResolvedValue('lock_token_123');
    mockWalletService.creditFiatDeposit.mockResolvedValue({
      success: true,
      transactionId: 'tx_1',
    });

    const first = await service.handleWebhook('sig_ok', Buffer.from('{}'));
    expect(first).toEqual({ received: true });
    expect(mockWalletService.creditFiatDeposit).toHaveBeenCalledTimes(1);

    const second = await service.handleWebhook('sig_ok', Buffer.from('{}'));
    expect(second).toEqual({ received: true, duplicated: true });
    expect(mockWalletService.creditFiatDeposit).toHaveBeenCalledTimes(1);
  });

  it('rejects Redsys Bizum checkout when merchant credentials are not configured', async () => {
    await expect(
      service.createRedsysBizumCheckout(
        'user_1',
        {
          purchaseType: 'GIG_ORDER',
          gigPackageId: 'pkg_1',
        },
        'https://api.yewi.app',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('verifies Redsys HMAC_SHA256_V1 signature and fulfills GIG_ORDER idempotently', async () => {
    const secretB64 = Buffer.from('123456789012345678901234').toString(
      'base64',
    );
    const redsysConfig = {
      get: vi.fn((key: string) => {
        if (key === 'REDSYS_MERCHANT_CODE') return '999008881';
        if (key === 'REDSYS_SECRET_KEY') return secretB64;
        if (key === 'REDSYS_TERMINAL') return '001';
        if (key === 'REDSYS_ENV') return 'test';
        return undefined;
      }),
    } as unknown as ConfigService;

    const ordersMock = {
      ...mockOrdersService,
      resolveGigPackageAndTotals: vi.fn().mockResolvedValue({
        gig: { id: 'gig_1', title: 'Instalación eléctrica' },
        gigPackage: { id: 'pkg_1' },
        totalAmount: 95,
      }),
      createGigOrderFromIap: vi.fn().mockResolvedValue({
        id: 'order_1',
        orderNumber: 'YW-BIZUM-01',
      }),
    };

    const redsysService = new PaymentsService(
      redsysConfig,
      {} as any,
      ordersMock as any,
      mockWalletService as any,
      mockLeadsService as any,
      mockRedisCache as any,
    );

    mockRedisCache.get.mockResolvedValue(null);
    mockRedisCache.acquireLock.mockResolvedValue('lock_redsys');

    const checkout = await redsysService.createRedsysBizumCheckout(
      'user_1',
      {
        purchaseType: 'GIG_ORDER',
        gigId: 'gig_1',
        gigPackageId: 'pkg_1',
      },
      'https://api.yewi.app',
    );

    expect(checkout.orderRef).toMatch(/^\d{12}$/);
    expect(checkout.launchUrl).toContain(checkout.orderRef);

    const notifyParamsB64 = encodeMerchantParameters({
      Ds_Order: checkout.orderRef,
      Ds_Response: '0000',
      Ds_Amount: '9500',
    });
    const notifySig = createRedsysSignature(
      notifyParamsB64,
      checkout.orderRef,
      secretB64,
    );

    expect(
      verifyRedsysSignature(notifyParamsB64, notifySig, secretB64),
    ).toBe(true);

    const first = await redsysService.handleRedsysNotification({
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: notifyParamsB64,
      Ds_Signature: notifySig,
    });
    expect(first).toEqual({
      received: true,
      authorized: true,
      orderId: 'order_1',
      orderNumber: 'YW-BIZUM-01',
    });
    expect(ordersMock.createGigOrderFromIap).toHaveBeenCalledTimes(1);

    const second = await redsysService.handleRedsysNotification({
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantParameters: notifyParamsB64,
      Ds_Signature: notifySig,
    });
    expect(second).toEqual({
      received: true,
      duplicated: true,
      orderId: 'order_1',
    });
    expect(ordersMock.createGigOrderFromIap).toHaveBeenCalledTimes(1);
  });
});
