import { BaseRepository } from '../db/base-repository';

export interface HealingActionResultEntity {
  id: string;
  actionType: string;
  success: boolean;
  durationMs: number;
  message: string | null;
  error: string | null;
  executedAt: Date;
  verified: boolean;
  rollbackNeeded: boolean;
  rollbackSuccess: boolean | null;
  tenantId: string | null;
  createdAt: Date;
}

export class HealingActionResultRepository extends BaseRepository<HealingActionResultEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'healing_action_results');
  }

  protected mapRowToEntity(row: any): HealingActionResultEntity {
    return {
      id: row.id,
      actionType: row.action_type,
      success: row.success,
      durationMs: row.duration_ms,
      message: row.message,
      error: row.error,
      executedAt: row.executed_at,
      verified: row.verified,
      rollbackNeeded: row.rollback_needed,
      rollbackSuccess: row.rollback_success,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
