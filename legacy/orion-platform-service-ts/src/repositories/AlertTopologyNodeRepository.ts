import { BaseRepository } from '../db/base-repository';

export interface AlertTopologyNodeEntity {
  id: string;
  tenantId: string;
  nodeType: string;
  name: string;
  status: string;
  parentId: string | null;
  childrenIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class AlertTopologyNodeRepository extends BaseRepository<AlertTopologyNodeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_topology_nodes');
  }

  async findByTenantId(tenantId: string): Promise<AlertTopologyNodeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_topology_nodes WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByParentId(parentId: string): Promise<AlertTopologyNodeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_topology_nodes WHERE parent_id = $1 ORDER BY created_at`,
      [parentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.query(
      `UPDATE alert_topology_nodes SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_topology_nodes WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): AlertTopologyNodeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      nodeType: row.node_type,
      name: row.name,
      status: row.status,
      parentId: row.parent_id,
      childrenIds: row.children_ids || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
