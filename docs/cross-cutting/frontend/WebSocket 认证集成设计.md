# WebSocket 认证集成设计

## 1. 概述

本文档描述前端 WebSocket 连接的认证机制、断线重连策略以及状态管理方案。

### 1.1 设计目标

- 安全的 Token 认证机制
- 可靠的断线重连能力
- 清晰的状态管理
- 消息不丢失保障

### 1.2 技术栈

- React 18+
- TypeScript 5+
- Zustand (状态管理)
- 原生 WebSocket API

---

## 2. 认证方案设计

### 2.1 WebSocket 握手认证流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │   Server    │     │  AuthStore  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1. 获取 Token    │                   │
       │──────────────────────────────────────>│
       │                   │                   │
       │  2. Token 返回    │                   │
       │<──────────────────────────────────────│
       │                   │                   │
       │  3. WS 连接 (带 Token)                │
       │──────────────────────────────────────>│
       │                   │                   │
       │  4. 认证结果      │                   │
       │<──────────────────│                   │
       │                   │                   │
       │  [认证成功]       │                   │
       │  5. 开始心跳      │                   │
       │═══════════════════│                   │
       │                   │                   │
```

### 2.2 Token 传递方式

**推荐方案：URL Query Parameter**

```typescript
// Token 通过 query 参数传递
const wsUrl = `wss://api.example.com/ws?token=${encodeURIComponent(token)}`;
```

**备选方案：Sub-Protocol Header**

```typescript
// Token 通过 sub-protocol 传递（部分场景适用）
const ws = new WebSocket(url, ['Bearer', token]);
```

**不推荐：自定义 Header**

> 原生 WebSocket API 不支持自定义 HTTP Header，如需使用必须通过 query 或 sub-protocol

### 2.3 Token 过期检测与刷新

```typescript
interface TokenStatus {
  isValid: boolean;
  expiresAt: number;
  needsRefresh: boolean;
}

function checkTokenStatus(token: string): TokenStatus {
  // JWT token 解析检测
  const payload = JSON.parse(atob(token.split('.')[1]));
  const now = Date.now();
  const expiresAt = payload.exp * 1000;
  
  return {
    isValid: expiresAt > now,
    expiresAt,
    needsRefresh: expiresAt - now < 5 * 60 * 1000, // 5 分钟内过期
  };
}
```

---

## 3. 重连机制设计

### 3.1 指数退避算法

```typescript
interface BackoffConfig {
  initialDelay: number;      // 初始延迟 (ms)
  maxDelay: number;          // 最大延迟 (ms)
  multiplier: number;        // 增长倍数
  jitter: number;            // 随机抖动 (0-1)
  maxAttempts: number;       // 最大重试次数
}

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelay: 1000,        // 1 秒
  maxDelay: 30000,           // 30 秒
  multiplier: 2,             // 指数增长
  jitter: 0.2,               // ±20% 随机
  maxAttempts: 10,           // 最多 10 次
};

function calculateBackoff(attempt: number, config: BackoffConfig): number {
  const baseDelay = Math.min(
    config.initialDelay * Math.pow(config.multiplier, attempt),
    config.maxDelay
  );
  
  // 添加随机抖动避免雪崩
  const jitter = (Math.random() - 0.5) * 2 * config.jitter;
  return Math.floor(baseDelay * (1 + jitter));
}
```

### 3.2 重连流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      连接断开                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ 检查重连次数          │
              │ attempt >= maxAttempts? │
              └──────────┬───────────┘
                         │
         ┌───────────────┼───────────────┐
         │ YES           │ NO            │
         ▼               ▼               │
  ┌─────────────┐  ┌─────────────┐       │
  │ 降级处理    │  │ 计算退避时间 │       │
  │ - 通知用户  │  │ delay =     │       │
  │ - 关闭连接  │  │ backoff()   │       │
  │ - 清理资源  │  └──────┬──────┘       │
  └─────────────┘         │               │
                          ▼               │
                   ┌─────────────┐        │
                   │ 等待 delay   │        │
                   └──────┬──────┘        │
                          │               │
                          ▼               │
                   ┌─────────────┐        │
                   │ 获取新 Token │        │
                   │ (如已过期)  │        │
                   └──────┬──────┘        │
                          │               │
                          ▼               │
                   ┌─────────────┐        │
                   │ 发起重连    │────────┘
                   └─────────────┘
```

