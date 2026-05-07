import { DatabasePool } from '../database';
/**
 * Canary Traffic Service - Phase 3
 *
 * Manages canary deployments and traffic splitting:
 * - Creating canary deployments
 * - Configuring traffic split percentages
 * - Promoting canary to production
 * - Rolling back canary deployments
 */

// ==================== Types ====================

export interface CanaryDeployment {
  id: string;
  tenant_id: string;
  deployment_id: string;
  service_name: string;
  canary_version: string;
  baseline_version: string;
  initial_percent: number;
  current_percent: number;
  max_percent: number;
  status: 'running' | 'paused' | 'promoted' | 'rolled_back' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface TrafficSplit {
  canaryId: string;
  canaryPercent: number;
  baselinePercent: number;
  updatedAt: Date;
}

export interface CreateCanaryInput {
  tenant_id: string;
  deployment_id: string;
  service_name: string;
  canary_version: string;
  baseline_version: string;
  initial_percent?: number;
  max_percent?: number;
}

// ==================== Service ====================

export class CanaryTrafficService {

  constructor(private pool: DatabasePool) {}

  /**
   * Create a new canary deployment
   */
  async createCanaryDeployment(tenantId: string, input: CreateCanaryInput): Promise<CanaryDeployment> {
    const initialPercent = input.initial_percent ?? 5;
    const maxPercent = input.max_percent ?? 100;

    const result = await this.pool.query(
      `INSERT INTO canary_deployments
        (tenant_id, deployment_id, service_name, canary_version, baseline_version,
         initial_percent, current_percent, max_percent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'running')
       RETURNING *`,
      [
        tenantId,
        input.deployment_id,
        input.service_name,
        input.canary_version,
        input.baseline_version,
        initialPercent,
        maxPercent,
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * List canary deployments for a tenant
   */
  async listCanaryDeployments(tenantId: string, status?: string): Promise<CanaryDeployment[]> {
    let query = 'SELECT * FROM canary_deployments WHERE tenant_id = $1';
    const params: any[] = [tenantId];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map((r: any) => this.mapRow(r));
  }

  /**
   * Get a canary deployment by ID
   */
  async getCanaryDeployment(canaryId: string): Promise<CanaryDeployment | null> {
    const result = await this.pool.query(
      'SELECT * FROM canary_deployments WHERE id = $1',
      [canaryId]
    );
    if (!result.rows[0]) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Configure traffic split percentage for a canary deployment
   */
  async configureTrafficSplit(canaryId: string, percent: number): Promise<TrafficSplit> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error('Canary deployment not found');
    }
    if (canary.status !== 'running' && canary.status !== 'paused') {
      throw new Error('Canary deployment is not in a running state');
    }
    if (percent < 0 || percent > canary.max_percent) {
      throw new Error(`Traffic percent must be between 0 and ${canary.max_percent}`);
    }

    const result = await this.pool.query(
      `UPDATE canary_deployments
       SET current_percent = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [canaryId, percent]
    );

    const updated = this.mapRow(result.rows[0]);

    return {
      canaryId: updated.id,
      canaryPercent: updated.current_percent,
      baselinePercent: 100 - updated.current_percent,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * Promote a canary deployment to production (100% traffic)
   */
  async promoteCanary(canaryId: string): Promise<CanaryDeployment> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error('Canary deployment not found');
    }
    if (canary.status !== 'running' && canary.status !== 'paused') {
      throw new Error(`Cannot promote canary in '${canary.status}' state`);
    }

    const result = await this.pool.query(
      `UPDATE canary_deployments
       SET current_percent = 100, status = 'promoted', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [canaryId]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Roll back a canary deployment (0% traffic)
   */
  async rollbackCanary(canaryId: string): Promise<CanaryDeployment> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error('Canary deployment not found');
    }
    if (canary.status !== 'running' && canary.status !== 'paused') {
      throw new Error(`Cannot rollback canary in '${canary.status}' state`);
    }

    const result = await this.pool.query(
      `UPDATE canary_deployments
       SET current_percent = 0, status = 'rolled_back', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [canaryId]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Pause a canary deployment
   */
  async pauseCanary(canaryId: string): Promise<CanaryDeployment> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error('Canary deployment not found');
    }
    if (canary.status !== 'running') {
      throw new Error('Canary deployment is not running');
    }

    const result = await this.pool.query(
      `UPDATE canary_deployments
       SET status = 'paused', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [canaryId]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Resume a paused canary deployment
   */
  async resumeCanary(canaryId: string): Promise<CanaryDeployment> {
    const canary = await this.getCanaryDeployment(canaryId);
    if (!canary) {
      throw new Error('Canary deployment not found');
    }
    if (canary.status !== 'paused') {
      throw new Error('Canary deployment is not paused');
    }

    const result = await this.pool.query(
      `UPDATE canary_deployments
       SET status = 'running', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [canaryId]
    );

    return this.mapRow(result.rows[0]);
  }

  // ==================== Row Mapper ====================

  private mapRow(row: any): CanaryDeployment {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      deployment_id: row.deployment_id,
      service_name: row.service_name,
      canary_version: row.canary_version,
      baseline_version: row.baseline_version,
      initial_percent: parseInt(row.initial_percent, 10) || 0,
      current_percent: parseInt(row.current_percent, 10) || 0,
      max_percent: parseInt(row.max_percent, 10) || 100,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
