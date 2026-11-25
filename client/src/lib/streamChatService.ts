import { Channel, StreamChat } from 'stream-chat';
import { chatApi } from '@/api/services';
import { getAccessToken } from './session';

class StreamChatService {
  private client: StreamChat | null = null;
  private currentUserId: string | null = null;
  private pendingConnect: Promise<StreamChat | null> | null = null;

  async getConnectedClient(forceRefresh = false): Promise<StreamChat | null> {
    if (this.client?.userID && !forceRefresh) {
      return this.client;
    }
    if (this.pendingConnect) {
      return this.pendingConnect;
    }

    this.pendingConnect = (async () => {
      try {
        const access = await getAccessToken();
        if (!access) return null;

        const tokenData = await chatApi.getStreamToken();
        if (!tokenData?.token || !tokenData?.apiKey) return null;

        if (this.client && this.currentUserId !== tokenData.userId) {
          await this.disconnect();
        }

        const client = StreamChat.getInstance(tokenData.apiKey);
        if (!client.userID) {
          await client.connectUser(
            {
              id: tokenData.userId,
              name: tokenData.user.name,
              image: tokenData.user.image ?? undefined,
            },
            tokenData.token,
          );
        }

        this.client = client;
        this.currentUserId = tokenData.userId;
        return client;
      } catch {
        return null;
      } finally {
        this.pendingConnect = null;
      }
    })();

    return this.pendingConnect;
  }

  async getOrCreateDirectChannel(
    currentUserId: string,
    otherUserId: string,
    metadata?: {
      conversationId?: string;
      orderId?: string;
      requestId?: string;
      title?: string;
    },
  ): Promise<Channel | null> {
    const client = await this.getConnectedClient();
    if (!client) return null;

    try {
      const channelId = metadata?.conversationId
        ? `yewi-conv-${metadata.conversationId.replace(/[^a-zA-Z0-9_-]/g, '')}`
        : [currentUserId, otherUserId]
            .sort()
            .join('-')
            .replace(/[^a-zA-Z0-9_-]/g, '');

      const channel = client.channel('messaging', channelId, {
        members: [{ user_id: currentUserId }, { user_id: otherUserId }],
      });
      await channel.watch();
      return channel;
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnectUser();
      } catch {
        // Ignorar errores al desconectar
      }
    }
    this.client = null;
    this.currentUserId = null;
  }
}

export const streamChatService = new StreamChatService();