### 3.3 降级处理

```typescript
enum FallbackStrategy {
  SILENT = 'silent',           // 静默失败
  NOTIFY = 'notify',           // 通知用户
  RECONNECT_POLLING = 'polling', // 降级为 HTTP 轮询
}

interface FallbackConfig {
  strategy: FallbackStrategy;
  message?: string;
  pollingInterval?: number;
}
```

---

## 4. 状态管理

### 4.1 连接状态定义

```typescript
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  CLOSED = 'closed',
}

interface WebSocketState {
  connectionState: ConnectionState;
  error: Error | null;
  reconnectAttempts: number;
  lastMessage: WebSocketMessage | null;
  lastPong: number | null;
}
```

### 4.2 状态订阅机制

```typescript
// Zustand store 定义
interface WebSocketStore {
  // State
  state: WebSocketState;
  
  // Actions
  setState: (state: Partial<WebSocketState>) => void;
  subscribe: (callback: StateChangeCallback) => () => void;
}

// 状态变更回调
type StateChangeCallback = (
  newState: ConnectionState,
  oldState: ConnectionState
) => void;
```

### 4.3 心跳保活

```typescript
interface HeartbeatConfig {
  interval: number;        // 心跳间隔 (ms)
  timeout: number;         // 超时时间 (ms)
  maxMissed: number;       // 最大丢失次数
}

const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  interval: 30000,         // 30 秒
  timeout: 10000,          // 10 秒
  maxMissed: 3,            // 3 次
};
```

---

## 5. 代码实现

### 5.1 类型定义

```typescript
// types/websocket.ts

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  CLOSED = 'closed',
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  id?: string;
}

export interface BackoffConfig {
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  jitter: number;
  maxAttempts: number;
}

export interface HeartbeatConfig {
  interval: number;
  timeout: number;
  maxMissed: number;
}

export interface WebSocketHookOptions {
  url: string;
  enabled?: boolean;
  protocols?: string[];
  backoff?: Partial<BackoffConfig>;
  heartbeat?: Partial<HeartbeatConfig>;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export interface UseWebSocketReturn {
  connectionState: ConnectionState;
  sendMessage: (message: WebSocketMessage) => boolean;
  disconnect: () => void;
  reconnect: () => void;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  stats: {
    reconnectAttempts: number;
    messagesSent: number;
    messagesReceived: number;
    lastMessageTime: number | null;
  };
}
```

### 5.2 Zustand Auth Store

```typescript
// stores/authStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  
  // Actions
  setTokens: (token: string, refreshToken: string, expiresAt: number) => void;
  clearTokens: () => void;
  getToken: () => Promise<string | null>;
  refreshAuthToken: () => Promise<string | null>;
  isTokenExpiring: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector((set, get) => ({
    token: null,
    refreshToken: null,
    expiresAt: null,
    isAuthenticated: false,

    setTokens: (token, refreshToken, expiresAt) => {
      set({
        token,
        refreshToken,
        expiresAt,
        isAuthenticated: true,
      });
      // 持久化到 localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_refresh_token', refreshToken);
      localStorage.setItem('auth_expires_at', String(expiresAt));
    },

    clearTokens: () => {
      set({
        token: null,
        refreshToken: null,
        expiresAt: null,
        isAuthenticated: false,
      });
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('auth_expires_at');
    },

    getToken: async (): Promise<string | null> => {
      const { token, expiresAt } = get();
      
      if (!token) {
        return null;
      }
      
      // Token 未过期，直接返回
      if (expiresAt && expiresAt > Date.now()) {
        return token;
      }
      
      // Token 已过期，尝试刷新
      return get().refreshAuthToken();
    },

    refreshAuthToken: async (): Promise<string | null> => {
      const { refreshToken } = get();
      
      if (!refreshToken) {
        return null;
      }

      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        
        set({
          token: data.token,
          expiresAt: data.expiresAt,
          isAuthenticated: true,
        });

        // 持久化
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_expires_at', String(data.expiresAt));

        return data.token;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        get().clearTokens();
        return null;
      }
    },

    isTokenExpiring: (): boolean => {
      const { expiresAt } = get();
      if (!expiresAt) return false;
      
      // 5 分钟内过期
      return expiresAt - Date.now() < 5 * 60 * 1000;
    },
  }))
);
```

