/**
 * ConfigChangeRepository — PostgreSQL data access for config change management
 *
 * Manages config_change_requests and config_change_history tables.
 */

import { BaseRepository } from '../db/base-repository';

// ============================================================
// Entity Types (camelCase domain representation)
// ============================================================

export interface ChangeRequestEntity {
  id: string;
  tenantId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  changeType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string;
  riskLevel: string;
  requester: string;
  status: string;
  executionPlan?: Record<string, unknown>;
  rollbackPlan?: Record<string, unknown>;
  approvals: unknown[];
  requiredApprovals: number;
  executedAt?: Date;
  executedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rolledBackAt?: Date;
  rolledBackBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangeHistoryEntity {
  id: string;
  tenantId: string;
  changeRequestId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  action: string;
  actor: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  notes?: string;
  createdAt: Date;
}

// ============================================================
// Repository
// ============================================================

export class ConfigChangeRequestRepository extends BaseRepository<ChangeRequestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_change_requests');
  }

  async findByTenant(tenantId: string, options: {
    status?: string;
    configKey?: string;
    configGroup?: string;
    environment?: string;
    requester?: string;
    riskLevel?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ChangeRequestEntity[]> {
    let query = 'SELECT * FROM config_change_requests WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options.status) {
      query += ` AND status = $${paramIdx}`;
      params.push(options.status);
      paramIdx++;
    }
    if (options.configKey) {
      query += ` AND config_key = $${paramIdx}`;
      params.push(options.configKey);
      paramIdx++;
    }
    if (options.configGroup) {
      query += ` AND config_group = $${paramIdx}`;
      params.push(options.configGroup);
      paramIdx++;
    }
    if (options.environment) {
      query += ` AND environment = $${paramIdx}`;
      params.push(options.environment);
      paramIdx++;
    }
    if (options.requester) {
      query += ` AND requester = $${paramIdx}`;
      params.push(options.requester);
      paramIdx++;
    }
    if (options.riskLevel) {
      query += ` AND risk_level = $${paramIdx}`;
      params.push(options.riskLevel);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (options.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(options.limit);
      paramIdx++;
    }
    if (options.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(options.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, extraFields?: Record<string, unknown>): Promise<ChangeRequestEntity | null> {
    let query = `UPDATE config_change_requests SET status = $1, updated_at = NOW()`;
    const params: unknown[] = [status];
    let paramIdx = 2;

    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        query += `, ${key} = $${paramIdx}`;
        params.push(value);
        paramIdx++;
      }
    }

    query += ` WHERE id = $${paramIdx} RETURNING *`;
    params.push(id);

    const result = await this.db.query(query, params);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): ChangeRequestEntity {
    const approvalsRaw = row.approvals;
    const approvals = (typeof approvalsRaw === 'string'
      ? JSON.parse(approvalsRaw)
      : (approvalsRaw || [])) as unknown[];

    return {
      id: row.id,
      tenantId: row.tenant_id,
      configKey: row.config_key,
      configGroup: row.config_group || undefined,
      environment: row.environment,
      changeType: row.change_type,
      oldValue: this.parseJsonObject(row.old_value),
      newValue: this.parseJsonObject(row.new_value),
      reason: row.reason,
      riskLevel: row.risk_level,
      requester: row.requester,
      status: row.status,
      executionPlan: this.parseJsonObject(row.execution_plan),
      rollbackPlan: this.parseJsonObject(row.rollback_plan),
      approvals,
      requiredApprovals: row.required_approvals,
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      executedBy: row.executed_by || undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      approvedBy: row.approved_by || undefined,
      rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at) : undefined,
      rolledBackBy: row.rolled_back_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private parseJsonObject(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw as Record<string, unknown>;
  }
}

export class ConfigChangeHistoryRepository extends BaseRepository<ChangeHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'config_change_history');
  }

  async findByTenant(tenantId: string, options: {
    configKey?: string;
    configGroup?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ChangeHistoryEntity[]> {
    let query = 'SELECT * FROM config_change_history WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (options.configKey) {
      query += ` AND config_key = $${paramIdx}`;
      params.push(options.configKey);
      paramIdx++;
    }
    if (options.configGroup) {
      query += ` AND config_group = $${paramIdx}`;
      params.push(options.configGroup);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (options.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(options.limit);
      paramIdx++;
    }
    if (options.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(options.offset);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ChangeHistoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      changeRequestId: row.change_request_id || '',
      configKey: row.config_key,
      configGroup: row.config_group || undefined,
      environment: row.environment,
      action: row.action,
      actor: row.actor,
      oldValue: this.parseJsonObject(row.old_value),
      newValue: this.parseJsonObject(row.new_value),
      notes: row.notes || undefined,
      createdAt: row.created_at,
    };
  }

  private parseJsonObject(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw as Record<string, unknown>;
  }
}
