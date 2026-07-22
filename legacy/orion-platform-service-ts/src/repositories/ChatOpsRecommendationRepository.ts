import { BaseRepository } from '../db/base-repository';

export interface ChatOpsRecommendationEntity {
  id: string;
  tenantId: string | null;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  actions: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatOpsRecommendationRepository extends BaseRepository<ChatOpsRecommendationEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'chatops_recommendations');
  }

  async findActive(tenantId?: string): Promise<ChatOpsRecommendationEntity[]> {
    let query = `SELECT * FROM chatops_recommendations`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` WHERE tenant_id = $1`;
      params.push(tenantId);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByType(type: string, tenantId?: string): Promise<ChatOpsRecommendationEntity[]> {
    let query = `SELECT * FROM chatops_recommendations WHERE type = $1`;
    const params: unknown[] = [type];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findBySeverity(severity: string, tenantId?: string): Promise<ChatOpsRecommendationEntity[]> {
    let query = `SELECT * FROM chatops_recommendations WHERE severity = $1`;
    const params: unknown[] = [severity];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY created_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async deleteBySource(source: string, tenantId?: string): Promise<number> {
    let query = `DELETE FROM chatops_recommendations WHERE source = $1`;
    const params: unknown[] = [source];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rowCount ?? 0;
  }

  async cleanExpired(ttlMs: number, tenantId?: string): Promise<number> {
    let query = `DELETE FROM chatops_recommendations WHERE created_at < NOW() - INTERVAL '${ttlMs} milliseconds'`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rowCount ?? 0;
  }

  async countActive(tenantId?: string): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM chatops_recommendations`;
    const params: unknown[] = [];
    if (tenantId) {
      query += ` WHERE tenant_id = $1`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): ChatOpsRecommendationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      actions: row.actions ?? [],
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
