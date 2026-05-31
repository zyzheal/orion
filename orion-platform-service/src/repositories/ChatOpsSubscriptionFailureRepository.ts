import { BaseRepository } from '../db/base-repository';

export interface ChatOpsSubscriptionFailureEntity {
  id: string;
  tenantId: string | null;
  eventType: string;
  errorMessage: string;
  retryCount: number;
  lastRetryAt: Date;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatOpsSubscriptionFailureRepository extends BaseRepository<ChatOpsSubscriptionFailureEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'chatops_subscription_failures');
  }

  async findByEventType(eventType: string): Promise<ChatOpsSubscriptionFailureEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM chatops_subscription_failures WHERE event_type = $1 AND resolved = false ORDER BY created_at DESC LIMIT 1`,
      [eventType],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findUnresolved(tenantId?: string): Promise<ChatOpsSubscriptionFailureEntity[]> {
    let query = `SELECT * FROM chatops_subscription_failures WHERE resolved = false`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async markResolved(eventType: string): Promise<void> {
    await this.db.query(
      `UPDATE chatops_subscription_failures SET resolved = true, updated_at = NOW() WHERE event_type = $1 AND resolved = false`,
      [eventType],
    );
  }

  async incrementRetryCount(eventType: string): Promise<void> {
    await this.db.query(
      `UPDATE chatops_subscription_failures SET retry_count = retry_count + 1, last_retry_at = NOW(), updated_at = NOW() WHERE event_type = $1 AND resolved = false`,
      [eventType],
    );
  }

  async upsertFailure(eventType: string, errorMessage: string, tenantId?: string): Promise<ChatOpsSubscriptionFailureEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_subscription_failures (id, tenant_id, event_type, error_message, retry_count, last_retry_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, 1, NOW())
       ON CONFLICT (event_type) DO UPDATE SET
         error_message = EXCLUDED.error_message,
         retry_count = chatops_subscription_failures.retry_count + 1,
         last_retry_at = NOW(),
         resolved = false,
         updated_at = NOW()
       RETURNING *`,
      [tenantId ?? null, eventType, errorMessage],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsSubscriptionFailureEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      lastRetryAt: row.last_retry_at,
      resolved: row.resolved,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
