import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

export const userRoom = (userId: string) => `user:${userId}`;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly onlineSocketsByUser = new Map<string, Set<string>>();
  private readonly lastSeenByUser = new Map<string, Date>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  markConnected(userId: string, socketId: string) {
    let sockets = this.onlineSocketsByUser.get(userId);
    if (!sockets) {
      sockets = new Set<string>();
      this.onlineSocketsByUser.set(userId, sockets);
    }
    sockets.add(socketId);
    const now = new Date();
    this.lastSeenByUser.set(userId, now);
    this.server?.emit('presence:update', {
      userId,
      isOnline: true,
      lastSeenAt: now.toISOString(),
    });
  }

  markDisconnected(userId: string | undefined, socketId: string) {
    if (!userId) return;
    const sockets = this.onlineSocketsByUser.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.onlineSocketsByUser.delete(userId);
      }
    }
    const now = new Date();
    this.lastSeenByUser.set(userId, now);
    const stillOnline = (this.onlineSocketsByUser.get(userId)?.size ?? 0) > 0;
    if (!stillOnline) {
      this.server?.emit('presence:update', {
        userId,
        isOnline: false,
        lastSeenAt: now.toISOString(),
      });
    }
  }

  getPresence(userId: string): { isOnline: boolean; lastSeenAt: string | null } {
    return {
      isOnline: (this.onlineSocketsByUser.get(userId)?.size ?? 0) > 0,
      lastSeenAt: this.lastSeenByUser.get(userId)?.toISOString() ?? null,
    };
  }

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      client.disconnect();
      return;
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET no configurado en RealtimeGateway');
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        {
          secret: jwtSecret,
        },
      );
      if (!payload.sub) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      await client.join(userRoom(payload.sub));
      this.markConnected(payload.sub, client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.markDisconnected(client.data?.userId as string | undefined, client.id);
    this.logger.debug(`Socket realtime desconectado: ${client.id}`);
  }
}
