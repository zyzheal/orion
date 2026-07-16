import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';

export interface ScriptExecutionEntity {
  id: string;
  tenantId: string;
  scriptId: string;
  version: number;
  status: string;
  targets: Record<string, unknown>;
  params: Record<string, unknown> | null;
  output: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  executedBy: string | null;
  createdAt: Date;
}

export class ScriptExecutionRepository extends BaseRepository<ScriptExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'script_execution');
  }

  async findByScriptId(scriptId: string, limit: number = 20): Promise<ScriptExecutionEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM script_execution WHERE script_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [scriptId, tenantId, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ScriptExecutionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scriptId: row.script_id,
      version: row.version,
      status: row.status,
      targets: typeof row.targets === 'string' ? JSON.parse(row.targets) : (row.targets ?? {}),
      params: typeof row.params === 'string' ? JSON.parse(row.params) : (row.params ?? null),
      output: row.output ?? null,
      error: row.error ?? null,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      durationMs: row.duration_ms ?? null,
      executedBy: row.executed_by ?? null,
      createdAt: row.created_at,
    };
  }
}
