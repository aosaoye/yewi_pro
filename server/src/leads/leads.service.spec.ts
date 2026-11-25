import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { LeadStatus, SubscriptionStatus } from '../database/enums';
import { LeadsService } from './leads.service';

describe('LeadsService (TypeORM)', () => {
  const executeMock = vi.fn();
  const qbMock = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: executeMock,
  };
  const manager = {
    createQueryBuilder: vi.fn(() => qbMock),
    create: vi.fn((_e, d) => ({ id: 'unlock-1', ...d })),
    save: vi.fn(async (_e, d) => ({ id: 'saved-1', isRead: false, createdAt: new Date(), ...d })),
    findOne: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
  };
  const requestRepo = { findOne: vi.fn() };
  const categoryRepo = { findOne: vi.fn() };
  const proRepo = { findOne: vi.fn() };
  const unlockRepo = { findOne: vi.fn() };
  const proposalRepo = { findOne: vi.fn() };
  const notificationRepo = { create: vi.fn((d) => d), save: vi.fn(async (d) => d) };
  const orderRepo = { count: vi.fn() };
  const configService = { get: vi.fn() } as unknown as ConfigService;

  let service: LeadsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeadsService(
      dataSource as any,
      configService,
      requestRepo as any,
      categoryRepo as any,
      proRepo as any,
      unlockRepo as any,
      proposalRepo as any,
      notificationRepo as any,
      orderRepo as any,
    );
  });

  it('rejects lead unlock for professionals without active Yewi Pro subscription', async () => {
    proRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      userId: 'user-pro',
      isPro: false,
      user: { isPro: false, subscription: { status: SubscriptionStatus.CANCELED } },
    });

    await expect(service.unlockLead('user-pro', 'req-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('unlocks lead atomically for active Yewi Pro subscriber and reveals client contact', async () => {
    proRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      userId: 'user-pro',
      businessName: 'Carlos Pro',
      isPro: true,
      user: { isPro: true, subscription: { status: SubscriptionStatus.ACTIVE } },
    });
    requestRepo.findOne.mockResolvedValue({
      id: 'req-1',
      clientId: 'client-1',
      title: 'Fuga urgente',
      status: LeadStatus.OPEN,
      address: 'Calle Mayor 10',
      client: {
        id: 'client-1',
        email: 'laura@ejemplo.com',
        profile: {
          firstName: 'Laura',
          lastName: 'Martínez',
          displayName: 'Laura Martínez',
          phoneNumber: '+34600112233',
          city: 'Madrid',
        },
      },
    });
    unlockRepo.findOne.mockResolvedValue(null);
    executeMock.mockResolvedValue({ affected: 1 });
    manager.findOne.mockResolvedValue(null);

    const res = await service.unlockLead('user-pro', 'req-1');

    expect(res.alreadyUnlocked).toBe(false);
    expect(res.request.address).toBe('Calle Mayor 10');
    expect(res.request.client?.email).toBe('laura@ejemplo.com');
  });

  it('throws ConflictException when atomic maxUnlocks condition fails', async () => {
    proRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      userId: 'user-pro',
      isPro: true,
      user: { isPro: true },
    });
    requestRepo.findOne.mockResolvedValue({
      id: 'req-1',
      clientId: 'client-1',
      title: 'Solicitud llena',
      status: LeadStatus.OPEN,
    });
    unlockRepo.findOne.mockResolvedValue(null);
    executeMock.mockResolvedValue({ affected: 0 });

    await expect(service.unlockLead('user-pro', 'req-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('masks client PII when viewing request details without unlock', async () => {
    requestRepo.findOne.mockResolvedValue({
      id: 'req-1',
      clientId: 'client-1',
      address: 'Calle Secreta 99',
      unlocks: [],
      client: {
        id: 'client-1',
        email: 'privado@ejemplo.com',
        profile: {
          firstName: 'Laura',
          lastName: 'Privado',
          phoneNumber: '+34699887766',
        },
      },
    });
    proRepo.findOne.mockResolvedValue({ id: 'pro-other', userId: 'other-pro' });

    const result = await service.getRequestById('other-pro', 'req-1');

    expect(result.isUnlocked).toBe(false);
    expect(result.address).toBeNull();
    expect(result.client?.email).toBeUndefined();
    expect(result.client?.profile?.phoneNumber).toBeUndefined();
  });
});
