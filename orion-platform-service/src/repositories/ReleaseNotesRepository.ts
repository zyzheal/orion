import { BaseRepository } from '../db/base-repository';

export interface ReleaseNotesEntity {
  id: string;
  deploymentId: string | null;
  version: string | null;
  content: string | null;
  generatedBy: string;
  status: string;
  tenantId: string | null;
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

  protected mapRowToEntity(row: any): ReleaseNotesEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      version: row.version,
      content: row.content,
      generatedBy: row.generated_by,
      status: row.status,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
