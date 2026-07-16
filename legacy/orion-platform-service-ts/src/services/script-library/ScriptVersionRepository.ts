import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ScriptVersionEntity {
  id: string;
  tenantId: string;
  scriptId: string;
  version: number;
  content: string;
  changelog: string | null;
  checksum: string;
  createdBy: string | null;
  createdAt: Date;
}

export class ScriptVersionRepository extends BaseRepository<ScriptVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'script_version');
  }

  async findByScriptId(scriptId: string): Promise<ScriptVersionEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_version WHERE script_id = $1 AND tenant_id = $2 ORDER BY version DESC`,
      [scriptId, tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByScriptAndVersion(scriptId: string, version: number): Promise<ScriptVersionEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_version WHERE script_id = $1 AND version = $2 AND tenant_id = $3`,
      [scriptId, version, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findLatest(scriptId: string): Promise<ScriptVersionEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_version WHERE script_id = $1 AND tenant_id = $2 ORDER BY version DESC LIMIT 1`,
      [scriptId, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ScriptVersionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scriptId: row.script_id,
      version: row.version,
      content: row.content,
      changelog: row.changelog ?? null,
      checksum: row.checksum,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
    };
  }
}
