import { Pool } from 'pg';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface RollbackEntity {
  id: string;
  deploymentId: string;
  rollbackType: string;
  reason: string;
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  previousVersion: string | null;
  targetVersion: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface FindAllResult { entities: RollbackEntity[]; total: number; }

export class RollbackRepository {
  private pool: DbClient | null;

  constructor(pool: DbClient | null) {
    this.pool = pool;
  }

  async create(_input: Record<string, unknown>): Promise<RollbackEntity> { throw new Error('Not implemented'); }
  async findById(_id: string): Promise<RollbackEntity | null> { return null; }
  async findByRunId(_runId: string): Promise<RollbackEntity | null> { return null; }
  async findByDeploymentId(_deploymentId: string): Promise<RollbackEntity[]> { return []; }
  async findAll(_opts?: { limit?: number }): Promise<FindAllResult> { return { entities: [], total: 0 }; }
  async updateStatus(_id: string, _status: string, _completedAt?: Date, _error?: string): Promise<void> { /* stub */ }
}
