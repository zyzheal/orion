/**
 * SSE Connection Manager
 *
 * 集中管理所有 Server-Sent Events 连接:
 * 1. 追踪所有活跃的 SSE 连接
 * 2. 优雅关闭时清理所有连接
 * 3. 心跳检测死连接 (30 秒间隔)
 * 4. 安全写入 (writableEnded 检查 + try/catch)
 * 5. Redis pub/sub 跨实例消息广播
 *
 * Migrated from Map() to PostgreSQL Repository pattern.
 * Runtime objects (reply, heartbeatTimer) kept in memory; metadata persisted to DB.
 */

import { EventEmitter } from 'events';
import { FastifyReply } from 'fastify';
import { ChatOpsRedisService } from './ChatOpsRedisService';
import { ChatOpsSSEConnectionRepository } from '../../repositories/ChatOpsSSEConnectionRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SSEConnectionManager');

export interface SSEConnection {
  id: string;
  userId: string;
  listener: (data: Record<string, unknown>) => void;
  connectedAt: Date;
  heartbeatTimer: ReturnType<typeof setInterval>;
  reply?: FastifyReply;
}

export class SSEConnectionManager {
  /** Runtime connections (reply + heartbeatTimer cannot be persisted) */
  private runtimeConnections: Map<string, SSEConnection> = new Map();
  private repo: ChatOpsSSEConnectionRepository | null;
  private tenantId: string | null;
  private localBus: EventEmitter;
  private redisSvc: ChatOpsRedisService | null = null;
  private redisInitialized = false;
  private readonly HEARTBEAT_INTERVAL_MS = 30_000;
  private readonly MAX_CONNECTIONS_PER_USER = 5;
  private readonly MAX_TOTAL_CONNECTIONS = 500;

  constructor(
    localBus: EventEmitter,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId?: string,
    redisSvc?: ChatOpsRedisService | null,
  ) {
    this.localBus = localBus;
    this.repo = db ? new ChatOpsSSEConnectionRepository(db) : null;
    this.tenantId = tenantId ?? null;
    this.redisSvc = redisSvc ?? null;
  }

  /**
   * 初始化 Redis pub/sub 跨实例消息广播
   * 订阅 Redis SSE 事件频道，将远程事件转发到 localBus
   */
  async initRedisPubSub(): Promise<void> {
    if (!this.redisSvc || this.redisInitialized) return;

    try {
      await this.redisSvc.subscribeSSEEvents((data: Record<string, unknown>) => {
        // 从 Redis 接收跨实例事件，转发到 localBus 供本地 SSE 连接消费
        this.localBus.emit('chatops:recommendation_update', data);
      });
      this.redisInitialized = true;
      logger.info('Redis SSE pub/sub initialized for cross-instance broadcast');
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize Redis SSE pub/sub');
    }
  }

