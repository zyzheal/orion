import { BaseRepository } from '../db/base-repository';

export interface HookChainExecutionEntity {
  id: string;
  chainId: string;
  executionId: string;
  triggerSource: string | null;
  success: boolean;
  hookResults: any[];
  totalDurationMs: number | null;
  finalOutput: Record<string, any> | null;
  error: string | null;
  executedAt: Date;
  tenantId: string | null;
  createdAt: Date;
}

export class HookChainExecutionRepository extends BaseRepository<HookChainExecutionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'hook_chain_executions');
  }

  async findByChainId(chainId: string, limit: number = 50): Promise<HookChainExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM hook_chain_executions WHERE chain_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [chainId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): HookChainExecutionEntity {
    return {
      id: row.id,
      chainId: row.chain_id,
      executionId: row.execution_id,
      triggerSource: row.trigger_source,
      success: row.success,
      hookResults: typeof row.hook_results === 'string' ? JSON.parse(row.hook_results) : (row.hook_results || []),
      totalDurationMs: row.total_duration_ms,
      finalOutput: typeof row.final_output === 'string' ? JSON.parse(row.final_output) : row.final_output,
      error: row.error,
      executedAt: row.executed_at,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
