import { BaseRepository } from '../db/base-repository';

export interface ConsumerRegistryEntity {
  consumerId: string;
  groupName: string;
  queueName: string;
  lastHeartbeat: Date;
  messagesProcessed: number;
  status: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ConsumerRegistryRepository extends BaseRepository<ConsumerRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'consumer_registry');
  }

  async findByQueueName(queueName: string): Promise<ConsumerRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM consumer_registry WHERE queue_name = $1 ORDER BY last_heartbeat DESC`,
      [queueName],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async heartbeat(consumerId: string): Promise<void> {
    await this.db.query(
      `UPDATE consumer_registry SET last_heartbeat = NOW(), updated_at = NOW() WHERE consumer_id = $1`,
      [consumerId],
    );
  }

  async markDead(consumerId: string): Promise<void> {
    await this.db.query(
      `UPDATE consumer_registry SET status = 'dead', updated_at = NOW() WHERE consumer_id = $1`,
      [consumerId],
    );
  }

  protected mapRowToEntity(row: any): ConsumerRegistryEntity {
    return {
      consumerId: row.consumer_id,
      groupName: row.group_name,
      queueName: row.queue_name,
      lastHeartbeat: row.last_heartbeat,
      messagesProcessed: row.messages_processed,
      status: row.status,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
