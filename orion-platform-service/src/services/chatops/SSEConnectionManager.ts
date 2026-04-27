/**
 * SSE Connection Manager
 *
 * 集中管理所有 Server-Sent Events 连接:
 * 1. 追踪所有活跃的 SSE 连接
 * 2. 优雅关闭时清理所有连接
 * 3. 心跳检测死连接 (30 秒间隔)
 * 4. 安全写入 (writableEnded 检查 + try/catch)
 */

import { EventEmitter } from 'events';
import { FastifyReply } from 'fastify';

export interface SSEConnection {
  id: string;
  userId: string;
  listener: (data: Record<string, unknown>) => void;
  connectedAt: Date;
  heartbeatTimer: ReturnType<typeof setInterval>;
  reply?: FastifyReply;
}

export class SSEConnectionManager {
  private connections: Map<string, SSEConnection> = new Map();
  private localBus: EventEmitter;
  private readonly HEARTBEAT_INTERVAL_MS = 30_000;

  constructor(localBus: EventEmitter) {
    this.localBus = localBus;
  }

  /**
   * 添加新 SSE 连接
   */
  addConnection(conn: Omit<SSEConnection, 'heartbeatTimer'>, reply: FastifyReply): void {
    const heartbeatTimer = setInterval(() => {
      const existing = this.connections.get(conn.id);
      if (!existing) return;

      const raw = reply.raw;
      if (raw?.writableEnded) {
        this.removeConnection(conn.id);
      } else {
        try {
          raw.write(':heartbeat\n\n');
        } catch {
          this.removeConnection(conn.id);
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);

    const fullConn: SSEConnection = { ...conn, heartbeatTimer, reply: conn.reply ?? reply };
    this.connections.set(conn.id, fullConn);
    // 确保幂等：先移除可能存在的旧 listener，防止重复注册导致泄漏
    this.localBus.removeListener('chatops:recommendation_update', conn.listener);
    this.localBus.on('chatops:recommendation_update', conn.listener);
  }

  /**
   * 移除 SSE 连接
   */
  removeConnection(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;

    this.localBus.removeListener('chatops:recommendation_update', conn.listener);
    clearInterval(conn.heartbeatTimer);
    this.connections.delete(id);
  }

  /**
   * 优雅关闭: 通知所有客户端并清理
   */
  async shutdown(): Promise<void> {
    const count = this.connections.size;
    if (count === 0) return;

    console.log(`[SSEConnectionManager] Shutting down ${count} active connections`);

    for (const conn of this.connections.values()) {
      try {
        conn.reply?.raw?.write('event: shutdown\ndata: {"reason":"server_shutdown"}\n\n');
      } catch {
        // 连接可能已断开
      }
    }

    // 等待 2 秒让客户端收到关闭通知
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 清理所有连接
    for (const id of this.connections.keys()) {
      this.removeConnection(id);
    }
  }

  /** 获取活跃连接数 */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /** 获取按用户分组的连接统计 */
  getConnectionsByUser(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const conn of this.connections.values()) {
      counts.set(conn.userId, (counts.get(conn.userId) || 0) + 1);
    }
    return counts;
  }
}
