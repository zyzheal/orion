import { BaseRepository } from '../db/base-repository';

export interface ProgressiveDeploymentEntity {
  id: string;
  deploymentId: string;
  tenantId: string;
  phase: string;
  strategy: string;
  currentTrafficPercent: number;
  targetTrafficPercent: number;
  errorRate: number;
  startedAt: Date;
  lastIncrementAt: Date | null;
  completedAt: Date | null;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ProgressiveDeploymentRepository extends BaseRepository<ProgressiveDeploymentEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'progressive_deployments');
  }

  async findByDeploymentId(deploymentId: string): Promise<ProgressiveDeploymentEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM progressive_deployments WHERE deployment_id = $1 LIMIT 1`,
      [deploymentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenantId(tenantId: string, limit?: number): Promise<ProgressiveDeploymentEntity[]> {
    const limitValue = limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM progressive_deployments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limitValue],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActiveByTenant(tenantId: string): Promise<ProgressiveDeploymentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM progressive_deployments WHERE tenant_id = $1 AND phase NOT IN ('complete', 'rolled_back') ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPhase(phase: string, tenantId: string): Promise<ProgressiveDeploymentEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM progressive_deployments WHERE phase = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [phase, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updatePhase(deploymentId: string, phase: string, updates?: {
    currentTrafficPercent?: number;
    errorRate?: number;
    lastIncrementAt?: Date;
    completedAt?: Date;
  }): Promise<void> {
    const setClauses: string[] = ['phase = $1', 'updated_at = NOW()'];
    const params: any[] = [phase];
    let paramIndex = 2;

    if (updates?.currentTrafficPercent !== undefined) {
      setClauses.push(`current_traffic_percent = $${paramIndex++}`);
      params.push(updates.currentTrafficPercent);
    }
    if (updates?.errorRate !== undefined) {
      setClauses.push(`error_rate = $${paramIndex++}`);
      params.push(updates.errorRate);
    }
    if (updates?.lastIncrementAt !== undefined) {
      setClauses.push(`last_increment_at = $${paramIndex++}`);
      params.push(updates.lastIncrementAt);
    }
    if (updates?.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      params.push(updates.completedAt);
    }

    params.push(deploymentId);
    await this.db.query(
      `UPDATE progressive_deployments SET ${setClauses.join(', ')} WHERE deployment_id = $${paramIndex}`,
      params,
    );
  }

  async deleteByDeploymentId(deploymentId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM progressive_deployments WHERE deployment_id = $1`,
      [deploymentId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteCompletedOlderThan(olderThanDate: Date, tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM progressive_deployments WHERE tenant_id = $1 AND phase IN ('complete', 'rolled_back') AND (completed_at < $2 OR (completed_at IS NULL AND started_at < $2))`,
      [tenantId, olderThanDate],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): ProgressiveDeploymentEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenantId: row.tenant_id,
      phase: row.phase ?? 'initial',
      strategy: row.strategy ?? 'canary',
      currentTrafficPercent: parseFloat(row.current_traffic_percent) ?? 0,
      targetTrafficPercent: parseFloat(row.target_traffic_percent) ?? 100,
      errorRate: parseFloat(row.error_rate) ?? 0,
      startedAt: row.started_at,
      lastIncrementAt: row.last_increment_at ?? null,
      completedAt: row.completed_at ?? null,
      config: row.config ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
