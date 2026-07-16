import { BaseRepository } from '../db/base-repository';

export interface AlertTopologyEdgeEntity {
  id: string;
  tenantId: string;
  source: string;
  target: string;
  relationType: string;
  createdAt: Date;
}

export class AlertTopologyEdgeRepository extends BaseRepository<AlertTopologyEdgeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_topology_edges');
  }

  async findByTenantId(tenantId: string): Promise<AlertTopologyEdgeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_topology_edges WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_topology_edges WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  async findEdgesBySource(source: string, tenantId?: string): Promise<AlertTopologyEdgeEntity[]> {
    let query = `SELECT * FROM alert_topology_edges WHERE source = $1`;
    const params: any[] = [source];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEdgesByTarget(target: string, tenantId?: string): Promise<AlertTopologyEdgeEntity[]> {
    let query = `SELECT * FROM alert_topology_edges WHERE target = $1`;
    const params: any[] = [target];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AlertTopologyEdgeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      source: row.source,
      target: row.target,
      relationType: row.relation_type,
      createdAt: row.created_at,
    };
  }
}
