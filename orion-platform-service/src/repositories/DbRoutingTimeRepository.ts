import { BaseRepository } from '../db/base-repository';

export interface DbRoutingTimeEntity {
  id: string;
  nodeId: string;
  lastRoutingTime: Date;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class DbRoutingTimeRepository extends BaseRepository<DbRoutingTimeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'db_routing_times');
  }

  async findByNodeId(nodeId: string, tenantId?: string): Promise<DbRoutingTimeEntity | undefined> {
    let query = `SELECT * FROM db_routing_times WHERE node_id = $1`;
    const params: any[] = [nodeId];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsertRoutingTime(nodeId: string, routingTime: Date, tenantId?: string): Promise<DbRoutingTimeEntity> {
    const existing = await this.findByNodeId(nodeId, tenantId);
    if (existing) {
      return this.update(existing.id, { last_routing_time: routingTime, updated_at: new Date() });
    }
    return this.create({
      id: `rt-${nodeId}-${Date.now()}`,
      node_id: nodeId,
      last_routing_time: routingTime,
      tenant_id: tenantId || null,
    });
  }

  async deleteByNodeId(nodeId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM db_routing_times WHERE node_id = $1`,
      [nodeId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAll(): Promise<void> {
    await this.db.query(`DELETE FROM db_routing_times`);
  }

  protected mapRowToEntity(row: any): DbRoutingTimeEntity {
    return {
      id: row.id,
      nodeId: row.node_id,
      lastRoutingTime: row.last_routing_time,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
