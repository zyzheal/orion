import { BaseRepository } from '../db/base-repository';

export interface ChatOpsSSEConnectionEntity {
  id: string;
  tenantId: string | null;
  userId: string;
  connectedAt: Date;
  lastHeartbeatAt: Date;
  status: string;
}

export class ChatOpsSSEConnectionRepository extends BaseRepository<ChatOpsSSEConnectionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'chatops_sse_connections');
  }

  async findByUserId(userId: string): Promise<ChatOpsSSEConnectionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_sse_connections WHERE user_id = $1 AND status = 'active' ORDER BY connected_at DESC`,
      [userId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM chatops_sse_connections WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async findActive(tenantId?: string): Promise<ChatOpsSSEConnectionEntity[]> {
    let query = `SELECT * FROM chatops_sse_connections WHERE status = 'active'`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    query += ` ORDER BY connected_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async countActive(tenantId?: string): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM chatops_sse_connections WHERE status = 'active'`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  async updateHeartbeat(id: string): Promise<void> {
    await this.db.query(
      `UPDATE chatops_sse_connections SET last_heartbeat_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markDisconnected(id: string): Promise<void> {
    await this.db.query(
      `UPDATE chatops_sse_connections SET status = 'disconnected', updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async disconnectAllByUserId(userId: string): Promise<number> {
    const result = await this.db.query(
      `UPDATE chatops_sse_connections SET status = 'disconnected', updated_at = NOW() WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );
    return result.rowCount ?? 0;
  }

  async disconnectAll(tenantId?: string): Promise<number> {
    let query = `UPDATE chatops_sse_connections SET status = 'disconnected', updated_at = NOW() WHERE status = 'active'`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ChatOpsSSEConnectionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      connectedAt: row.connected_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      status: row.status,
    };
  }
}
