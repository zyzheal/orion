/**
 * NatsConnectionManager - NATS JetStream 连接管理器
 *
 * 独立的连接生命周期管理模块:
 * - 连接/重连/断开
 * - 从环境变量读取配置 (NATS_URL, NATS_CREDS)
 * - 健康检查
 * - 连接状态事件
 *
 * 与 EventBusService 解耦，可单独使用或注入。
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { OrionError, ErrorCode } from '../errors';

const logger = pino({ name: 'nats-connection-manager' });

/** 连接状态 */
export type NatsConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'closed';

/** 连接配置 */
export interface NatsConnectionConfig {
  /** NATS 服务器地址，默认从 NATS_URL 环境变量读取 */
  servers?: string[];
  /** 用户名，默认从 NATS_USER 读取 */
  user?: string;
  /** 密码，默认从 NATS_PASS 读取 */
  pass?: string;
  /** 认证 token */
  token?: string;
  /** 连接超时 (ms) */
  timeout?: number;
  /** 是否启用自动重连 */
  reconnect?: boolean;
  /** 最大重连尝试次数 (-1 表示无限) */
  maxReconnectAttempts?: number;
  /** 重连等待间隔 (ms) */
  reconnectTimeWait?: number;
}

/** 连接状态详情 */
export interface ConnectionInfo {
  state: NatsConnectionState;
  servers: string[];
  reconnectAttempts: number;
  lastError?: string;
  connectedAt?: Date;
}

/**
 * NatsConnectionManager
 *
 * 管理 NATS 连接的生命周期。
 * 触发事件: 'connecting', 'connected', 'reconnecting', 'disconnected', 'closed', 'error'
 */
export class NatsConnectionManager extends EventEmitter {
  private config: NatsConnectionConfig;
  private state: NatsConnectionState = 'idle';
  private rawConnection: any = null;
  private reconnectAttempts: number = 0;
  private lastError?: string;
  private connectedAt?: Date;
  private closedIntentionally: boolean = false;

  constructor(config: NatsConnectionConfig = {}) {
    super();
    this.config = this.resolveConfig(config);
  }

  /**
   * 从环境变量解析配置
   */
  private resolveConfig(config: NatsConnectionConfig): NatsConnectionConfig {
    return {
      servers: config.servers ?? process.env.NATS_URL?.split(',').filter(Boolean) ?? ['nats://localhost:4222'],
      user: config.user ?? process.env.NATS_USER,
      pass: config.pass ?? process.env.NATS_PASS,
      token: config.token,
      timeout: config.timeout ?? 20000,
      reconnect: config.reconnect !== false,
      maxReconnectAttempts: config.maxReconnectAttempts ?? -1,
      reconnectTimeWait: config.reconnectTimeWait ?? 2000,
    };
  }

  /**
   * 建立 NATS 连接
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.closedIntentionally = false;
    this.setState('connecting');

    try {
      const { connect } = await import('nats').catch(() => ({ connect: null }));

      if (!connect) {
        throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'NATS module not available. Run: npm install nats');
      }

      this.rawConnection = await connect({
        servers: this.config.servers,
        user: this.config.user,
        pass: this.config.pass,
        token: this.config.token,
        timeout: this.config.timeout,
        reconnect: this.config.reconnect,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        reconnectTimeWait: this.config.reconnectTimeWait,
      });

      this.setState('connected');
      this.reconnectAttempts = 0;
      this.connectedAt = new Date();
      logger.info({ servers: this.config.servers }, 'Connected to NATS');
      this.emit('connected');

      // 监听连接关闭
      this.rawConnection.closed().then(() => {
        if (!this.closedIntentionally) {
          this.setState('disconnected');
          this.emit('disconnected');
          logger.warn('NATS connection closed unexpectedly');
        }
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.lastError = errorMsg;
      this.setState('disconnected');
      logger.error({ error: errorMsg }, 'Failed to connect to NATS');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.closedIntentionally = true;

    if (this.rawConnection) {
      try {
        await this.rawConnection.drain();
        await this.rawConnection.close();
      } catch (error) {
        logger.warn({ error: String(error) }, 'Error during NATS close');
      }
      this.rawConnection = null;
    }

    this.setState('closed');
    this.connectedAt = undefined;
    this.emit('closed');
    logger.info('NATS connection closed');
  }

  /**
   * 获取当前原始连接
   */
  getConnection(): any {
    return this.rawConnection;
  }

  /**
   * 获取连接状态信息
   */
  getInfo(): ConnectionInfo {
    return {
      state: this.state,
      servers: this.config.servers ?? [],
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
      connectedAt: this.connectedAt,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; latencyMs?: number; message?: string }> {
    if (this.state !== 'connected' || !this.rawConnection) {
      return { status: 'down', message: `Not connected (state: ${this.state})` };
    }

    if (this.rawConnection.isClosed?.()) {
      return { status: 'down', message: 'Connection is closed' };
    }

    const start = Date.now();
    try {
      await this.rawConnection.request('$SYS.REQ.SERVER.PING', new TextEncoder().encode('{}'), {
        timeout: 5000,
      });
      const latencyMs = Date.now() - start;
      return { status: 'up', latencyMs };
    } catch {
      return { status: 'down', message: 'Health check request failed' };
    }
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.rawConnection !== null && !this.rawConnection?.isClosed?.();
  }

  /**
   * 获取当前状态
   */
  getState(): NatsConnectionState {
    return this.state;
  }

  private setState(newState: NatsConnectionState): void {
    const oldState = this.state;
    this.state = newState;
    if (oldState !== newState) {
      this.emit('stateChange', { from: oldState, to: newState });
    }
  }
}

/**
 * 创建 NatsConnectionManager 实例的工厂函数
 */
export function createNatsConnectionManager(config: NatsConnectionConfig = {}): NatsConnectionManager {
  return new NatsConnectionManager(config);
}
