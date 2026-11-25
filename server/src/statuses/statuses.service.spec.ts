import { ForbiddenException } from '@nestjs/common';
import { vi } from 'vitest';
import { SubscriptionStatus } from '../database/enums';
import { StatusesService } from './statuses.service';

describe('StatusesService (TypeORM)', () => {
  const statusRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn((d) => d),
    save: vi.fn(async (d) => ({ id: 'status-1', ...d })),
    remove: vi.fn(),
  };
  const userRepo = { findOne: vi.fn() };
  const commentRepo = {
    create: vi.fn((d) => d),
    save: vi.fn(async (d) => ({ id: 'comment-1', createdAt: new Date(), ...d })),
    findOne: vi.fn(),
  };
  const reactionRepo = {
    findOne: vi.fn(),
    create: vi.fn((d) => d),
    save: vi.fn(async (d) => ({ id: 'reaction-1', ...d })),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(1),
  };
  const notificationRepo = {
    create: vi.fn((d) => d),
    save: vi.fn(async (d) => ({ id: 'notif-1', isRead: false, createdAt: new Date(), ...d })),
  };
  const realtime = {
    emitStatusCreated: vi.fn(),
    emitStatusComment: vi.fn(),
    emitStatusReaction: vi.fn(),
    emitNotification: vi.fn(),
  };

  let service: StatusesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StatusesService(
      statusRepo as any,
      userRepo as any,
      commentRepo as any,
      reactionRepo as any,
      notificationRepo as any,
      realtime as any,
    );
  });

  it('rejects status creation for non-Pro users', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'client-1',
      isPro: false,
      professionalProfile: { isPro: false },
      subscription: { status: SubscriptionStatus.CANCELED },
    });

    await expect(
      service.createStatus('client-1', { caption: 'Hola' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates status with 24h expiry for active Pro users', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'pro-1',
      isPro: true,
      professionalProfile: { isPro: true, businessName: 'Fontanería Pro' },
      subscription: { status: SubscriptionStatus.ACTIVE },
    });

    const result = await service.createStatus('pro-1', {
      caption: 'Trabajo terminado',
    });

    expect(result.id).toBe('status-1');
    expect(realtime.emitStatusCreated).toHaveBeenCalled();
  });

  it('toggles reaction off when clicking the same reaction twice', async () => {
    statusRepo.findOne.mockResolvedValue({ id: 'status-1', authorId: 'pro-1' });
    reactionRepo.findOne.mockResolvedValue({
      id: 'reaction-1',
      reactionType: 'LIKE',
    });

    const result = await service.reactToStatus('user-1', 'status-1', {
      reactionType: 'LIKE',
    });

    expect(result).toEqual({ reacted: false, reactionType: null });
    expect(reactionRepo.delete).toHaveBeenCalledWith({ id: 'reaction-1' });
  });
});
