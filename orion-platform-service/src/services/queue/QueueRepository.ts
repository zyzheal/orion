/**
 * QueueRepository - Database layer for Queue operations
 */
import { DatabasePool } from '../database';

export interface QueueJob {
  id: string;
  tenant_id: string;
  queue: string;
  payload: Record<string, any>;
  status: string;
  attempts: number;
  created_at: Date;
}

export class QueueRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async enqueue(tenantId: string, queue: string, payload: Record<string, any>): Promise<QueueJob> {
    const result = await this.pool.query(
      'INSERT INTO queue_jobs (tenant_id, queue, payload, status, attempts) VALUES ($1, $2, $3, \'pending\', 0) RETURNING *',
      [tenantId, queue, payload]
    );
    return result.rows[0];
  }

  async dequeue(queue: string, limit: number = 1): Promise<QueueJob[]> {
    const result = await this.pool.query(
      "UPDATE queue_jobs SET status = 'processing', attempts = attempts + 1 WHERE id IN (SELECT id FROM queue_jobs WHERE queue = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT $2) RETURNING *",
      [queue, limit]
    );
    return result.rows;
  }

  async complete(id: string): Promise<void> {
    await this.pool.query("UPDATE queue_jobs SET status = 'completed' WHERE id = $1", [id]);
  }

  async fail(id: string): Promise<void> {
    await this.pool.query("UPDATE queue_jobs SET status = 'failed' WHERE id = $1", [id]);
  }

  async findById(id: string): Promise<QueueJob | null> {
    const result = await this.pool.query('SELECT * FROM queue_jobs WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async list(filters: {
    tenantId?: string;
    queue?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<QueueJob[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.tenantId) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(filters.tenantId);
      paramIndex++;
    }
    if (filters.queue) {
      conditions.push(`queue = $${paramIndex}`);
      params.push(filters.queue);
      paramIndex++;
    }
    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const result = await this.pool.query(
      `SELECT * FROM queue_jobs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    return result.rows;
  }

  async countByStatus(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    const result = await this.pool.query(
      "SELECT status, COUNT(*) as count FROM queue_jobs GROUP BY status"
    );
    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of result.rows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
      }
    }
    return stats;
  }
}