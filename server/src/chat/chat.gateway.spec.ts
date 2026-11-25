import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import { ChatGateway } from './chat.gateway';

describe('ChatGateway (TypeORM)', () => {
  const mockChatService = {
    isParticipant: vi.fn(),
    sendMessage: vi.fn(),
  };
  const mockJwtService = {
    verifyAsync: vi.fn(),
  } as unknown as JwtService;
  const mockConfigService = {
    get: vi.fn((key: string) =>
      key === 'JWT_SECRET' ? 'test_jwt_secret_key_1234567890' : null,
    ),
  } as unknown as ConfigService;

  let gateway: ChatGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new ChatGateway(
      mockChatService as any,
      mockJwtService,
      mockConfigService,
    );
    gateway.server = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as any;
  });

  it('disconnects client when no token is provided', async () => {
    const mockClient = {
      id: 'socket-1',
      handshake: { auth: {}, headers: {} },
      disconnect: vi.fn(),
      data: {},
    } as any;

    await gateway.handleConnection(mockClient);

    expect(mockClient.disconnect).toHaveBeenCalled();
    expect(mockClient.data.userId).toBeUndefined();
  });

  it('authenticates client and sets userId when token is valid', async () => {
    const mockClient = {
      id: 'socket-1',
      handshake: { auth: { token: 'valid-jwt-token' }, headers: {} },
      disconnect: vi.fn(),
      data: {},
    } as any;

    (mockJwtService.verifyAsync as any).mockResolvedValue({ sub: 'user-123' });

    await gateway.handleConnection(mockClient);

    expect(mockClient.disconnect).not.toHaveBeenCalled();
    expect(mockClient.data.userId).toBe('user-123');
  });

  it('rejects join_conversation if user is not a participant', async () => {
    const mockClient = {
      id: 'socket-1',
      data: { userId: 'outsider' },
      join: vi.fn(),
      disconnect: vi.fn(),
    } as any;

    mockChatService.isParticipant.mockResolvedValue(false);

    const res = await gateway.handleJoinConversation(mockClient, {
      conversationId: 'c-1',
    });

    expect(res).toEqual({
      status: 'forbidden',
      message: 'No tienes autorización para acceder a esta conversación',
    });
    expect(mockClient.join).not.toHaveBeenCalled();
  });
});
