import { BaseRepository } from '../db/base-repository';

export interface ApprovalFlowConfigEntity {
  id: string;
  tenant_id: string;
  flow_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  capability_ids: string[];
  environments: string[];
  min_risk_level: number;
  max_risk_level: number;
  priority: number;
  nodes: Record<string, any>[];
  version: number;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export class ApprovalFlowConfigRepository extends BaseRepository<ApprovalFlowConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'approval_flow_configs');
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<ApprovalFlowConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM approval_flow_configs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFlowId(flowId: string, tenantId: string): Promise<ApprovalFlowConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM approval_flow_configs WHERE flow_id = $1 AND tenant_id = $2`,
      [flowId, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findMatching(
    tenantId: string,
    capabilityId: string,
    environment: string,
    riskLevel: number,
  ): Promise<ApprovalFlowConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM approval_flow_configs
       WHERE tenant_id = $1 AND enabled = true
       AND (capability_ids ? $2 OR capability_ids @> '["*"]'::jsonb)
       AND (environments ? $3 OR environments @> '["*"]'::jsonb)
       AND ($4 >= min_risk_level AND $4 <= max_risk_level)
       ORDER BY priority DESC, version DESC
       LIMIT 1`,
      [tenantId, capabilityId, environment, riskLevel],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateByFlowId(flowId: string, tenantId: string, data: any): Promise<ApprovalFlowConfigEntity | undefined> {
    const columns = Object.keys(data);
    const values = Object.values(data);

    if (columns.length === 0) return this.findByFlowId(flowId, tenantId);

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const result = await this.db.query(
      `UPDATE approval_flow_configs SET ${setClause}, updated_at = NOW() WHERE flow_id = $${columns.length + 1} AND tenant_id = $${columns.length + 2} RETURNING *`,
      [...values, flowId, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByFlowId(flowId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM approval_flow_configs WHERE flow_id = $1 AND tenant_id = $2`,
      [flowId, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ApprovalFlowConfigEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      flow_id: row.flow_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled ?? true,
      capability_ids: typeof row.capability_ids === 'string' ? JSON.parse(row.capability_ids) : (row.capability_ids ?? []),
      environments: typeof row.environments === 'string' ? JSON.parse(row.environments) : (row.environments ?? []),
      min_risk_level: row.min_risk_level ?? 1,
      max_risk_level: row.max_risk_level ?? 4,
      priority: row.priority ?? 0,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes ?? []),
      version: row.version ?? 1,
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
