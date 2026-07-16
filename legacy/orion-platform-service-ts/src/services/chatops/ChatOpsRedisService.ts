/**
 * ChatOps Redis Service
 *
 * Redis 持久化与缓存层:
 * - chatops_sessions → Redis hash (read-through cache)
 * - sse_connections metadata → Redis hash
 * - recommendations → Redis hash
 * - subscription failures → Redis hash
 * - SSE event bus → Redis pub/sub channel
 *
 * 内存 Map 保留作为 L1 缓存，Redis 作为 L2 持久化。
 */

import { RedisCache } from '../redis-cache';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ChatOpsRedis');

const KEY_PREFIX = 'chatops';

export class ChatOpsRedisService {
  private redis: RedisCache;
  private readonly SSE_CHANNEL = `${KEY_PREFIX}:sse:events`;
  private subscriber: RedisCache | null = null;
  private eventCallback: ((data: Record<string, unknown>) => void) | null = null;
  private initialized: boolean = false;

  constructor(redis: RedisCache) {
    this.redis = redis;
  }

  // ==================== Health Check ====================

  async isHealthy(): Promise<boolean> {
    try {
      return this.redis.isHealthy();
    } catch {
      return false;
    }
  }

  async ping(): Promise<string> {
    const client = this.redis.getClient();
    if (!client) return 'DISCONNECTED';
    return await client.ping();
  }

  // ==================== Session Cache ====================

