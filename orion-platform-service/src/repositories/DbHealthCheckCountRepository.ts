import { BaseRepository } from '../db/base-repository';

export interface DbHealthCheckCountEntity {
  id: string;
  nodeId: string;
  checkCount: number;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DbHealthCheckCountRepository extends BaseRepository<DbHealthCheckCountEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_health_check_counts');
  }

  async findByNodeId(nodeId: string, tenantId?: string): Promise<DbHealthCheckCountEntity | undefined> {
    let query = `SELECT * FROM db_health_check_counts WHERE node_id = $1`;
    const params: any[] = [nodeId];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsertCount(nodeId: string, count: number, tenantId?: string): Promise<DbHealthCheckCountEntity> {
    const existing = await this.findByNodeId(nodeId, tenantId);
    if (existing) {
      return this.update(existing.id, { check_count: count, updated_at: new Date() });
    }
    return this.create({
      id: `hcc-${nodeId}-${Date.now()}`,
      node_id: nodeId,
      check_count: count,
      tenant_id: tenantId || null,
    });
  }

  async deleteByNodeId(nodeId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM db_health_check_counts WHERE node_id = $1`,
      [nodeId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_health_check_counts`);
  }

  protected mapRowToEntity(row: any): DbHealthCheckCountEntity {
    return {
      id: row.id,
      nodeId: row.node_id,
      checkCount: parseInt(row.check_count, 10),
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