### 5.3 WebSocket Store

```typescript
// stores/webSocketStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ConnectionState, WebSocketMessage } from '../types/websocket';

interface WebSocketStats {
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  lastMessageTime: number | null;
}

interface WebSocketState {
  connectionState: ConnectionState;
  error: Error | null;
  stats: WebSocketStats;
}

interface WebSocketActions {
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: Error | null) => void;
  incrementStat: (key: keyof WebSocketStats) => void;
  resetStats: () => void;
  resetReconnectAttempts: () => void;
}

export type WebSocketStore = WebSocketState & WebSocketActions;

export const useWebSocketStore = create<WebSocketStore>()(
  subscribeWithSelector((set) => ({
    connectionState: ConnectionState.DISCONNECTED,
    error: null,
    stats: {
      reconnectAttempts: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastMessageTime: null,
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
          [key]: key === 'lastMessageTime' 
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
```

### 5.4 消息队列管理

```typescript
// utils/messageQueue.ts

import { WebSocketMessage } from '../types/websocket';

interface QueuedMessage extends WebSocketMessage {
  queuedAt: number;
  attempts: number;
  maxAttempts: number;
}

interface MessageQueueOptions {
  maxQueueSize: number;
  maxMessageAge: number;  // ms
  maxAttempts: number;
}

const DEFAULT_OPTIONS: MessageQueueOptions = {
  maxQueueSize: 100,
  maxMessageAge: 5 * 60 * 1000,  // 5 分钟
  maxAttempts: 3,
};

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private options: MessageQueueOptions;

  constructor(options: Partial<MessageQueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  enqueue(message: WebSocketMessage): boolean {
    // 检查队列大小
    if (this.queue.length >= this.options.maxQueueSize) {
      this.dequeueOldest();
    }

    // 清理过期消息
    this.cleanupExpired();

    this.queue.push({
      ...message,
      queuedAt: Date.now(),
      attempts: 0,
      maxAttempts: this.options.maxAttempts,
    });

    return true;
  }

  dequeue(): QueuedMessage | null {
    this.cleanupExpired();
    return this.queue.shift() || null;
  }

  requeue(message: QueuedMessage): boolean {
    if (message.attempts >= message.maxAttempts) {
      console.warn('Message max attempts reached, discarding:', message);
      return false;
    }

    message.attempts++;
    this.queue.unshift(message);  // 放回队首
    return true;
  }

  peek(): QueuedMessage | null {
    return this.queue[0] || null;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  private dequeueOldest(): void {
    this.queue.pop();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    this.queue = this.queue.filter(
      (msg) => now - msg.queuedAt < this.options.maxMessageAge
    );
  }

  getQueue(): QueuedMessage[] {
    return [...this.queue];
  }
}
```

### 5.5 useWebSocket Hook 完整实现

