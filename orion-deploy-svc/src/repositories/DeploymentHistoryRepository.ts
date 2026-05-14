import { Pool } from 'pg';

type DbClient = Pool | { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

export interface DeploymentHistoryEntity {
  id: string;
  tenantId: string | null;
  projectId: string | null;
  pipelineRunId: string | null;
  buildId: string | null;
  environment: string;
  status: string;
  strategy: string;
  config: Record<string, unknown> | null;
  deployedBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  rollbackTo: string | null;
  commitSha: string | null;
  commitCommittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindAllResult { entities: DeploymentHistoryEntity[]; total: number; }

export class DeploymentHistoryRepository {
  private pool: DbClient | null;

  constructor(pool: DbClient | null) {
    this.pool = pool;
  }

  async create(_input: Record<string, unknown>): Promise<DeploymentHistoryEntity> { throw new Error('Not implemented'); }
  async findById(_id: string): Promise<DeploymentHistoryEntity | null> { return null; }
  async findByRunId(_runId: string): Promise<DeploymentHistoryEntity[]> { return []; }
  async findAll(_opts?: { limit?: number }): Promise<FindAllResult> { return { entities: [], total: 0 }; }
  async findByEnvironment(_env: string): Promise<DeploymentHistoryEntity[]> { return []; }
  async findByPipelineRunId(_runId: string): Promise<DeploymentHistoryEntity[]> { return []; }
  async findByBuildId(_buildId: string): Promise<DeploymentHistoryEntity[]> { return []; }
  async updateStatus(_id: string, _status: string, _completedAt?: Date | null, _error?: string | null): Promise<void> { /* stub */ }
}
