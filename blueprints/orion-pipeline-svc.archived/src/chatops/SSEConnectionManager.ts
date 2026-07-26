/**
 * SSE Connection Manager for Pipeline log streaming
 *
 * Manages Server-Sent Events connections for real-time log delivery.
 */
import { FastifyReply } from 'fastify';

export interface SSEConnection {
  id: string;
  userId: string;
  listener: (data: Record<string, unknown>) => void;
  connectedAt: Date;
  heartbeatTimer?: NodeJS.Timeout;
}

export class SSEConnectionManager {
  private connections = new Map<string, { conn: SSEConnection; reply: FastifyReply }>();
  private eventBus: import('events').EventEmitter;

  constructor(eventBus: import('events').EventEmitter) {
    this.eventBus = eventBus;
  }

  async addConnection(conn: SSEConnection, reply: FastifyReply): Promise<void> {
    this.connections.set(conn.id, { conn, reply });

    // Setup heartbeat
    const timer = setInterval(() => {
      try {
        if (reply.raw?.writableEnded) {
          this.removeConnection(conn.id);
          return;
        }
        reply.raw?.write(':\n\n'); // SSE comment as heartbeat
      } catch {
        this.removeConnection(conn.id);
      }
    }, 30000);
    conn.heartbeatTimer = timer;

    // Subscribe to pipeline events for this connection
    this.eventBus.on(`pipeline:${conn.id}:update`, conn.listener);
  }

  async removeConnection(connectionId: string): Promise<void> {
    const entry = this.connections.get(connectionId);
    if (entry) {
      if (entry.conn.heartbeatTimer) {
        clearInterval(entry.conn.heartbeatTimer);
      }
      this.eventBus.off(`pipeline:${connectionId}:update`, entry.conn.listener);
      this.connections.delete(connectionId);
    }
  }

  async shutdown(): Promise<void> {
    for (const [id, entry] of this.connections) {
      if (entry.conn.heartbeatTimer) {
        clearInterval(entry.conn.heartbeatTimer);
      }
      try {
        entry.reply.raw?.end();
      } catch { /* ignore */ }
    }
    this.connections.clear();
  }

  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionsByUser(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { conn } of this.connections.values()) {
      counts.set(conn.userId, (counts.get(conn.userId) || 0) + 1);
    }
    return counts;
  }
}