```typescript
// hooks/useWebSocket.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketStore } from '../stores/webSocketStore';
import { MessageQueue } from '../utils/messageQueue';
import {
  ConnectionState,
  WebSocketMessage,
  BackoffConfig,
  HeartbeatConfig,
  WebSocketHookOptions,
  UseWebSocketReturn,
} from '../types/websocket';

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: 0.2,
  maxAttempts: 10,
};

const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  interval: 30000,
  timeout: 10000,
  maxMissed: 3,
};

export function useWebSocket(
  options: WebSocketHookOptions
): UseWebSocketReturn {
  const {
    url,
    enabled = true,
    protocols,
    backoff: backoffOverride,
    heartbeat: heartbeatOverride,
    onMessage,
    onError,
    onStateChange,
  } = options;

  const backoffConfig = { ...DEFAULT_BACKOFF, ...backoffOverride };
  const heartbeatConfig = { ...DEFAULT_HEARTBEAT, ...heartbeatOverride };

  // Stores
  const { getToken, isTokenExpiring, refreshAuthToken } = useAuthStore();
  const {
    connectionState,
    setConnectionState,
    setError,
    incrementStat,
    resetReconnectAttempts,
    stats,
  } = useWebSocketStore();

  // Local state
  const [localError, setLocalError] = useState<Error | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const missedHeartbeatsRef = useRef(0);
  const messageQueueRef = useRef(new MessageQueue());
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);

  // 计算退避延迟
  const calculateBackoff = useCallback((attempt: number): number => {
    const baseDelay = Math.min(
      backoffConfig.initialDelay * Math.pow(backoffConfig.multiplier, attempt),
      backoffConfig.maxDelay
    );
    const jitter = (Math.random() - 0.5) * 2 * backoffConfig.jitter;
    return Math.floor(baseDelay * (1 + jitter));
  }, [backoffConfig]);

  // 构建带认证的 WebSocket URL
  const buildWebSocketUrl = useCallback(async (): Promise<string | null> => {
    const token = await getToken();
    if (!token) {
      return null;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }, [url, getToken]);

  // 清除定时器
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // 心跳机制
  const startHeartbeat = useCallback(() => {
    clearTimers();

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        
        // 设置心跳超时
        heartbeatTimeoutRef.current = setTimeout(() => {
          missedHeartbeatsRef.current++;
          if (missedHeartbeatsRef.current >= heartbeatConfig.maxMissed) {
            console.warn('Heartbeat timeout, triggering reconnect');
            handleDisconnect(true);
          }
        }, heartbeatConfig.timeout);
      }
    }, heartbeatConfig.interval);
  }, [clearTimers, heartbeatConfig]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    missedHeartbeatsRef.current = 0;
  }, []);

  // 处理收到的消息
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string);
      
      // 处理 pong 响应
      if (data.type === 'pong') {
        missedHeartbeatsRef.current = 0;
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        return;
      }

      // 处理认证过期通知
      if (data.type === 'auth_expired') {
        console.warn('Server notified auth expiration, refreshing token...');
        refreshAuthToken().then(() => {
          // 可选：触发重连以更新认证
        });
        return;
      }

      // 统计
      incrementStat('messagesReceived');
      incrementStat('lastMessageTime');

      // 用户回调
      onMessage?.(data);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [onMessage, incrementStat, refreshAuthToken]);

  // 处理错误
  const handleError = useCallback((event: CloseEvent | ErrorEvent) => {
    const error = new Error(
      'WebSocket error: ' + ('reason' in event ? event.reason : (event as ErrorEvent).message)
    );
    
    setError(error);
    setLocalError(error);
    onError?.(error);

    console.error('WebSocket error:', error);
  }, [setError, onError]);

  // 断开连接处理
  const handleDisconnect = useCallback((isHeartbeatTimeout = false) => {
    stopHeartbeat();
    
    if (isManualDisconnectRef.current) {
      setConnectionState(ConnectionState.CLOSED);
      return;
    }

    // 检查是否需要重连
    if (reconnectAttemptsRef.current >= backoffConfig.maxAttempts) {
      console.error('Max reconnect attempts reached');
      setConnectionState(ConnectionState.ERROR);
      
      // 降级处理：通知用户
      const fallbackError = new Error(
        'WebSocket connection failed after multiple attempts. Please refresh the page.'
      );
      setError(fallbackError);
      onError?.(fallbackError);
      return;
    }

    // 进入重连状态
    setConnectionState(ConnectionState.RECONNECTING);

    // 计算退避延迟
    const delay = calculateBackoff(reconnectAttemptsRef.current);
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, [stopHeartbeat, backoffConfig, calculateBackoff, setConnectionState, setError, onError]);

  // 连接 WebSocket
  const connect = useCallback(async () => {
    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 检查启用状态
    if (!enabled) {
      return;
    }

    // 获取带认证的 URL
    const wsUrl = await buildWebSocketUrl();
    if (!wsUrl) {
      const error = new Error('Failed to get authentication token');
      setError(error);
      setConnectionState(ConnectionState.ERROR);
      return;
    }

    setConnectionState(ConnectionState.CONNECTING);

    try {
      wsRef.current = new WebSocket(wsUrl, protocols);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttemptsRef.current = 0;
        resetReconnectAttempts();
        setConnectionState(ConnectionState.CONNECTED);
        setError(null);
        setLocalError(null);
        
        // 启动心跳
        startHeartbeat();

        // 发送队列中的消息
        flushMessageQueue();
      };

      wsRef.current.onmessage = handleMessage;
      wsRef.current.onerror = handleError as (event: ErrorEvent) => void;
      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        handleDisconnect(event.code !== 1000);  // 非正常关闭触发重连
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      handleError(error as ErrorEvent);
      handleDisconnect(true);
    }
  }, [
    enabled,
    protocols,
    buildWebSocketUrl,
    setError,
    setConnectionState,
    handleMessage,
    handleError,
    handleDisconnect,
    startHeartbeat,
    resetReconnectAttempts,
  ]);

  // 刷新队列消息
  const flushMessageQueue = useCallback(() => {
    const queue = messageQueueRef.current;
    
    while (queue.size() > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      const message = queue.dequeue();
      if (message) {
        try {
          wsRef.current.send(JSON.stringify(message));
          incrementStat('messagesSent');
        } catch (error) {
          console.error('Failed to send queued message:', error);
          queue.requeue(message);
          break;
        }
      }
    }
  }, [incrementStat]);

  // 发送消息
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    const queue = messageQueueRef.current;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        incrementStat('messagesSent');
        incrementStat('lastMessageTime');
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        queue.enqueue(message);
        return false;
      }
    } else {
      // 加入队列
      queue.enqueue(message);
      console.warn('WebSocket not connected, message queued:', message.type);
      return false;
    }
  }, [incrementStat]);

  // 手动断开
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearTimers();
    messageQueueRef.current.clear();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [clearTimers, setConnectionState]);

  // 手动重连
  const reconnect = useCallback(() => {
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    clearTimers();
    connect();
  }, [clearTimers, connect]);

  // 状态变更通知
  const previousStateRef = useRef<ConnectionState>(connectionState);
  useEffect(() => {
    if (previousStateRef.current !== connectionState) {
      onStateChange?.(connectionState);
      previousStateRef.current = connectionState;
    }
  }, [connectionState, onStateChange]);

  // 初始连接
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, url]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Token 过期监听与刷新
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      if (isTokenExpiring() && connectionState === ConnectionState.CONNECTED) {
        console.log('Token expiring soon, refreshing...');
        await refreshAuthToken();
      }
    };

    const interval = setInterval(checkAndRefreshToken, 60000);  // 每分钟检查
    return () => clearInterval(interval);
  }, [connectionState, isTokenExpiring, refreshAuthToken]);

  // 计算衍生状态
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = 
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.RECONNECTING;

  return {
    connectionState,
    sendMessage,
    disconnect,
    reconnect,
    isConnected,
    isConnecting,
    error: localError,
    stats,
  };
}
```

