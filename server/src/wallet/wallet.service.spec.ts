import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { WalletService } from './wallet.service';

describe('WalletService (TypeORM)', () => {
  const executeMock = vi.fn();
  const qbMock = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    execute: executeMock,
  };
  const manager = {
    findOne: vi.fn(),
    create: vi.fn((_e, d) => ({ id: 'tx-1', ...d })),
    save: vi.fn(async (_e, d) => ({ id: 'tx-1', ...d })),
    createQueryBuilder: vi.fn(() => qbMock),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
  };
  const walletRepo = { findOne: vi.fn(), create: vi.fn((d) => d), save: vi.fn(async (d) => d) };
  const ledgerRepo = { find: vi.fn() };
  const configService = { get: vi.fn().mockReturnValue('') } as unknown as ConfigService;

  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletService(
      dataSource as any,
      configService,
      walletRepo as any,
      ledgerRepo as any,
    );
  });

  it('rejects payouts below minimum 20 EUR', async () => {
    await expect(
      service.requestPayout('user-1', {
        amount: 10,
        destinationAccount: 'ES9121000418450200051332',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects payout when atomic balance guard affects 0 rows', async () => {
    manager.findOne.mockResolvedValue({
      id: 'wallet-1',
      userId: 'user-1',
      fiatAvailableBalance: 5,
    });
    executeMock.mockResolvedValue({ affected: 0 });

    await expect(
      service.requestPayout('user-1', {
        amount: 50,
        destinationAccount: 'ES9121000418450200051332',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deduplicates creditFiatDeposit idempotently by stripePaymentIntentId', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 'tx-existing' });

    const res = await service.creditFiatDeposit({
      userId: 'user-1',
      amount: 50,
      paymentIntentId: 'pi_123',
    });

    expect(res).toEqual({
      success: true,
      alreadyProcessed: true,
      transactionId: 'tx-existing',
    });
  });
});
