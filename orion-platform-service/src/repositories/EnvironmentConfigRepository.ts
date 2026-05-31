import { BaseRepository } from '../db/base-repository';

export interface EnvironmentConfigEntity {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  type: string;
  cluster: string;
  namespace: string;
  config: string;
  status: string;
  locked: boolean;
  locked_by: string;
  locked_at: Date | null;
  locked_reason: string;
  created_at: Date;
  updated_at: Date;
}

export class EnvironmentConfigRepository extends BaseRepository<EnvironmentConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'environments');
  }

  async findByProjectId(projectId: string): Promise<EnvironmentConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM environments WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<EnvironmentConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM environments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<EnvironmentConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM environments WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async lock(id: string, lockedBy: string, reason: string): Promise<EnvironmentConfigEntity | undefined> {
    const result = await this.db.query(
      `UPDATE environments SET locked = TRUE, locked_by = $2, locked_at = NOW(), locked_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, lockedBy, reason],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async unlock(id: string): Promise<EnvironmentConfigEntity | undefined> {
    const result = await this.db.query(
      `UPDATE environments SET locked = FALSE, locked_by = NULL, locked_at = NULL, locked_reason = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): EnvironmentConfigEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      project_id: row.project_id,
      name: row.name,
      type: row.type,
      cluster: row.cluster,
      namespace: row.namespace,
      config: typeof row.config === 'string' ? row.config : JSON.stringify(row.config || {}),
      status: row.status,
      locked: row.locked,
      locked_by: row.locked_by,
      locked_at: row.locked_at ? new Date(row.locked_at) : null,
      locked_reason: row.locked_reason,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