### 5.6 错误边界组件

```typescript
// components/WebSocketErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ConnectionState } from '../types/websocket';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  connectionState?: ConnectionState;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WebSocketErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('WebSocketErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // 触发父组件的重连逻辑
    window.dispatchEvent(new CustomEvent('websocket-retry'));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="websocket-error-boundary">
          <h3>WebSocket Connection Error</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    // 连接状态提示
    const { connectionState } = this.props;
    if (connectionState === ConnectionState.RECONNECTING) {
      return (
        <div className="websocket-reconnecting">
          <p>Reconnecting to server...</p>
        </div>
      );
    }

    if (connectionState === ConnectionState.ERROR) {
      return (
        <div className="websocket-error-boundary">
          <h3>Connection Failed</h3>
          <p>Unable to connect to the server. Please try refreshing the page.</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 函数式 Hook 版本
export function useWebSocketErrorBoundary(
  onError?: (error: Error) => void
): {
  hasError: boolean;
  error: Error | null;
  setError: (error: Error | null) => void;
  reset: () => void;
} {
  const [error, setError] = useState<Error | null>(null);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback((err: Error) => {
    setHasError(true);
    setError(err);
    onError?.(err);
  }, [onError]);

  const reset = useCallback(() => {
    setHasError(false);
    setError(null);
  }, []);

  return { hasError, error, setError: handleError, reset };
}
```

