import { BadRequestException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import { ChatService } from './chat.service';

describe('ChatService (TypeORM)', () => {
  const userRepo = { findOne: vi.fn(), find: vi.fn() };
  const convRepo = { findOne: vi.fn(), find: vi.fn(), create: vi.fn(), save: vi.fn(), update: vi.fn() };
  const messageRepo = { create: vi.fn((d) => d), save: vi.fn(async (d) => ({ id: 'msg-1', ...d })), findOne: vi.fn(), find: vi.fn(), count: vi.fn(), update: vi.fn() };
  const orderRepo = { findOne: vi.fn() };
  const requestRepo = { findOne: vi.fn() };
  const proRepo = { find: vi.fn() };
  const notificationRepo = { create: vi.fn((d) => d), save: vi.fn(async (d) => ({ id: 'notif-1', isRead: false, createdAt: new Date(), ...d })) };
  const realtime = { emitNotification: vi.fn() };

  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChatService(
      userRepo as any,
      convRepo as any,
      messageRepo as any,
      orderRepo as any,
      requestRepo as any,
      proRepo as any,
      notificationRepo as any,
      realtime as any,
    );
  });

  it('throws NotFoundException if user does not exist in getStreamToken', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.getStreamToken('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns signed stream token and metadata for existing user', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 'user-123',
      roles: ['CLIENT'],
      isPro: false,
      profile: {
        displayName: 'Juan Fontanero',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      professionalProfile: null,
      subscription: null,
    });

    const result = await service.getStreamToken('user-123');
    expect(result.userId).toBe('user-123');
    expect(result.token).toBeDefined();
    expect(result.apiKey).toBeDefined();
    expect(result.user.name).toBe('Juan Fontanero');
  });

  it('blocks off-platform phone numbers, emails and social handles in sendMessage', async () => {
    convRepo.findOne.mockResolvedValue({
      id: 'conv-1',
      participantAId: 'user-1',
      participantBId: 'user-2',
    });

    await expect(
      service.sendMessage('user-1', {
        conversationId: 'conv-1',
        content: 'Llámame al 611223344 o escribe a juan@test.com',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.sendMessage('user-1', {
        conversationId: 'conv-1',
        content: 'Hablamos por instagram @juan_pro',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
