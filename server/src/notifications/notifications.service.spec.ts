import { vi } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (TypeORM)', () => {
  const notificationRepo = {
    find: vi.fn(),
    findOne: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn((data) => data),
    save: vi.fn(async (data) => ({ id: 'notif-1', ...data })),
  };

  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(notificationRepo as any);
  });

  it('retrieves notifications for user ordered descending', async () => {
    notificationRepo.find.mockResolvedValue([
      { id: 'notif-1', userId: 'user-1', title: 'Test' },
    ]);

    const result = await service.getMyNotifications('user-1');
    expect(notificationRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    expect(result).toHaveLength(1);
  });

  it('deletes a single notification scoped by userId', async () => {
    notificationRepo.delete.mockResolvedValue({ affected: 1 });
    const res = await service.deleteNotification('user-1', 'notif-1');
    expect(notificationRepo.delete).toHaveBeenCalledWith({
      id: 'notif-1',
      userId: 'user-1',
    });
    expect(res).toEqual({ success: true, count: 1 });
  });

  it('deletes all notifications when no ids provided', async () => {
    notificationRepo.delete.mockResolvedValue({ affected: 4 });
    const res = await service.deleteNotifications('user-1');
    expect(notificationRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(res).toEqual({ success: true, count: 4 });
  });

  it('registers and unregisters an Expo push token when userRepo is provided', async () => {
    const userRepo = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    const svcWithUser = new NotificationsService(
      notificationRepo as any,
      undefined,
      userRepo as any,
    );

    const reg = await svcWithUser.registerPushToken(
      'user-1',
      ' ExponentPushToken[abc123] ',
    );
    expect(userRepo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { expoPushToken: 'ExponentPushToken[abc123]' },
    );
    expect(reg).toEqual({ success: true });

    const unreg = await svcWithUser.unregisterPushToken('user-1');
    expect(userRepo.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { expoPushToken: null },
    );
    expect(unreg).toEqual({ success: true });
  });
});