### 5.7 使用示例

```typescript
// pages/Dashboard.tsx

import React, { useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { WebSocketErrorBoundary } from '../components/WebSocketErrorBoundary';
import { ConnectionState, WebSocketMessage } from '../types/websocket';

interface ChatMessage extends WebSocketMessage {
  type: 'chat' | 'notification' | 'system';
  payload: {
    from: string;
    content: string;
    roomId?: string;
  };
}

function DashboardContent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionHistory, setConnectionHistory] = useState<
    Array<{ state: ConnectionState; time: number }>
  >([]);

  const {
    connectionState,
    sendMessage,
    disconnect,
    reconnect,
    isConnected,
    isConnecting,
    error,
    stats,
  } = useWebSocket({
    url: 'wss://api.example.com/ws',
    enabled: true,
    backoff: {
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10,
    },
    heartbeat: {
      interval: 30000,
      timeout: 10000,
    },
    onMessage: (message) => {
      console.log('Received:', message);
      setMessages((prev) => [...prev, message as ChatMessage]);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    },
    onStateChange: (state) => {
      console.log('Connection state changed:', state);
      setConnectionHistory((prev) => [
        ...prev,
        { state, time: Date.now() },
      ]);
    },
  });

  const sendChatMessage = useCallback(
    (content: string, roomId?: string) => {
      const success = sendMessage({
        type: 'chat',
        payload: {
          from: 'user123',
          content,
          roomId,
        },
        timestamp: Date.now(),
      });

      if (!success) {
        console.warn('Message queued for later delivery');
      }

      return success;
    },
    [sendMessage]
  );

  // 连接状态指示器
  const ConnectionIndicator = () => {
    const statusColors = {
      [ConnectionState.DISCONNECTED]: 'bg-gray-400',
      [ConnectionState.CONNECTING]: 'bg-yellow-400',
      [ConnectionState.CONNECTED]: 'bg-green-400',
      [ConnectionState.RECONNECTING]: 'bg-orange-400',
      [ConnectionState.ERROR]: 'bg-red-400',
      [ConnectionState.CLOSED]: 'bg-gray-600',
    };

    return (
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            statusColors[connectionState]
          }`}
        />
        <span className="text-sm text-gray-600">{connectionState}</span>
        {stats.reconnectAttempts > 0 && (
          <span className="text-xs text-gray-400">
            (attempts: {stats.reconnectAttempts})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard">
      <header className="flex justify-between items-center p-4 border-b">
        <h1>Dashboard</h1>
        <ConnectionIndicator />
      </header>

      <main className="p-4">
        {/* 消息列表 */}
        <div className="messages-container">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <span className="type">{msg.type}</span>
              <span className="content">
                {JSON.stringify(msg.payload)}
              </span>
              <span className="time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="controls mt-4 flex gap-2">
          <button
            onClick={() => sendChatMessage('Hello!', 'room1')}
            disabled={!isConnected}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Send Message
          </button>
          <button
            onClick={reconnect}
            disabled={isConnecting}
            className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            Reconnect
          </button>
          <button
            onClick={disconnect}
            disabled={!isConnected}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>

        {/* 统计信息 */}
        <div className="stats mt-4 text-sm text-gray-600">
          <p>Messages sent: {stats.messagesSent}</p>
          <p>Messages received: {stats.messagesReceived}</p>
          <p>Reconnect attempts: {stats.reconnectAttempts}</p>
        </div>
      </main>

      {error && (
        <div className="error-toast bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error.message}
        </div>
      )}
    </div>
  );
}

