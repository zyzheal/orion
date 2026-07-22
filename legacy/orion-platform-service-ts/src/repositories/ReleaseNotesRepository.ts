import { BaseRepository } from '../db/base-repository';

export interface ReleaseNotesEntity {
  id: string;
  deploymentId: string | null;
  tenantId: string | null;
  version: string | null;
  environment: string | null;
  generatedAt: Date;
  summary: string | null;
  changes: any[];
  metrics: Record<string, any> | null;
  notes: string | null;
  content: string | null;
  generatedBy: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ReleaseNotesRepository extends BaseRepository<ReleaseNotesEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'release_notes');
  }

  async findByDeploymentId(deploymentId: string): Promise<ReleaseNotesEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM release_notes WHERE deployment_id = $1 LIMIT 1`,
      [deploymentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByVersion(version: string): Promise<ReleaseNotesEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM release_notes WHERE version = $1 LIMIT 1`,
      [version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, limit?: number): Promise<ReleaseNotesEntity[]> {
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM release_notes WHERE tenant_id = $1 ORDER BY generated_at DESC, created_at DESC LIMIT $2`,
      [tenantId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEnvironment(environment: string, tenantId: string): Promise<ReleaseNotesEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM release_notes WHERE environment = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [environment, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByDeploymentId(deploymentId: string, data: Partial<ReleaseNotesEntity>): Promise<ReleaseNotesEntity> {
    const existing = await this.findByDeploymentId(deploymentId);
    if (existing) {
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.version !== undefined) { setClauses.push(`version = $${paramIndex++}`); params.push(data.version); }
      if (data.environment !== undefined) { setClauses.push(`environment = $${paramIndex++}`); params.push(data.environment); }
      if (data.summary !== undefined) { setClauses.push(`summary = $${paramIndex++}`); params.push(data.summary); }
      if (data.changes !== undefined) { setClauses.push(`changes = $${paramIndex++}`); params.push(JSON.stringify(data.changes)); }
      if (data.metrics !== undefined) { setClauses.push(`metrics = $${paramIndex++}`); params.push(JSON.stringify(data.metrics)); }
      if (data.notes !== undefined) { setClauses.push(`notes = $${paramIndex++}`); params.push(data.notes); }

      params.push(deploymentId);
      const result = await this.db.query(
        `UPDATE release_notes SET ${setClauses.join(', ')} WHERE deployment_id = $${paramIndex} RETURNING *`,
        params,
      );
      return this.mapRowToEntity(result.rows[0]);
    }

    return this.create({
      id: data.id,
      deploymentId,
      tenantId: data.tenantId,
      version: data.version,
      environment: data.environment,
      generatedAt: data.generatedAt ?? new Date(),
      summary: data.summary,
      changes: data.changes ?? [],
      metrics: data.metrics,
      notes: data.notes,
      content: data.content ?? null,
      generatedBy: data.generatedBy ?? 'system',
      status: data.status ?? 'draft',
    });
  }

  async deleteByDeploymentId(deploymentId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM release_notes WHERE deployment_id = $1`,
      [deploymentId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ReleaseNotesEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenantId: row.tenant_id,
      version: row.version,
      environment: row.environment ?? null,
      generatedAt: row.generated_at ?? row.created_at,
      summary: row.summary ?? null,
      changes: row.changes ?? [],
      metrics: row.metrics ?? null,
      notes: row.notes ?? null,
      content: row.content,
      generatedBy: row.generated_by ?? 'system',
      status: row.status ?? 'draft',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
