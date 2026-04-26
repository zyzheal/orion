/**
 * useWebSocket Hook
 *
 * 提供 React 组件中的 WebSocket 连接能力，集成认证和心跳机制
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocketStore, ConnectionState } from '@/stores/webSocketStore';

export interface WebSocketMessage {
  type: string;
  payload?: unknown;
  timestamp?: number;
  id?: string;
  [key: string]: unknown;
}

export interface BackoffConfig {
  initialDelay: number;      // 初始延迟 (ms)
  maxDelay: number;          // 最大延迟 (ms)
  multiplier: number;        // 增长倍数
  jitter: number;            // 随机抖动 (0-1)
  maxAttempts: number;       // 最大重试次数
}

export interface HeartbeatConfig {
  interval: number;          // 心跳间隔 (ms)
  timeout: number;           // 超时时间 (ms)
  maxMissed: number;         // 最大丢失次数
}

export interface UseWebSocketOptions {
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

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelay: 1000,        // 1 秒
  maxDelay: 30000,           // 30 秒
  multiplier: 2,             // 指数增长
  jitter: 0.2,               // ±20% 随机
  maxAttempts: 10,           // 最多 10 次
};

const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  interval: 30000,           // 30 秒
  timeout: 10000,            // 10 秒
  maxMissed: 3,              // 3 次
};

/**
 * 消息队列管理
 */
interface QueuedMessage extends WebSocketMessage {
  queuedAt: number;
  attempts: number;
  maxAttempts: number;
}

class MessageQueue {
  private queue: QueuedMessage[] = [];
  private maxQueueSize = 100;
  private maxMessageAge = 5 * 60 * 1000; // 5 分钟
  private maxAttempts = 3;

  enqueue(message: WebSocketMessage): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift(); // 移除最旧的消息
    }

    this.cleanupExpired();

    this.queue.push({
      ...message,
      queuedAt: Date.now(),
      attempts: 0,
      maxAttempts: this.maxAttempts,
    });

    return true;
  }

  dequeue(): QueuedMessage | null {
    this.cleanupExpired();
    return this.queue.shift() || null;
  }

  requeue(message: QueuedMessage): boolean {
    if (message.attempts >= message.maxAttempts) {
      console.warn('[WS] Message max attempts reached, discarding:', message);
      return false;
    }

    message.attempts++;
    this.queue.unshift(message); // 放回队首
    return true;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  private cleanupExpired(): void {
    const now = Date.now();
    this.queue = this.queue.filter(
      (msg) => now - msg.queuedAt < this.maxMessageAge
    );
  }
}

/**
 * useWebSocket Hook 实现
 */
export function useWebSocket(
  options: UseWebSocketOptions
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
  const previousStateRef = useRef<ConnectionState>('disconnected');

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
            console.warn('[WS] Heartbeat timeout, triggering reconnect');
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
        incrementStat('lastPongTime');
        return;
      }

      // 处理认证过期通知
      if (data.type === 'auth_expired') {
        console.warn('[WS] Server notified auth expiration, refreshing token...');
        refreshAuthToken().then(() => {
          // Token 刷新后可选重连
        });
        return;
      }

      // 统计
      incrementStat('messagesReceived');
      incrementStat('lastMessageTime');

      // 用户回调
      onMessage?.(data as WebSocketMessage);
    } catch (error) {
      console.error('[WS] Failed to parse WebSocket message:', error);
    }
  }, [onMessage, incrementStat, refreshAuthToken]);

  // 处理错误
  const handleError = useCallback((event: CloseEvent | ErrorEvent) => {
    const error = new Error(
      'WebSocket error: ' + ('reason' in event ? (event as CloseEvent).reason : (event as ErrorEvent).message)
    );

    setError(error);
    setLocalError(error);
    onError?.(error);

    console.error('[WS] WebSocket error:', error);
  }, [setError, onError]);

  // 断开连接处理
  const handleDisconnect = useCallback((_isHeartbeatTimeout = false) => {
    stopHeartbeat();

    if (isManualDisconnectRef.current) {
      setConnectionState('closed');
      return;
    }

    // 检查是否需要重连
    if (reconnectAttemptsRef.current >= backoffConfig.maxAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      setConnectionState('error');

      const fallbackError = new Error(
        'WebSocket connection failed after multiple attempts. Please refresh the page.'
      );
      setError(fallbackError);
      onError?.(fallbackError);
      return;
    }

    // 进入重连状态
    setConnectionState('reconnecting');

    // 计算退避延迟
    const delay = calculateBackoff(reconnectAttemptsRef.current);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);

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
      const error = new Error('[WS] Failed to get authentication token');
      setError(error);
      setConnectionState('error');
      return;
    }

    setConnectionState('connecting');

    try {
      wsRef.current = new WebSocket(wsUrl, protocols);

      wsRef.current.onopen = () => {
        console.log('[WS] WebSocket connected');
        reconnectAttemptsRef.current = 0;
        resetReconnectAttempts();
        setConnectionState('connected');
        setError(null);
        setLocalError(null);

        // 启动心跳
        startHeartbeat();

        // 发送队列中的消息
        flushMessageQueue();
      };

      wsRef.current.onmessage = handleMessage;
      wsRef.current.onerror = (event: Event) => {
        handleError(event as CloseEvent | ErrorEvent);
      };
      wsRef.current.onclose = (event) => {
        console.log('[WS] WebSocket closed:', event.code, event.reason);
        handleDisconnect(event.code !== 1000); // 非正常关闭触发重连
      };
    } catch (error) {
      console.error('[WS] Failed to create WebSocket:', error);
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
          console.error('[WS] Failed to send queued message:', error);
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
        console.error('[WS] Failed to send message:', error);
        queue.enqueue(message);
        return false;
      }
    } else {
      // 加入队列
      queue.enqueue(message);
      console.warn('[WS] WebSocket not connected, message queued:', message.type);
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

    setConnectionState('disconnected');
  }, [clearTimers, setConnectionState]);

  // 手动重连
  const reconnect = useCallback(() => {
    isManualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    clearTimers();
    connect();
  }, [clearTimers, connect]);

  // 状态变更通知
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
  }, [enabled, url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Token 过期监听与刷新
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      if (isTokenExpiring() && connectionState === 'connected') {
        console.log('[WS] Token expiring soon, refreshing...');
        await refreshAuthToken();
      }
    };

    const interval = setInterval(checkAndRefreshToken, 60000); // 每分钟检查
    return () => clearInterval(interval);
  }, [connectionState, isTokenExpiring, refreshAuthToken]);

  // 计算衍生状态
  const isConnected = connectionState === 'connected';
  const isConnecting =
    connectionState === 'connecting' ||
    connectionState === 'reconnecting';

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
