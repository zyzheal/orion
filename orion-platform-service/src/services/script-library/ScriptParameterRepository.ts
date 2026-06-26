import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ScriptParameterEntity {
  id: string;
  tenantId: string;
  scriptId: string;
  paramKey: string;
  paramType: string;
  label: string;
  required: boolean;
  defaultValue: string | null;
  description: string | null;
  sortOrder: number;
}

export class ScriptParameterRepository extends BaseRepository<ScriptParameterEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'script_parameter');
  }

  async findByScriptId(scriptId: string): Promise<ScriptParameterEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_parameter WHERE script_id = $1 AND tenant_id = $2 ORDER BY sort_order, param_key`,
      [scriptId, tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async upsertBulk(scriptId: string, params: Array<{
    paramKey: string;
    paramType: string;
    label: string;
    required?: boolean;
    defaultValue?: string;
    description?: string;
    sortOrder?: number;
  }>): Promise<ScriptParameterEntity[]> {
    const tenantId = getCurrentTenantId();

    // Delete existing parameters for this script (tenant-scoped)
    await this.db.query(
      `DELETE FROM script_parameter WHERE script_id = $1 AND tenant_id = $2`,
      [scriptId, tenantId],
    );

    if (params.length === 0) return [];

    // Insert new parameters
    const inserted: ScriptParameterEntity[] = [];
    for (const param of params) {
      const result = await this.db.query(
        `INSERT INTO script_parameter (id, tenant_id, script_id, param_key, param_type, label, required, default_value, description, sort_order)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          tenantId,
          scriptId,
          param.paramKey,
          param.paramType,
          param.label,
          param.required ?? false,
          param.defaultValue ?? null,
          param.description ?? null,
          param.sortOrder ?? 0,
        ],
      );
      inserted.push(this.mapRowToEntity(result.rows[0]));
    }

    return inserted;
  }

  protected mapRowToEntity(row: any): ScriptParameterEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scriptId: row.script_id,
      paramKey: row.param_key,
      paramType: row.param_type,
      label: row.label,
      required: row.required,
      defaultValue: row.default_value ?? null,
      description: row.description ?? null,
      sortOrder: row.sort_order ?? 0,
    };
  }
}
