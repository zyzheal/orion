/**
 * WebSocket 心跳机制
 *
 * 实现心跳保活机制：
 * - 服务端定期发送 ping
 * - 客户端响应 pong
 * - 超时未响应则断开连接
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export interface HeartbeatConfig {
  intervalMs: number; // 心跳间隔（毫秒）
  timeoutMs: number; // 超时时间（毫秒）
  maxMissedPongs: number; // 最大允许丢失的 pong 次数
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: 30000, // 30 秒
  timeoutMs: 15000, // 15 秒超时
  maxMissedPongs: 2, // 允许丢失 2 次
};

export type HeartbeatEvent = 'timeout' | 'pong' | 'stopped';

interface HeartbeatEvents {
  timeout: () => void;
  pong: () => void;
  stopped: () => void;
}

export class HeartbeatHandler extends EventEmitter {
  private ws: WebSocket;
  private config: HeartbeatConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private missedPongs: number = 0;
  private isRunning: boolean = false;

  constructor(ws: WebSocket, config?: Partial<HeartbeatConfig>) {
    super();
    this.ws = ws;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 开始心跳
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.missedPongs = 0;

    // 监听 pong 响应
    this.ws.on('pong', () => this.handlePong());

    // 启动定时器
    this.intervalId = setInterval(() => this.sendPing(), this.config.intervalMs);
  }

  /**
   * 停止心跳
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.emit('stopped');

    // 清除定时器
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // 移除监听器
    this.ws.off('pong', () => this.handlePong());
  }

  /**
   * 发送 Ping
   */
  private sendPing(): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      this.stop();
      return;
    }

    this.missedPongs++;

    if (this.missedPongs > this.config.maxMissedPongs) {
      this.emit('timeout');
      this.stop();
      return;
    }

    // 发送 ping
    this.ws.ping((err: Error | undefined) => {
      if (err) {
        this.stop();
        return;
      }

      // 设置超时定时器
      this.timeoutId = setTimeout(() => {
        if (this.isRunning && this.missedPongs >= this.config.maxMissedPongs) {
          this.emit('timeout');
          this.stop();
        }
      }, this.config.timeoutMs);
    });
  }

  /**
   * 处理 Pong 响应
   */
  private handlePong(): void {
    this.missedPongs = 0;

    // 清除超时定时器
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.emit('pong');
  }

  /**
   * 重置心跳计数器
   */
  reset(): void {
    this.missedPongs = 0;
  }

  /**
   * 判断是否正在运行
   */
  getRunningStatus(): boolean {
    return this.isRunning;
  }
}

/**
 * WebSocket 连接管理器
 * 管理所有连接的 WebSocket 客户端
 */
export class WebSocketConnectionManager {
  private connections: Map<string, WebSocket> = new Map();
  private heartbeats: Map<string, HeartbeatHandler> = new Map();

  /**
   * 添加连接
   */
  addConnection(clientId: string, ws: WebSocket, config?: Partial<HeartbeatConfig>): void {
    // 存储连接
    this.connections.set(clientId, ws);

    // 创建并启动心跳
    const heartbeat = new HeartbeatHandler(ws, config);
    heartbeat.start();
    this.heartbeats.set(clientId, heartbeat);

    // 监听心跳超时
    heartbeat.on('timeout', () => {
      console.log(`Client ${clientId} heartbeat timeout, closing connection`);
      this.removeConnection(clientId);
    });

    // 监听连接关闭
    ws.on('close', () => {
      this.removeConnection(clientId);
    });

    // 监听错误
    ws.on('error', (error: Error) => {
      console.error(`Client ${clientId} error:`, error);
      this.removeConnection(clientId);
    });
  }

  /**
   * 移除连接
   */
  removeConnection(clientId: string): void {
    // 停止心跳
    const heartbeat = this.heartbeats.get(clientId);
    if (heartbeat) {
      heartbeat.stop();
      this.heartbeats.delete(clientId);
    }

    // 关闭 WebSocket
    const ws = this.connections.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Connection removed');
    }
    this.connections.delete(clientId);
  }

  /**
   * 获取连接
   */
  getConnection(clientId: string): WebSocket | undefined {
    return this.connections.get(clientId);
  }

  /**
   * 获取所有连接 ID
   */
  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 获取连接数量
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 向指定客户端发送消息
   */
  sendToClient(clientId: string, data: string): boolean {
    const ws = this.connections.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
      return true;
    }
    return false;
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(data: string): void {
    const message = JSON.stringify(data);
    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * 关闭所有连接（优雅关闭时使用）
   */
  closeAll(): void {
    this.connections.forEach((_ws, clientId) => {
      this.removeConnection(clientId);
    });
  }
}
