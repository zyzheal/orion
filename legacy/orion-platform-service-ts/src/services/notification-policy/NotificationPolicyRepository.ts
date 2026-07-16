import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface NotificationPolicyEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  conditions: PolicyCondition[];
  channels: string[];
  recipients: string[];
  throttleMinutes: number;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'regex';
  value: unknown;
}

export interface NotificationWorkflowEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  policyId: string;
  steps: WorkflowStep[];
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'notify' | 'wait' | 'escalate' | 'webhook';
  config: Record<string, unknown>;
  order: number;
}

export class NotificationPolicyRepository extends BaseRepository<NotificationPolicyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'notification_policies');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<NotificationPolicyEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findEnabled(tenantId: string): Promise<NotificationPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM notification_policies WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): NotificationPolicyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      conditions: this.parseJsonB(row.conditions, []) as PolicyCondition[],
      channels: this.parseJsonB(row.channels, []) as string[],
      recipients: this.parseJsonB(row.recipients, []) as string[],
      throttleMinutes: row.throttle_minutes ?? 0,
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseJsonB(value: unknown, fallback: unknown[]): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { /* fall through */ }
    }
    if (typeof value === 'object' && value !== null) return value as unknown[];
    return fallback;
  }
}

export class NotificationWorkflowRepository extends BaseRepository<NotificationWorkflowEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'notification_workflows');
  }

  async findByPolicyId(policyId: string): Promise<NotificationWorkflowEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM notification_workflows WHERE policy_id = $1 ORDER BY created_at DESC`,
      [policyId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<NotificationWorkflowEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findEnabled(tenantId: string): Promise<NotificationWorkflowEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM notification_workflows WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): NotificationWorkflowEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      policyId: row.policy_id,
      steps: this.parseJsonB(row.steps, []) as WorkflowStep[],
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseJsonB(value: unknown, fallback: unknown[]): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { /* fall through */ }
    }
    if (typeof value === 'object' && value !== null) return value as unknown[];
    return fallback;
  }
}
