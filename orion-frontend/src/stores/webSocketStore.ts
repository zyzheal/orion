/**
 * WebSocket Store
 *
 * 管理 WebSocket 连接状态和统计信息
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';

export interface WebSocketStats {
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  lastMessageTime: number | null;
  lastPongTime: number | null;
}

export interface WebSocketState {
  connectionState: ConnectionState;
  error: Error | null;
  stats: WebSocketStats;
}

export interface WebSocketActions {
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: Error | null) => void;
  incrementStat: (key: keyof WebSocketStats) => void;
  resetStats: () => void;
  resetReconnectAttempts: () => void;
}

export type WebSocketStore = WebSocketState & WebSocketActions;

export const useWebSocketStore = create<WebSocketStore>()(
  subscribeWithSelector((set) => ({
    connectionState: 'disconnected' as ConnectionState,
    error: null,
    stats: {
      reconnectAttempts: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastMessageTime: null,
      lastPongTime: null,
    },

    setConnectionState: (state) => {
      set({ connectionState: state });
    },

    setError: (error) => {
      set({ error });
    },

    incrementStat: (key) => {
      set((state) => ({
        stats: {
          ...state.stats,
          [key]: key === 'lastMessageTime' || key === 'lastPongTime'
            ? Date.now()
            : (state.stats[key] as number) + 1,
        },
      }));
    },

    resetStats: () => {
      set({
        stats: {
          reconnectAttempts: 0,
          messagesSent: 0,
          messagesReceived: 0,
          lastMessageTime: null,
          lastPongTime: null,
        },
      });
    },

    resetReconnectAttempts: () => {
      set((state) => ({
        stats: { ...state.stats, reconnectAttempts: 0 },
      }));
    },
  }))
);