// 带错误边界的导出
export default function Dashboard() {
  return (
    <WebSocketErrorBoundary>
      <DashboardContent />
    </WebSocketErrorBoundary>
  );
}
```

---

## 6. API 参考

### 6.1 useWebSocket Hook

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | WebSocket 服务器地址 |
| enabled | boolean | 否 | 是否启用连接，默认 true |
| protocols | string[] | 否 | WebSocket 子协议 |
| backoff | Partial<BackoffConfig> | 否 | 重连退避配置 |
| heartbeat | Partial<HeartbeatConfig> | 否 | 心跳配置 |
| onMessage | (message) => void | 否 | 消息接收回调 |
| onError | (error) => void | 否 | 错误回调 |
| onStateChange | (state) => void | 否 | 状态变更回调 |

### 6.2 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| connectionState | ConnectionState | 当前连接状态 |
| sendMessage | (message) => boolean | 发送消息 |
| disconnect | () => void | 断开连接 |
| reconnect | () => void | 重连 |
| isConnected | boolean | 是否已连接 |
| isConnecting | boolean | 是否正在连接 |
| error | Error | 当前错误 |
| stats | object | 统计信息 |

---

## 7. 最佳实践

### 7.1 Token 安全

```typescript
// ✅ 推荐：Token 仅通过 HTTPS/WSS 传输
const wsUrl = `wss://api.example.com/ws?token=${token}`;

// ✅ 推荐：Token 过期主动刷新
useEffect(() => {
  const interval = setInterval(async () => {
    if (isTokenExpiring()) {
      await refreshAuthToken();
    }
  }, 60000);
  return () => clearInterval(interval);
}, []);

// ❌ 避免：Token 存储在 localStorage 明文
// 建议使用 httpOnly cookie 或加密存储
```

### 7.2 重连策略

```typescript
// ✅ 推荐：根据场景调整退避参数
const chatBackoff = {
  initialDelay: 1000,   // 快速重连
  maxDelay: 10000,
  maxAttempts: 20,
};

const notificationBackoff = {
  initialDelay: 5000,   // 宽松重连
  maxDelay: 60000,
  maxAttempts: 5,
};
```

### 7.3 消息可靠性

```typescript
// ✅ 推荐：重要消息加入确认机制
interface AckMessage extends WebSocketMessage {
  id: string;
  requiresAck: true;
  ackTimeout: number;
}

// 发送带确认的消息
const sendWithAck = async (message: AckMessage): Promise<boolean> => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, message.ackTimeout);

    const handler = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ack' && data.payload.messageId === message.id) {
        clearTimeout(timeout);
        resolve(true);
      }
    };

    ws.addEventListener('message', handler);
    sendMessage(message);

    // 清理
    return () => ws.removeEventListener('message', handler);
  });
};
```

---

## 8. 故障排查

### 8.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 连接立即断开 | Token 无效/过期 | 检查 Token 获取逻辑 |
| 重连循环 | 服务器持续拒绝 | 检查 maxAttempts 配置 |
| 消息丢失 | 未启用消息队列 | 确保 queue 配置正确 |
| 心跳超时 | 网络延迟过高 | 调整 heartbeat.timeout |

### 8.2 调试日志

```typescript
// 启用详细日志
const ws = useWebSocket({
  url: 'wss://api.example.com/ws',
  // ...其他配置
});

// 调试时可添加
useEffect(() => {
  console.log('WS State:', {
    connectionState: ws.connectionState,
    stats: ws.stats,
    error: ws.error,
  });
}, [ws.connectionState, ws.stats, ws.error]);
```

---

## 9. 附录

### 9.1 完整文件结构

```
src/
├── types/
│   └── websocket.ts
├── stores/
│   ├── authStore.ts
│   └── websocketStore.ts
├── utils/
│   └── messageQueue.ts
├── hooks/
│   └── useWebSocket.ts
├── components/
│   └── WebSocketErrorBoundary.tsx
└── pages/
    └── Dashboard.tsx (示例)
```

### 9.2 依赖安装

```bash
npm install zustand
# 或
yarn add zustand
```

### 9.3 版本兼容性

- React: 18+
- TypeScript: 5+
- Zustand: 4+
- 浏览器：支持原生 WebSocket API
