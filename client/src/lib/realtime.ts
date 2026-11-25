import { io, Socket } from 'socket.io-client';
import { qk } from '@/api/keys';
import { getRealtimeUrl } from '@/config';
import { queryClient } from './queryClient';
import { getAccessToken } from './session';
import { useRealtimeStore } from './stores';

class RealtimeManager {
  private realtimeSocket: Socket | null = null;
  private chatSocket: Socket | null = null;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    const token = await getAccessToken();
    if (!token) return;

    this.started = true;
    const realtimeBase = getRealtimeUrl();

    this.realtimeSocket = io(`${realtimeBase}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    this.realtimeSocket.on('connect', () => {
      useRealtimeStore.getState().setConnected(true);
    });

    this.realtimeSocket.on('disconnect', () => {
      useRealtimeStore.getState().setConnected(false);
    });

    this.realtimeSocket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications() });
      queryClient.invalidateQueries({ queryKey: qk.unreadCount() });
    });

    this.realtimeSocket.on('lead:new', () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    });

    this.realtimeSocket.on('subscription:updated', () => {
      queryClient.invalidateQueries({ queryKey: qk.subscription() });
      queryClient.invalidateQueries({ queryKey: qk.me() });
    });

    this.realtimeSocket.on('status:new', () => {
      queryClient.invalidateQueries({ queryKey: qk.statuses() });
    });

    this.realtimeSocket.on('status:comment:new', () => {
      queryClient.invalidateQueries({ queryKey: qk.statuses() });
    });

    this.realtimeSocket.on('status:reaction:update', () => {
      queryClient.invalidateQueries({ queryKey: qk.statuses() });
    });

    this.realtimeSocket.on(
      'presence:update',
      (ev: {
        userId?: string;
        isOnline?: boolean;
        lastSeenAt?: string | null;
      }) => {
        if (ev?.userId) {
          useRealtimeStore
            .getState()
            .setUserPresence(
              ev.userId,
              Boolean(ev.isOnline),
              ev.lastSeenAt ?? null,
            );
        }
      },
    );

    this.chatSocket = io(`${realtimeBase}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    this.chatSocket.on('new_message', (msg: { conversationId?: string }) => {
      if (msg?.conversationId) {
        queryClient.invalidateQueries({
          queryKey: qk.messages(msg.conversationId),
        });
      }
      queryClient.invalidateQueries({ queryKey: qk.conversations() });
    });
  }

  joinConversation(conversationId: string): void {
    if (this.chatSocket?.connected) {
      this.chatSocket.emit('join_conversation', { conversationId });
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.chatSocket?.connected) {
      this.chatSocket.emit('leave_conversation', { conversationId });
    }
  }

  sendChatTyping(conversationId: string, isTyping: boolean): void {
    if (this.chatSocket?.connected) {
      this.chatSocket.emit('typing', { conversationId, isTyping });
    }
  }

  stop(): void {
    this.started = false;
    this.realtimeSocket?.removeAllListeners();
    this.realtimeSocket?.disconnect();
    this.realtimeSocket = null;

    this.chatSocket?.removeAllListeners();
    this.chatSocket?.disconnect();
    this.chatSocket = null;

    useRealtimeStore.getState().reset();
  }
}

export const realtimeManager = new RealtimeManager();