  /**
   * 添加新 SSE 连接
   */
  async addConnection(conn: Omit<SSEConnection, 'heartbeatTimer'>, reply: FastifyReply): Promise<void> {
    // 限制: 单用户最大连接数
    let userCount = 0;
    for (const c of this.runtimeConnections.values()) {
      if (c.userId === conn.userId) userCount++;
    }
    if (userCount >= this.MAX_CONNECTIONS_PER_USER) {
      // 清理该用户最早的连接
      for (const [id, c] of this.runtimeConnections.entries()) {
        if (c.userId === conn.userId) {
          await this.removeConnection(id);
          break;
        }
      }
    }

    // 限制: 全局最大连接数
    if (this.runtimeConnections.size >= this.MAX_TOTAL_CONNECTIONS) {
      const oldestId = this.runtimeConnections.keys().next().value;
      if (oldestId) await this.removeConnection(oldestId);
    }

    // 若同一 connId 已存在，先清理旧连接（含 heartbeat timer）
    if (this.runtimeConnections.has(conn.id)) {
      await this.removeConnection(conn.id);
    }

    const heartbeatTimer = setInterval(() => {
      const existing = this.runtimeConnections.get(conn.id);
      if (!existing) return;

      const raw = reply.raw;
      if (raw?.writableEnded) {
        this.removeConnection(conn.id).catch((err) => logger.warn({ err, connId: conn.id }, 'Failed to remove connection'));
      } else {
        try {
          raw.write(':heartbeat\n\n');
          // Update heartbeat in DB (fire-and-forget)
          this.repo?.updateHeartbeat(conn.id).catch((err) => logger.warn({ err, connId: conn.id }, 'Failed to update heartbeat'));
        } catch {
          this.removeConnection(conn.id).catch((err) => logger.warn({ err, connId: conn.id }, 'Failed to remove connection'));
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);

    // R-3: 确保 heartbeat timer 不阻塞进程退出
    if (typeof heartbeatTimer.unref === 'function') {
      heartbeatTimer.unref();
    }

    const fullConn: SSEConnection = { ...conn, heartbeatTimer, reply: conn.reply ?? reply };
    this.runtimeConnections.set(conn.id, fullConn);

    // Persist connection metadata to DB (fire-and-forget)
    this.repo?.create({
      id: conn.id,
      tenant_id: this.tenantId,
      user_id: conn.userId,
      connected_at: conn.connectedAt,
      last_heartbeat_at: conn.connectedAt,
      status: 'active',
    }).catch((err) => {
      logger.warn({ err, connId: conn.id }, 'Failed to persist connection to DB');
    });

    // 确保幂等：先移除可能存在的旧 listener，防止重复注册导致泄漏
    this.localBus.removeListener('chatops:recommendation_update', conn.listener);
    this.localBus.on('chatops:recommendation_update', conn.listener);
  }

  /**
   * 通过 Redis 广播推荐更新（跨实例）
   * 如果 Redis 可用，发布到 SSE 频道；否则仅使用 localBus
   */
  async broadcastRecommendationUpdate(data: Record<string, unknown>): Promise<void> {
    // 始终通过 localBus 广播（本地实例）
    this.localBus.emit('chatops:recommendation_update', data);

    // 如果 Redis 已初始化，同时发布到 Redis 实现跨实例广播
    if (this.redisSvc && this.redisInitialized) {
      await this.redisSvc.publishSSEEvent(data).catch((err) =>
        logger.warn({ err }, 'Failed to publish SSE event to Redis')
      );
    }
  }

  /**
   * 移除 SSE 连接
   */
  async removeConnection(id: string): Promise<void> {
    const conn = this.runtimeConnections.get(id);
    if (!conn) return;

    this.localBus.removeListener('chatops:recommendation_update', conn.listener);
    clearInterval(conn.heartbeatTimer);
    this.runtimeConnections.delete(id);

    // Mark as disconnected in DB (fire-and-forget)
    this.repo?.markDisconnected(id).catch((err) => logger.warn({ err, connId: id }, 'Failed to mark connection disconnected'));
  }

  /**
   * 优雅关闭: 通知所有客户端并清理
   */
  async shutdown(): Promise<void> {
    const count = this.runtimeConnections.size;
    if (count === 0) return;

    logger.info(`Shutting down ${count} active connections`);

    for (const conn of this.runtimeConnections.values()) {
      try {
        conn.reply?.raw?.write('event: shutdown\ndata: {"reason":"server_shutdown"}\n\n');
      } catch {
        // 连接可能已断开
      }
    }

    // 等待 2 秒让客户端收到关闭通知
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 清理所有连接
    for (const id of this.runtimeConnections.keys()) {
      await this.removeConnection(id);
    }

    // Disconnect all in DB
    await this.repo?.disconnectAll(this.tenantId ?? undefined).catch((err) => logger.warn({ err }, 'Failed to disconnect all connections in DB'));
  }

  /** 获取活跃连接数 */
  getActiveConnectionCount(): number {
    return this.runtimeConnections.size;
  }

  /** 获取按用户分组的连接统计 */
  getConnectionsByUser(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const conn of this.runtimeConnections.values()) {
      counts.set(conn.userId, (counts.get(conn.userId) || 0) + 1);
    }
    return counts;
  }
}
