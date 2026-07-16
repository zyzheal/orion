import { BaseRepository } from '../db/base-repository';

export interface DeadLetterMessageEntity {
  id: string;
  originalQueueId: string | null;
  queueName: string;
  taskId: string | null;
  payload: Record<string, any>;
  retryCount: number;
  lastError: string | null;
  deadReason: string | null;
  deadAt: Date;
  replayStatus: string | null;
  tenantId: string | null;
  createdAt: Date;
}

export class DeadLetterMessageRepository extends BaseRepository<DeadLetterMessageEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'dead_letter_messages');
  }

  async findByQueueName(queueName: string, limit: number = 100): Promise<DeadLetterMessageEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dead_letter_messages WHERE queue_name = $1 ORDER BY dead_at DESC LIMIT $2`,
      [queueName, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateReplayStatus(id: string, status: string): Promise<DeadLetterMessageEntity> {
    const result = await this.db.query(
      `UPDATE dead_letter_messages SET replay_status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DeadLetterMessageEntity {
    return {
      id: row.id,
      originalQueueId: row.original_queue_id,
      queueName: row.queue_name,
      taskId: row.task_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {}),
      retryCount: row.retry_count,
      lastError: row.last_error,
      deadReason: row.dead_reason,
      deadAt: row.dead_at,
      replayStatus: row.replay_status,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
