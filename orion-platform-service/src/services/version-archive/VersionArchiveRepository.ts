import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface VersionArchiveEntity {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  version: string;
  snapshot: Record<string, unknown>;
  archivedBy: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class VersionArchiveRepository extends BaseRepository<VersionArchiveEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'version_archives');
  }

  async findByResource(resourceType: string, resourceId: string, limit: number = 20): Promise<VersionArchiveEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM version_archives WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [resourceType, resourceId, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<VersionArchiveEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByVersion(resourceType: string, resourceId: string, version: string): Promise<VersionArchiveEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM version_archives WHERE resource_type = $1 AND resource_id = $2 AND version = $3`,
      [resourceType, resourceId, version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async getLatestVersion(resourceType: string, resourceId: string): Promise<VersionArchiveEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM version_archives WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [resourceType, resourceId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): VersionArchiveEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      version: row.version,
      snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : (row.snapshot ?? {}),
      archivedBy: row.archived_by ?? null,
      reason: row.reason ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
