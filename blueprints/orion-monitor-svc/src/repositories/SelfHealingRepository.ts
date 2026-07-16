import type { SelfHealingPolicy, SelfHealingRun } from '../types/monitor.js';
import type { IDbAdapter } from '../db/database.js';

export class SelfHealingRepository {
  constructor(private pool: IDbAdapter) {}

  // Policies
  async createPolicy(
    tenantId: string,
    projectId: string,
    createdBy: string,
    policy: Omit<SelfHealingPolicy, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'projectId' | 'createdBy' | 'enabled'>,
  ): Promise<SelfHealingPolicy> {
    const result = await this.pool.query(
      `INSERT INTO self_healing_policies
       (tenant_id, project_id, name, description, rule_id, action_type, action_config,
        cooldown_seconds, max_retries, enabled, approval_required, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [tenantId, projectId, policy.name, policy.description, policy.ruleId, policy.actionType,
       JSON.stringify(policy.actionConfig), policy.cooldownSeconds, policy.maxRetries,
       true, policy.approvalRequired, createdBy],
    );
    return this.policyToDto(result.rows[0]);
  }

  async findPolicies(tenantId: string, projectId?: string): Promise<SelfHealingPolicy[]> {
    let sql = 'SELECT * FROM self_healing_policies WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (projectId) { params.push(projectId); sql += ' AND project_id = $2'; }
    sql += ' ORDER BY created_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(r => this.policyToDto(r));
  }

  async findPolicyById(id: string): Promise<SelfHealingPolicy | null> {
    const result = await this.pool.query('SELECT * FROM self_healing_policies WHERE id = $1', [id]);
    return result.rows[0] ? this.policyToDto(result.rows[0]) : null;
  }

  // Runs
  async createRun(
    tenantId: string,
    projectId: string,
    run: Omit<SelfHealingRun, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'projectId' | 'createdBy'>,
  ): Promise<SelfHealingRun> {
    const result = await this.pool.query(
      `INSERT INTO self_healing_runs
       (tenant_id, project_id, policy_id, policy_name, alert_id, action_type, status,
        attempts, input, started_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tenantId, projectId, run.policyId, run.policyName, run.alertId, run.actionType,
       run.status, run.attempts, JSON.stringify(run.input), new Date(run.startedAt), 'system'],
    );
    return this.runToDto(result.rows[0]);
  }

  async findRuns(
    tenantId: string,
    filters?: { projectId?: string; policyId?: string; status?: string },
  ): Promise<SelfHealingRun[]> {
    let sql = 'SELECT * FROM self_healing_runs WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (filters?.projectId) { params.push(filters.projectId); sql += ` AND project_id = $${params.length}`; }
    if (filters?.policyId) { params.push(filters.policyId); sql += ` AND policy_id = $${params.length}`; }
    if (filters?.status) { params.push(filters.status); sql += ` AND status = $${params.length}`; }
    sql += ' ORDER BY started_at DESC';
    const result = await this.pool.query(sql, params);
    return result.rows.map(r => this.runToDto(r));
  }

  async updateRun(id: string, update: { status: string; attempts?: number; output?: Record<string, unknown>; error?: string }): Promise<SelfHealingRun | null> {
    const result = await this.pool.query(
      `UPDATE self_healing_runs SET status = $1, attempts = COALESCE($2, attempts),
       output = COALESCE($3, output), error = COALESCE($4, error),
       completed_at = CASE WHEN $1 IN ('succeeded','failed') THEN now() ELSE completed_at END,
       updated_at = now()
       WHERE id = $5 RETURNING *`,
      [update.status, update.attempts ?? null, update.output ? JSON.stringify(update.output) : null, update.error ?? null, id],
    );
    return result.rows[0] ? this.runToDto(result.rows[0]) : null;
  }

  private policyToDto(row: any): SelfHealingPolicy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      name: row.name,
      description: row.description ?? '',
      ruleId: row.rule_id,
      actionType: row.action_type,
      actionConfig: typeof row.action_config === 'string' ? JSON.parse(row.action_config) : row.action_config,
      cooldownSeconds: row.cooldown_seconds,
      maxRetries: row.max_retries,
      enabled: row.enabled,
      approvalRequired: row.approval_required,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
    };
  }

  private runToDto(row: any): SelfHealingRun {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      policyId: row.policy_id,
      policyName: row.policy_name,
      alertId: row.alert_id,
      actionType: row.action_type,
      status: row.status,
      attempts: row.attempts,
      input: typeof row.input === 'string' ? JSON.parse(row.input) : row.input,
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      error: row.error,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
    };
  }
}
