/**
 * Redis 缓存服务
 *
 * 提供 Redis 连接和常用缓存操作
 */

import Redis, { RedisOptions } from 'ioredis';
import { EventEmitter } from 'events';
import pino from 'pino';
import { OrionError, ErrorCode } from '../errors';

const logger = pino({ name: 'redis-cache' });

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
}

export interface CacheEntry<T> {
  value: T;
  ttl?: number;
  createdAt: Date;
}

export class RedisCache extends EventEmitter {
  private client: Redis | null = null;
  private config: RedisConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;

  constructor(config: RedisConfig) {
    super();
    this.config = config;
  }

  /**
   * 连接到 Redis
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
      keyPrefix: this.config.keyPrefix || '',
      maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
      retryStrategy: (times: number) => {
        if (times > this.maxReconnectAttempts) {
          this.emit('error', new Error('Max reconnect attempts reached'));
          return null;
        }
        this.reconnectAttempts = times;
        this.emit('reconnecting', { attempt: times });
        return Math.min(times * 100, 3000);
      },
    };

    this.client = new Redis(options);

    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connect');
      logger.info('[RedisCache] Connected to Redis');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.emit('close');
      logger.info('[RedisCache] Connection closed');
    });

    this.client.on('error', (error) => {
      this.emit('error', error);
      logger.error('[RedisCache] Error:', error.message);
    });

    this.client.on('reconnecting', (delay: number) => {
      this.emit('reconnecting', { delay });
      logger.info(`[RedisCache] Reconnecting in ${delay}ms`);
    });

    // 等待连接建立
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);

      this.client!.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client!.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }

    this.emit('set', { key, ttl: ttlSeconds });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const value = await this.client.get(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const result = await this.client.del(key);
    this.emit('delete', { key });
    return result;
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 获取剩余 TTL
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    return await this.client.ttl(key);
  }

  /**
   * 原子递增
   */
  async incr(key: string): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    return await this.client.incr(key);
  }

  /**
   * 原子递减
   */
  async decr(key: string): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    return await this.client.decr(key);
  }

  /**
   * 设置哈希字段
   */
  async hset(key: string, field: string, value: any): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await this.client.hset(key, field, serialized);
  }

  /**
   * 获取哈希字段
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const value = await this.client.hget(key, field);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * 获取整个哈希
   */
  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const result = await this.client.hgetall(key);
    if (!result || Object.keys(result).length === 0) {
      return null;
    }

    const parsed: Record<string, T> = {};
    for (const [field, value] of Object.entries(result)) {
      try {
        parsed[field] = JSON.parse(value) as T;
      } catch {
        parsed[field] = value as unknown as T;
      }
    }

    return parsed;
  }

  /**
   * 添加到列表（左边）
   */
  async lpush<T>(key: string, ...values: T[]): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const serialized = values.map((v) =>
      typeof v === 'string' ? v : JSON.stringify(v)
    );
    return await this.client.lpush(key, ...serialized);
  }

  /**
   * 从列表弹出（左边）
   */
  async rpop<T>(key: string): Promise<T | null> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const value = await this.client.rpop(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * 获取列表长度
   */
  async llen(key: string): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    return await this.client.llen(key);
  }

  /**
   * 发布消息
   */
  async publish(channel: string, message: string): Promise<number> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    return await this.client.publish(channel, message);
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.client) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Redis not connected');
    }

    const subscriber = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
    });

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });

    await subscriber.subscribe(channel);
    this.emit('subscribe', { channel });
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      this.emit('close');
    }
  }

  /**
   * 获取客户端
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * 检查连接状态
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }
}
