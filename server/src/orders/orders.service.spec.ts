import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { EscrowStatus, OrderStatus } from '../database/enums';
import { OrdersService } from './orders.service';

describe('OrdersService (TypeORM)', () => {
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
    create: vi.fn((_e, d) => ({ id: 'ord-1', ...d })),
    save: vi.fn(async (_e, d) => ({ id: 'ord-1', isRead: false, createdAt: new Date(), ...d })),
    update: vi.fn(),
    increment: vi.fn(),
    createQueryBuilder: vi.fn(() => qbMock),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
  };
  const packageRepo = { findOne: vi.fn() };
  const extraRepo = { find: vi.fn().mockResolvedValue([]) };
  const orderRepo = { findOne: vi.fn(), save: vi.fn() };
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'business.platformCommission') return 15;
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: OrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrdersService(
      dataSource as any,
      configService,
      orderRepo as any,
      packageRepo as any,
      {} as any,
      extraRepo as any,
      {} as any,
      {} as any,
      {} as any,
      { create: vi.fn(), save: vi.fn() } as any,
    );
  });

  it('prevents a user from ordering their own Gig', async () => {
    packageRepo.findOne.mockResolvedValue({
      id: 'pkg-1',
      price: 100,
      deliveryDays: 3,
      gigId: 'gig-1',
      gig: {
        id: 'gig-1',
        title: 'Mi servicio',
        professionalProfileId: 'pro-1',
        professionalProfile: { userId: 'same-user' },
      },
    });

    await expect(
      service.createGigOrder('same-user', { gigPackageId: 'pkg-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates an Escrow-held Gig order when atomic wallet debit succeeds', async () => {
    packageRepo.findOne.mockResolvedValue({
      id: 'pkg-1',
      price: 100,
      deliveryDays: 3,
      gigId: 'gig-1',
      gig: {
        id: 'gig-1',
        title: 'Instalación eléctrica',
        requirements: [],
        professionalProfileId: 'pro-1',
        professionalProfile: { userId: 'pro-user-1' },
      },
    });
    manager.findOne
      .mockResolvedValueOnce({ id: 'wallet-client', fiatAvailableBalance: 200 })
      .mockResolvedValueOnce({ id: 'wallet-pro', fiatPendingBalance: 0 })
      .mockResolvedValueOnce(null);
    executeMock.mockResolvedValue({ affected: 1 });

    const order = await service.createGigOrder('client-1', {
      gigPackageId: 'pkg-1',
    });

    expect(order.escrowStatus).toBe(EscrowStatus.HELD);
    expect(order.totalAmount).toBe(100);
    expect(order.platformFee).toBe(15);
    expect(order.proEarnings).toBe(85);
  });

  it('throws ConflictException if approveDelivery loses atomic HELD Escrow guard', async () => {
    orderRepo.findOne.mockResolvedValue({
      id: 'ord-1',
      clientId: 'client-1',
      status: OrderStatus.DELIVERED,
      escrowStatus: EscrowStatus.HELD,
      proEarnings: 85,
      professionalProfileId: 'pro-1',
      professionalProfile: { userId: 'pro-user-1' },
    });
    executeMock.mockResolvedValue({ affected: 0 });

    await expect(service.approveDelivery('client-1', 'ord-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