  async cacheSession(key: string, data: Record<string, unknown>, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.redis.hset(`${KEY_PREFIX}:session:${key}`, 'data', data);
      await this.redis.expire(`${KEY_PREFIX}:session:${key}`, ttlSeconds);
    } catch (err) {
      logger.warn({ err, sessionKey: key }, '[ChatOpsRedis] Failed to cache session');
    }
  }

  async getCachedSession(key: string): Promise<Record<string, unknown> | null> {
    try {
      return await this.redis.hget<Record<string, unknown>>(`${KEY_PREFIX}:session:${key}`, 'data');
    } catch {
      return null;
    }
  }

  async deleteSession(key: string): Promise<void> {
    try {
      await this.redis.delete(`${KEY_PREFIX}:session:${key}`);
    } catch (err) {
      logger.warn({ err, sessionKey: key }, '[ChatOpsRedis] Failed to delete session');
    }
  }

  // ==================== SSE Connection Metadata ====================

  async cacheSSEConnection(conn: {
    id: string;
    userId: string;
    connectedAt: Date;
    lastHeartbeatAt: Date;
    status: string;
  }): Promise<void> {
    try {
      await this.redis.hset(`${KEY_PREFIX}:sse:${conn.id}`, {
        user_id: conn.userId,
        connected_at: conn.connectedAt.toISOString(),
        last_heartbeat_at: conn.lastHeartbeatAt.toISOString(),
        status: conn.status,
      });
    } catch (err) {
      logger.warn({ err, connId: conn.id }, '[ChatOpsRedis] Failed to cache SSE connection');
    }
  }

  async getSSEConnection(id: string): Promise<{
    userId: string;
    connectedAt: string;
    lastHeartbeatAt: string;
    status: string;
  } | null> {
    try {
      return await this.redis.hget<any>(`${KEY_PREFIX}:sse:${id}`, '');
    } catch {
      return null;
    }
  }

  async removeSSEConnection(id: string): Promise<void> {
    try {
      await this.redis.delete(`${KEY_PREFIX}:sse:${id}`);
    } catch (err) {
      logger.warn({ err, connId: id }, '[ChatOpsRedis] Failed to remove SSE connection');
    }
  }

  async getSSEConnectionsByUser(userId: string): Promise<string[]> {
    try {
      const userIndexKey = `${KEY_PREFIX}:sse:user:${userId}`;
      const connIds = await this.redis.lrange<string>(userIndexKey, 0, -1);
      return connIds;
    } catch {
      return [];
    }
  }

  async addSSEConnectionToUserIndex(userId: string, connId: string): Promise<void> {
    try {
      await this.redis.lpush(`${KEY_PREFIX}:sse:user:${userId}`, connId);
    } catch (err) {
      logger.warn({ err, userId, connId }, '[ChatOpsRedis] Failed to add SSE connection to user index');
    }
  }

  async removeSSEConnectionFromUserIndex(userId: string, connId: string): Promise<void> {
    try {
      const listKey = `${KEY_PREFIX}:sse:user:${userId}`;
      const client = this.redis.getClient();
      if (client) {
        await client.lrem(listKey, 0, connId);
      }
    } catch (err) {
      logger.warn({ err, userId, connId }, '[ChatOpsRedis] Failed to remove SSE connection from user index');
    }
  }

  // ==================== Recommendation Cache ====================

  async cacheRecommendation(rec: {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
    source: string;
    createdAt: Date;
  }): Promise<void> {
    try {
      await this.redis.hset(`${KEY_PREFIX}:recommendation:${rec.id}`, {
        type: rec.type,
        severity: rec.severity,
        title: rec.title,
        description: rec.description,
        actions: JSON.stringify(rec.actions),
        source: rec.source,
        created_at: rec.createdAt.toISOString(),
      });
      const client = this.redis.getClient();
      if (client) {
        await client.expire(`${KEY_PREFIX}:recommendation:${rec.id}`, 1800); // 30 min TTL
      }
    } catch (err) {
      logger.warn({ err, recId: rec.id }, '[ChatOpsRedis] Failed to cache recommendation');
    }
  }

  async getCachedRecommendation(id: string): Promise<{
    type: string;
    severity: string;
    title: string;
    description: string;
    actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
    source: string;
    createdAt: string;
  } | null> {
    try {
      return await this.redis.hget<any>(`${KEY_PREFIX}:recommendation:${id}`, '');
    } catch {
      return null;
    }
  }

  async deleteRecommendation(id: string): Promise<void> {
    try {
      await this.redis.delete(`${KEY_PREFIX}:recommendation:${id}`);
    } catch (err) {
      logger.warn({ err, recId: id }, '[ChatOpsRedis] Failed to delete recommendation');
    }
  }

  async getActiveRecommendations(tenantId?: string): Promise<any[]> {
    // Recommendation cache is keyed by id, not tenant. Return empty and rely on DB for full list.
    return [];
  }

  // ==================== Subscription Failure Cache ====================

  async cacheSubscriptionFailure(failure: {
    event: string;
    error: string;
    timestamp: Date;
    retryCount: number;
  }): Promise<void> {
    try {
      await this.redis.hset(`${KEY_PREFIX}:subscription_failure:${failure.event}`, {
        error: failure.error,
        timestamp: failure.timestamp.toISOString(),
        retry_count: failure.retryCount,
      });
      const client = this.redis.getClient();
      if (client) {
        await client.expire(`${KEY_PREFIX}:subscription_failure:${failure.event}`, 3600);
      }
    } catch (err) {
      logger.warn({ err, event: failure.event }, '[ChatOpsRedis] Failed to cache subscription failure');
    }
  }

  async getCachedSubscriptionFailure(event: string): Promise<{
    error: string;
    timestamp: string;
    retryCount: number;
  } | null> {
    try {
      return await this.redis.hget<any>(`${KEY_PREFIX}:subscription_failure:${event}`, '');
    } catch {
      return null;
    }
  }

  async deleteSubscriptionFailure(event: string): Promise<void> {
    try {
      await this.redis.delete(`${KEY_PREFIX}:subscription_failure:${event}`);
    } catch (err) {
      logger.warn({ err, event }, '[ChatOpsRedis] Failed to delete subscription failure');
    }
  }

  // ==================== SSE Event Pub/Sub ====================

  async publishSSEEvent(data: Record<string, unknown>): Promise<void> {
    try {
      await this.redis.publish(this.SSE_CHANNEL, JSON.stringify(data));
    } catch (err) {
      logger.warn({ err }, '[ChatOpsRedis] Failed to publish SSE event');
    }
  }

  async subscribeSSEEvents(callback: (data: Record<string, unknown>) => void): Promise<void> {
    if (this.initialized) return;

    try {
      const client = this.redis.getClient();
      if (!client) {
        logger.warn('[ChatOpsRedis] Redis client not available for SSE pub/sub');
        return;
      }

      await this.redis.subscribe(this.SSE_CHANNEL, (message: string) => {
        try {
          const data = JSON.parse(message) as Record<string, unknown>;
          callback(data);
        } catch {
          // ignore malformed messages
        }
      });

      this.eventCallback = callback;
      this.initialized = true;
      logger.info('[ChatOpsRedis] Subscribed to SSE events channel');
    } catch (err) {
      logger.warn({ err }, '[ChatOpsRedis] Failed to subscribe to SSE events');
    }
  }

  async unsubscribeSSEEvents(): Promise<void> {
    try {
      const client = this.redis.getClient();
      if (client) {
        await client.unsubscribe(this.SSE_CHANNEL);
      }
      this.eventCallback = null;
      this.initialized = false;
    } catch (err) {
      logger.warn({ err }, '[ChatOpsRedis] Failed to unsubscribe from SSE events');
    }
  }
}
