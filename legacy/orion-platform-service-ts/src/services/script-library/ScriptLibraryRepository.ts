import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ScriptLibraryEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  scriptType: string;
  category: string | null;
  tags: string[];
  latestVersion: number;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ScriptLibraryRepository extends BaseRepository<ScriptLibraryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'script_library');
  }

  async findByTenant(options: FindAllOptions = {}): Promise<FindAllResult<ScriptLibraryEntity>> {
    const tenantId = getCurrentTenantId();
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findByCategory(category: string): Promise<ScriptLibraryEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_library WHERE tenant_id = $1 AND category = $2 ORDER BY name`,
      [tenantId, category],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<ScriptLibraryEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_library WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ScriptLibraryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      scriptType: row.script_type,
      category: row.category ?? null,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
      latestVersion: row.latest_version ?? 1,
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
