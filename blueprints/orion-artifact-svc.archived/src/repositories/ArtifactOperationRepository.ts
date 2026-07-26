/**
 * ArtifactOperationRepository — PostgreSQL data access for artifact operations.
 */
import { DatabasePool } from '../utils/database';

export interface ArtifactOperationEntity {
  id: string;
  tenant_id: string;
  artifact_id: string;
  operation: string;
  source: string | null;
  target: string | null;
  metadata: Record<string, any>;
  status: string;
  initiated_by: string | null;
  created_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
}

export interface FindResult {
  entities: ArtifactOperationEntity[];
  total: number;
}

export class ArtifactOperationRepository {
  constructor(private pool: DatabasePool) {}

  async create(data: {
    id: string; tenant_id: string; artifact_id: string;
    operation: string; source: string | null; target: string | null;
    metadata: Record<string, any>; status: string; initiated_by: string | null;
  }): Promise<ArtifactOperationEntity> {
    const result = await this.pool.query(
      `INSERT INTO artifact_operations (id, tenant_id, artifact_id, operation, source, target, metadata, status, initiated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.id, data.tenant_id, data.artifact_id, data.operation, data.source, data.target, data.metadata, data.status, data.initiated_by]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<ArtifactOperationEntity | null> {
    const result = await this.pool.query('SELECT * FROM artifact_operations WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByTenant(
    tenantId: string,
    filters?: { artifactId?: string; operation?: string; status?: string; startDate?: string; endDate?: string; initiatedBy?: string },
    pagination?: { limit: number; orderBy: string; orderDir: string },
  ): Promise<FindResult> {
    let query = 'SELECT * FROM artifact_operations WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters?.artifactId) { query += ` AND artifact_id = $${idx++}`; params.push(filters.artifactId); }
    if (filters?.operation) { query += ` AND operation = $${idx++}`; params.push(filters.operation); }
    if (filters?.status) { query += ` AND status = $${idx++}`; params.push(filters.status); }
    if (filters?.startDate) { query += ` AND created_at >= $${idx++}`; params.push(filters.startDate); }
    if (filters?.endDate) { query += ` AND created_at <= $${idx++}`; params.push(filters.endDate); }
    if (filters?.initiatedBy) { query += ` AND initiated_by = $${idx++}`; params.push(filters.initiatedBy); }

    const orderBy = pagination?.orderBy || 'created_at';
    const orderDir = pagination?.orderDir || 'DESC';
    const limit = pagination?.limit || 100;
    query += ` ORDER BY ${orderBy} ${orderDir} LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, 0);

    const result = await this.pool.query(query, params);
    return { entities: result.rows, total: result.rows.length };
  }

  async updateStatus(
    id: string, status: string, completedAt: Date | null, durationMs: number | null,
  ): Promise<ArtifactOperationEntity | null> {
    const result = await this.pool.query(
      'UPDATE artifact_operations SET status = $1, completed_at = $2, duration_ms = $3 WHERE id = $4 RETURNING *',
      [status, completedAt, durationMs, id]
    );
    return result.rows[0] || null;
  }

  async getTenantStats(tenantId: string): Promise<{
    totalOperations: number; operationsByType: Record<string, number>;
    operationsByStatus: Record<string, number>; uniqueArtifacts: number;
    averageDuration: number; successRate: number;
  }> {
    const total = await this.pool.query('SELECT COUNT(*) FROM artifact_operations WHERE tenant_id = $1', [tenantId]);
    const unique = await this.pool.query('SELECT COUNT(DISTINCT artifact_id) FROM artifact_operations WHERE tenant_id = $1', [tenantId]);
    const success = await this.pool.query('SELECT COUNT(*) FROM artifact_operations WHERE tenant_id = $1 AND status = $2', [tenantId, 'completed']);
    return {
      totalOperations: parseInt(total.rows[0]?.count || '0', 10),
      operationsByType: {}, operationsByStatus: {},
      uniqueArtifacts: parseInt(unique.rows[0]?.count || '0', 10),
      averageDuration: 0,
      successRate: parseInt(total.rows[0]?.count || '0', 10) > 0
        ? parseInt(success.rows[0]?.count || '0', 10) / parseInt(total.rows[0]?.count || '1', 10) * 100
        : 0,
    };
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.pool.query('DELETE FROM artifact_operations WHERE tenant_id = $1', [tenantId]);
    return result.rowCount || 0;
  }
}
