/**
 * WebSocket 客户端 SDK
 *
 * 功能：
 * - 自动连接管理
 * - 指数退避重连
 * - 心跳保活机制
 * - 连接状态管理
 * - 消息收发
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketClientConfig {
  url: string;
  accessToken?: string; // JWT Token
  reconnectEnabled?: boolean; // 是否启用重连
  maxReconnectAttempts?: number; // 最大重连次数
  initialReconnectDelay?: number; // 初始重连延迟（毫秒）
  maxReconnectDelay?: number; // 最大重连延迟（毫秒）
  heartbeatInterval?: number; // 心跳间隔（毫秒）
  onMessage?: (data: any) => void; // 消息回调
  onStateChange?: (state: ConnectionState) => void; // 状态变化回调
  onError?: (error: Error) => void; // 错误回调
}

const DEFAULT_CONFIG: Partial<WebSocketClientConfig> = {
  reconnectEnabled: true,
  maxReconnectAttempts: 10,
  initialReconnectDelay: 1000, // 1 秒
  maxReconnectDelay: 30000, // 30 秒
  heartbeatInterval: 30000, // 30 秒
};

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export class OrionWebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<WebSocketClientConfig>;

    // 如果提供了 token，开始连接
    if (this.config.accessToken) {
      this.connect();
    }
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 判断是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * 设置 Access Token
   */
  setAccessToken(token: string): void {
    this.config.accessToken = token;
  }

  /**
   * 获取 Access Token
   */
  private getAccessToken(): string | null {
    return this.config.accessToken || localStorage.getItem('access_token');
  }

  /**
   * 构建 WebSocket URL（包含认证 token）
   */
  private buildWsUrl(): string {
    const url = this.config.url;
    const token = this.getAccessToken();

    if (!token) {
      return url;
    }

    // 将 token 添加到 URL 查询参数
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  /**
   * 连接到 WebSocket 服务器
   */
  connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') {
      console.log('[WS] Already connecting or connected');
      return;
    }

    this.updateState('connecting');

    try {
      const wsUrl = this.buildWsUrl();
      this.ws = new WebSocket(wsUrl);

      // 设置连接超时
      this.connectionTimeout = setTimeout(() => {
        if (this.state === 'connecting') {
          this.handleConnectionError(new Error('Connection timeout'));
        }
      }, 10000); // 10 秒超时

      this.ws.onopen = () => this.handleOpen();
      this.ws.onclose = (event) => this handleClose(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onmessage = (event) => this.handleMessage(event);
    } catch (error) {
      this.handleConnectionError(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    // 禁用重连
    this.reconnectAttempts = this.config.maxReconnectAttempts;

    // 清除定时器
    this.clearTimers();

    // 关闭 WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }

    this.updateState('disconnected');
  }

  /**
   * 处理连接打开
   */
  private handleOpen(): void {
    // 清除连接超时
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // 重置重连计数
    this.reconnectAttempts = 0;

    // 更新状态
    this.updateState('connected');

    // 启动心跳
    this.startHeartbeat();

    // 发送队列中的消息
    this.flushMessageQueue();

    console.log('[WS] Connected to server');
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    console.log('[WS] Connection closed:', event.code, event.reason);

    // 清除定时器
    this.clearTimers();

    // 更新状态
    if (this.state !== 'disconnected') {
      this.updateState('disconnected');
    }

    // 尝试重连
    if (this.config.reconnectEnabled && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理连接错误
   */
  private handleError(error: any): void {
    console.error('[WS] Connection error:', error);
    this.config.onError?.(error instanceof Error ? error : new Error('WebSocket error'));
  }

  /**
   * 处理连接错误（内部）
   */
  private handleConnectionError(error: Error): void {
    console.error('[WS] Connection error:', error);

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.updateState('error');
    this.config.onError?.(error);

    // 尝试重连
    if (this.config.reconnectEnabled && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // 处理服务器 ping
      if (data.type === 'ping') {
        this.send({ type: 'pong', timestamp: Date.now() });
        return;
      }

      // 处理服务器 pong（用于心跳）
      if (data.type === 'pong') {
        return; // 心跳响应不需要向上抛出
      }

      // 调用用户回调
      this.config.onMessage?.(data);
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
      // 如果不是 JSON，传递原始数据
      this.config.onMessage?.({ type: 'raw', data: event.data });
    }
  }

  /**
   * 发送消息
   */
  send(data: Record<string, any>): boolean {
    const message = JSON.stringify(data);

    if (this.state === 'connected' && this.ws) {
      this.ws.send(message);
      return true;
    } else {
      // 将消息加入队列
      this.messageQueue.push(message);
      console.log('[WS] Message queued (not connected)');
      return false;
    }
  }

  /**
   * 发送队列中的消息
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(message);
      }
    }
  }

  /**
   * 计划重连（指数退避）
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;

    // 指数退避：delay = base * 2^(attempt-1) + random jitter
    const exponentialDelay = Math.pow(2, this.reconnectAttempts - 1) * this.config.initialReconnectDelay;
    const jitter = Math.random() * 1000; // 0-1 秒的随机抖动
    const delay = Math.min(exponentialDelay + jitter, this.config.maxReconnectDelay);

    console.log(`[WS] Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.ws) {
        // 发送 ping 消息
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);

    console.log('[WS] Heartbeat started');
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 清除所有定时器
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * 更新状态
   */
  private updateState(state: ConnectionState): void {
    const oldState = this.state;
    this.state = state;

    if (oldState !== state) {
      console.log(`[WS] State changed: ${oldState} -> ${state}`);
      this.config.onStateChange?.(state);
    }
  }

  /**
   * 销毁客户端
   */
  destroy(): void {
    this.disconnect();
    this.ws = null;
  }
}

/**
 * 创建 WebSocket 客户端（单例模式）
 */
let clientInstance: OrionWebSocketClient | null = null;

export function createWebSocketClient(config: WebSocketClientConfig): OrionWebSocketClient {
  if (clientInstance) {
    clientInstance.destroy();
  }

  clientInstance = new OrionWebSocketClient(config);
  return clientInstance;
}

export function getWebSocketClient(): OrionWebSocketClient | null {
  return clientInstance;
}
