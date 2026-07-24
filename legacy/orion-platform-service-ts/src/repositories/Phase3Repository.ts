/**
 * Repositories for Phase 3: Security Compliance & Multi-Modal Trigger
 */
import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

// ==================== Compliance Policy ====================

export interface CompliancePolicyEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  framework_type: string;
  requirements: Record<string, any>;
  rules: any[];
  severity_threshold: string;
  enabled: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class CompliancePolicyRepository extends BaseRepository<CompliancePolicyEntity> {
  constructor(db: DatabasePool) {
    super(db, 'compliance_policies');
  }

  async findByTenant(tenantId: string): Promise<CompliancePolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_policies WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFramework(tenantId: string, frameworkType: string): Promise<CompliancePolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_policies WHERE tenant_id = $1 AND framework_type = $2`,
      [tenantId, frameworkType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): CompliancePolicyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      framework_type: row.framework_type,
      requirements: row.requirements || {},
      rules: row.rules || [],
      severity_threshold: row.severity_threshold || 'high',
      enabled: row.enabled !== false,
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

// ==================== Compliance Evaluation ====================

export interface ComplianceEvaluationEntity {
  id: string;
  tenant_id: string;
  policy_id: string;
  status: string;
  score: number;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  gaps: any[];
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export class ComplianceEvaluationRepository extends BaseRepository<ComplianceEvaluationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'compliance_evaluations');
  }

  async findByPolicyId(policyId: string): Promise<ComplianceEvaluationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_evaluations WHERE policy_id = $1 ORDER BY created_at DESC`,
      [policyId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByPolicy(policyId: string): Promise<ComplianceEvaluationEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM compliance_evaluations WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [policyId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<ComplianceEvaluationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_evaluations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ComplianceEvaluationEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      policy_id: row.policy_id,
      status: row.status || 'pending',
      score: parseFloat(row.score) || 0,
      total_checks: row.total_checks || 0,
      passed_checks: row.passed_checks || 0,
      failed_checks: row.failed_checks || 0,
      gaps: row.gaps || [],
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ==================== Compliance Remediation ====================

export interface ComplianceRemediationEntity {
  id: string;
  tenant_id: string;
  evaluation_id: string | null;
  gap_id: string;
  status: string;
  action_taken: string | null;
  result: Record<string, any> | null;
  created_at: Date;
  completed_at: Date | null;
}

export class ComplianceRemediationRepository extends BaseRepository<ComplianceRemediationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'compliance_remediations');
  }

  async findByEvaluationId(evaluationId: string): Promise<ComplianceRemediationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM compliance_remediations WHERE evaluation_id = $1 ORDER BY created_at DESC`,
      [evaluationId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ComplianceRemediationEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      evaluation_id: row.evaluation_id,
      gap_id: row.gap_id,
      status: row.status || 'pending',
      action_taken: row.action_taken,
      result: row.result,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
    };
  }
}

// ==================== Audit Plan ====================

export interface AuditPlanEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  scope: Record<string, any>;
  audit_type: string;
  schedule_type: string;
  cron_expression: string | null;
  reviewers: any[];
  status: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class AuditPlanRepository extends BaseRepository<AuditPlanEntity> {
  constructor(db: DatabasePool) {
    super(db, 'audit_plans');
  }

  async findByTenant(tenantId: string): Promise<AuditPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_plans WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AuditPlanEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      scope: row.scope || {},
      audit_type: row.audit_type,
      schedule_type: row.schedule_type || 'manual',
      cron_expression: row.cron_expression,
      reviewers: row.reviewers || [],
      status: row.status || 'draft',
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

// ==================== Audit Execution ====================

export interface AuditExecutionEntity {
  id: string;
  plan_id: string;
  tenant_id: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  findings_count: number;
  created_at: Date;
}

export class AuditExecutionRepository extends BaseRepository<AuditExecutionEntity> {
  constructor(db: DatabasePool) {
    super(db, 'audit_executions');
  }

  async findByPlanId(planId: string): Promise<AuditExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_executions WHERE plan_id = $1 ORDER BY created_at DESC`,
      [planId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLatestByPlan(planId: string): Promise<AuditExecutionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM audit_executions WHERE plan_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [planId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): AuditExecutionEntity {
    return {
      id: row.id,
      plan_id: row.plan_id,
      tenant_id: row.tenant_id,
      status: row.status || 'pending',
      started_at: row.started_at ? new Date(row.started_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      findings_count: row.findings_count || 0,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ==================== Audit Finding ====================

export interface AuditFindingEntity {
  id: string;
  execution_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  evidence: Record<string, any> | null;
  recommendation: string | null;
  status: string;
  assigned_to: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
}

export class AuditFindingRepository extends BaseRepository<AuditFindingEntity> {
  constructor(db: DatabasePool) {
    super(db, 'audit_findings');
  }

  async findByExecutionId(executionId: string): Promise<AuditFindingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_findings WHERE execution_id = $1 ORDER BY created_at DESC`,
      [executionId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<AuditFindingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM audit_findings WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByExecution(executionId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM audit_findings WHERE execution_id = $1`,
      [executionId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): AuditFindingEntity {
    return {
      id: row.id,
      execution_id: row.execution_id,
      tenant_id: row.tenant_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      category: row.category,
      evidence: row.evidence,
      recommendation: row.recommendation,
      status: row.status || 'open',
      assigned_to: row.assigned_to,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
      closed_at: row.closed_at ? new Date(row.closed_at) : null,
    };
  }
}

// ==================== Trigger ====================

export interface TriggerEntity {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  condition_expression: string | null;
  pipeline_id: string | null;
  enabled: boolean;
  trigger_count: number;
  last_triggered_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export class TriggerRepository extends BaseRepository<TriggerEntity> {
  constructor(db: DatabasePool) {
    super(db, 'triggers');
  }

  async findByTenant(tenantId: string): Promise<TriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM triggers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByType(tenantId: string, type: string): Promise<TriggerEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM triggers WHERE tenant_id = $1 AND type = $2`,
      [tenantId, type],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async incrementTriggerCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE triggers SET trigger_count = trigger_count + 1, last_triggered_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  protected mapRowToEntity(row: any): TriggerEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      type: row.type,
      config: row.config || {},
      condition_expression: row.condition_expression,
      pipeline_id: row.pipeline_id,
      enabled: row.enabled !== false,
      trigger_count: row.trigger_count || 0,
      last_triggered_at: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

// ==================== Trigger Event ====================

export interface TriggerEventEntity {
  id: string;
  trigger_id: string;
  tenant_id: string;
  event_type: string;
  event_payload: Record<string, any>;
  evaluation_result: string | null;
  pipeline_run_id: string | null;
  created_at: Date;
}

export class TriggerEventRepository extends BaseRepository<TriggerEventEntity> {
  constructor(db: DatabasePool) {
    super(db, 'trigger_events');
  }

  async findByTriggerId(triggerId: string, limit: number = 50): Promise<TriggerEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM trigger_events WHERE trigger_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [triggerId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByTrigger(triggerId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM trigger_events WHERE trigger_id = $1`,
      [triggerId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): TriggerEventEntity {
    return {
      id: row.id,
      trigger_id: row.trigger_id,
      tenant_id: row.tenant_id,
      event_type: row.event_type,
      event_payload: row.event_payload || {},
      evaluation_result: row.evaluation_result,
      pipeline_run_id: row.pipeline_run_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}

// ==================== Webhook Endpoint ====================

export interface WebhookEndpointEntity {
  id: string;
  tenant_id: string;
  trigger_id: string | null;
  path: string;
  secret: string | null;
  allowed_ips: string[];
  method: string;
  request_count: number;
  last_request_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class WebhookEndpointRepository extends BaseRepository<WebhookEndpointEntity> {
  constructor(db: DatabasePool) {
    super(db, 'webhook_endpoints');
  }

  async findByPath(path: string): Promise<WebhookEndpointEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM webhook_endpoints WHERE path = $1`,
      [path],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<WebhookEndpointEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM webhook_endpoints WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async incrementRequestCount(id: string): Promise<void> {
    await this.db.query(
      `UPDATE webhook_endpoints SET request_count = request_count + 1, last_request_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  protected mapRowToEntity(row: any): WebhookEndpointEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      trigger_id: row.trigger_id,
      path: row.path,
      secret: row.secret,
      allowed_ips: row.allowed_ips || [],
      method: row.method || 'POST',
      request_count: row.request_count || 0,
      last_request_at: row.last_request_at ? new Date(row.last_request_at) : null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
