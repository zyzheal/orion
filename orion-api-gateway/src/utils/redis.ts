/**
 * Redis 工具
 *
 * 提供 Redis 连接和常用操作
 * 包含 Lua 脚本用于原子性操作
 */

import Redis from 'ioredis';
import { getConfig } from '../config';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export class RedisClient {
  private client: Redis | null = null;
  private config: RedisConfig;

  constructor(config?: Partial<RedisConfig>) {
    const defaultConfig: RedisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    };

    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 连接 Redis
   */
  async connect(): Promise<void> {
    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      retryStrategy: (times: number) => {
        if (times > 10) {
          return null; // 放弃连接
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Redis client not initialized'));
        return;
      }

      this.client.on('ready', () => {
        resolve();
      });

      this.client.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  /**
   * 获取客户端实例
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  // ==================== 基本操作 ====================

  /**
   * 设置键值
   */
  async set(key: string, value: string, ...args: any[]): Promise<'OK' | null> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.set(key, value, ...args);
  }

  /**
   * 获取值
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.get(key);
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.exists(key);
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.expire(key, seconds);
  }

  /**
   * 获取键的剩余时间（秒）
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.ttl(key);
  }

  /**
   * 自增
   */
  async incr(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.incr(key);
  }

  /**
   * 自减
   */
  async decr(key: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.decr(key);
  }

  // ==================== Hash 操作 ====================

  /**
   * 设置 Hash 字段
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.hset(key, field, value);
  }

  /**
   * 获取 Hash 字段
   */
  async hget(key: string, field: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.hget(key, field);
  }

  /**
   * 获取所有 Hash 字段
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.hgetall(key);
  }

  /**
   * 删除 Hash 字段
   */
  async hdel(key: string, field: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.hdel(key, field);
  }

  // ==================== List 操作 ====================

  /**
   * 左侧推入列表
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.lpush(key, ...values);
  }

  /**
   * 右侧推入列表
   */
  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.rpush(key, ...values);
  }

  /**
   * 获取列表范围
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.lrange(key, start, stop);
  }

  // ==================== Set 操作 ====================

  /**
   * 添加集合成员
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.sadd(key, ...members);
  }

  /**
   * 获取所有集合成员
   */
  async smembers(key: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.smembers(key);
  }

  /**
   * 检查成员是否存在
   */
  async sismember(key: string, member: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.sismember(key, member);
  }

  /**
   * 移除集合成员
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.srem(key, ...members);
  }

  // ==================== Sorted Set 操作 ====================

  /**
   * 添加有序集合成员
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.zadd(key, score, member);
  }

  /**
   * 获取有序集合范围
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.zrange(key, start, stop);
  }

  /**
   * 获取成员分数
   */
  async zscore(key: string, member: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.zscore(key, member);
  }

  // ==================== 其他操作 ====================

  /**
   * 获取匹配的键
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.keys(pattern);
  }

  /**
   * 执行 Lua 脚本
   */
  async eval(script: string, keys: number, ...args: string[]): Promise<any> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.eval(script, keys, ...args);
  }

  /**
   * 执行命令
   */
  async call(command: string, ...args: any[]): Promise<any> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.call(command, ...args);
  }

  /**
   * 发布消息
   */
  async publish(channel: string, message: string): Promise<number> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    return this.client.publish(channel, message);
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }
    await this.client.subscribe(channel);
    this.client.on('message', (ch, message) => {
      if (ch === channel) {
        callback(message);
      }
    });
  }
}

// 导出单例
export const redisClient = new RedisClient();
