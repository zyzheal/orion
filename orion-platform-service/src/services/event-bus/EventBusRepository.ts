/**
 * EventBusRepository - Database layer for Event Bus operations
 */
import { DatabasePool } from '../database';

export interface EventSubscription {
  id: string;
  tenant_id: string;
  event_type: string;
  handler: string;
  enabled: boolean;
}

export interface EventLog {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, any>;
  processed: boolean;
  created_at: Date;
}

export class EventBusRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async subscribe(tenantId: string, eventType: string, handler: string): Promise<EventSubscription> {
    const result = await this.pool.query(
      'INSERT INTO event_subscriptions (tenant_id, event_type, handler, enabled) VALUES ($1, $2, $3, true) RETURNING *',
      [tenantId, eventType, handler]
    );
    return result.rows[0];
  }

  async unsubscribe(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM event_subscriptions WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async getSubscriptions(tenantId: string, eventType?: string): Promise<EventSubscription[]> {
    let query = 'SELECT * FROM event_subscriptions WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (eventType) { params.push(eventType); query += ' AND event_type = $2'; }
    return (await this.pool.query(query, params)).rows;
  }

  async logEvent(tenantId: string, eventType: string, payload: Record<string, any>): Promise<EventLog> {
    const result = await this.pool.query(
      'INSERT INTO event_logs (tenant_id, event_type, payload, processed) VALUES ($1, $2, $3, false) RETURNING *',
      [tenantId, eventType, payload]
    );
    return result.rows[0];
  }

  async getEventLogs(tenantId: string, limit: number = 100): Promise<EventLog[]> {
    return (await this.pool.query(
      'SELECT * FROM event_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit]
    )).rows;
  }
}