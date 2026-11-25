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
});
