import { DatabasePool } from '../database';
/**
 * SelfHealingRepository - Database layer for Self-Healing operations
 */

import {
  HealingStrategy,
  HealingAction,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  HealingResult,
  ApprovalRequest,
  RiskLevel,
} from './types';

export interface SelfHealingRule {
  id: string;
  tenant_id: string;
  name: string;
  trigger_condition: Record<string, any>;
  action: Record<string, any>;
  enabled: boolean;
  execution_count: number;
  last_executed: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SelfHealingExecution {
  id: string;
  rule_id: string;
  trigger_event: Record<string, any>;
  status: string;
  result: Record<string, any> | null;
  error_message: string | null;
  started_at: Date;
  completed_at: Date | null;
}

/**
 * Database representation of a healing incident
 */
export interface HealingIncidentRow {
  id: string;
  alert_id: string | null;
  type: string;
  severity: string;
  app_name: string;
  environment: string;
  strategy_id: string | null;
  strategy_name: string | null;
  actions: HealingAction[];
  status: string;
  attempts: number;
  approval_status: string | null;
  approval_request_id: string | null;
  result: HealingResult | null;
  error: string | null;
  tags: Record<string, string> | null;
  started_at: Date;
  completed_at: Date | null;
}

/**
 * Database representation of an approval request
 */
export interface ApprovalRequestRow {
  id: string;
  incident_id: string;
  title: string;
  description: string | null;
  risk_level: string;
  recommended_actions: HealingAction[];
  status: string;
  requested_by: string;
  approved_by: string | null;
  approval_reason: string | null;
  requested_at: Date;
  responded_at: Date | null;
  expires_at: Date | null;
}

export interface Ticket {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  assignee_id: string | null;
  reporter_id: string | null;
  source: string | null;
  source_id: string | null;
  tags: string[];
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  content: string;
  is_internal: boolean;
  created_at: Date;
}

export class SelfHealingRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Rules ====================

  async findRuleById(id: string): Promise<SelfHealingRule | null> {
    const result = await this.pool.query('SELECT * FROM self_healing_rules WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAllRules(tenantId?: string): Promise<SelfHealingRule[]> {
    let query = 'SELECT * FROM self_healing_rules';
    const params: any[] = [];
    
    if (tenantId) { params.push(tenantId); query += ' WHERE tenant_id = $1'; }
    query += ' ORDER BY created_at DESC';
    
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async createRule(tenantId: string, name: string, triggerCondition: Record<string, any>, action: Record<string, any>): Promise<SelfHealingRule> {
    const result = await this.pool.query(
      `INSERT INTO self_healing_rules (tenant_id, name, trigger_condition, action, enabled)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [tenantId, name, triggerCondition, action]
    );
    return result.rows[0];
  }

  async updateRule(id: string, input: { name?: string; trigger_condition?: Record<string, any>; action?: Record<string, any>; enabled?: boolean }): Promise<SelfHealingRule | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.trigger_condition !== undefined) { params.push(JSON.stringify(input.trigger_condition)); updates.push(`trigger_condition = $${paramIndex++}`); }
    if (input.action !== undefined) { params.push(JSON.stringify(input.action)); updates.push(`action = $${paramIndex++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); updates.push(`enabled = $${paramIndex++}`); }

    if (updates.length === 0) return this.findRuleById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE self_healing_rules SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM self_healing_rules WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async incrementExecutionCount(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE self_healing_rules SET execution_count = execution_count + 1, last_executed = NOW() WHERE id = $1',
      [id]
    );
  }

  // ==================== Executions ====================

  async createExecution(ruleId: string, triggerEvent: Record<string, any>): Promise<SelfHealingExecution> {
    const result = await this.pool.query(
      `INSERT INTO self_healing_executions (rule_id, trigger_event, status)
       VALUES ($1, $2, 'running')
       RETURNING *`,
      [ruleId, triggerEvent]
    );
    return result.rows[0];
  }

  async completeExecution(id: string, status: string, result?: Record<string, any>, errorMessage?: string): Promise<SelfHealingExecution | null> {
    const updateResult = await this.pool.query(
      `UPDATE self_healing_executions SET status = $1, result = $2, error_message = $3, completed_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, result || null, errorMessage || null, id]
    );
    return updateResult.rows[0] || null;
  }

  async findExecutions(ruleId: string, limit: number = 10): Promise<SelfHealingExecution[]> {
    const result = await this.pool.query(
      'SELECT * FROM self_healing_executions WHERE rule_id = $1 ORDER BY started_at DESC LIMIT $2',
      [ruleId, limit]
    );
    return result.rows;
  }

  // ==================== Incidents ====================

  async createIncident(incident: {
    alert_id?: string;
    type: string;
    severity: string;
    app_name: string;
    environment: string;
    strategy_id?: string;
    strategy_name?: string;
    actions: HealingAction[];
    status: string;
    attempts?: number;
    approval_status?: string;
    approval_request_id?: string;
    tags?: Record<string, string>;
  }): Promise<HealingIncidentRow> {
    const result = await this.pool.query(
      `INSERT INTO self_healing_incidents
       (alert_id, type, severity, app_name, environment, strategy_id, strategy_name, actions, status, attempts, approval_status, approval_request_id, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        incident.alert_id || null,
        incident.type,
        incident.severity,
        incident.app_name,
        incident.environment,
        incident.strategy_id || null,
        incident.strategy_name || null,
        incident.actions,
        incident.status,
        incident.attempts ?? 0,
        incident.approval_status || null,
        incident.approval_request_id || null,
        incident.tags || null,
      ]
    );
    return result.rows[0];
  }

  async findIncidentById(id: string): Promise<HealingIncidentRow | null> {
    const result = await this.pool.query(
      'SELECT * FROM self_healing_incidents WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findIncidents(filters: {
    appName?: string;
    environment?: string;
    type?: string;
    status?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: HealingIncidentRow[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.appName) { params.push(filters.appName); conditions.push(`app_name = $${paramIndex++}`); }
    if (filters.environment) { params.push(filters.environment); conditions.push(`environment = $${paramIndex++}`); }
    if (filters.type) { params.push(filters.type); conditions.push(`type = $${paramIndex++}`); }
    if (filters.status) { params.push(filters.status); conditions.push(`status = $${paramIndex++}`); }
    if (filters.severity) { params.push(filters.severity); conditions.push(`severity = $${paramIndex++}`); }
    if (filters.startDate) { params.push(filters.startDate); conditions.push(`started_at >= $${paramIndex++}`); }
    if (filters.endDate) { params.push(filters.endDate); conditions.push(`started_at <= $${paramIndex++}`); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM self_healing_incidents ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query with pagination
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM self_healing_incidents ${whereClause}
       ORDER BY started_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return { rows: dataResult.rows, total };
  }

  async updateIncident(id: string, updates: {
    status?: string;
    strategy_id?: string;
    strategy_name?: string;
    actions?: HealingAction[];
    attempts?: number;
    approval_status?: string;
    approval_request_id?: string;
    result?: HealingResult;
    error?: string;
    completed_at?: Date;
  }): Promise<HealingIncidentRow | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) { params.push(updates.status); setClauses.push(`status = $${paramIndex++}`); }
    if (updates.strategy_id !== undefined) { params.push(updates.strategy_id); setClauses.push(`strategy_id = $${paramIndex++}`); }
    if (updates.strategy_name !== undefined) { params.push(updates.strategy_name); setClauses.push(`strategy_name = $${paramIndex++}`); }
    if (updates.actions !== undefined) { params.push(JSON.stringify(updates.actions)); setClauses.push(`actions = $${paramIndex++}`); }
    if (updates.attempts !== undefined) { params.push(updates.attempts); setClauses.push(`attempts = $${paramIndex++}`); }
    if (updates.approval_status !== undefined) { params.push(updates.approval_status); setClauses.push(`approval_status = $${paramIndex++}`); }
    if (updates.approval_request_id !== undefined) { params.push(updates.approval_request_id); setClauses.push(`approval_request_id = $${paramIndex++}`); }
    if (updates.result !== undefined) { params.push(JSON.stringify(updates.result)); setClauses.push(`result = $${paramIndex++}`); }
    if (updates.error !== undefined) { params.push(updates.error); setClauses.push(`error = $${paramIndex++}`); }
    if (updates.completed_at !== undefined) { params.push(updates.completed_at); setClauses.push(`completed_at = $${paramIndex++}`); }

    if (setClauses.length === 0) return this.findIncidentById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE self_healing_incidents SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  // ==================== Approvals ====================

  async createApprovalRequest(approval: {
    incident_id: string;
    title: string;
    description?: string;
    risk_level: string;
    recommended_actions: HealingAction[];
    status?: string;
    requested_by?: string;
    expires_at?: Date;
  }): Promise<ApprovalRequestRow> {
    const result = await this.pool.query(
      `INSERT INTO self_healing_approvals
       (incident_id, title, description, risk_level, recommended_actions, status, requested_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        approval.incident_id,
        approval.title,
        approval.description || null,
        approval.risk_level,
        approval.recommended_actions,
        approval.status || 'pending',
        approval.requested_by || 'system',
        approval.expires_at || null,
      ]
    );
    return result.rows[0];
  }

  async findApprovalById(id: string): Promise<ApprovalRequestRow | null> {
    const result = await this.pool.query(
      'SELECT * FROM self_healing_approvals WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findApprovalsByStatus(status?: string): Promise<ApprovalRequestRow[]> {
    if (status) {
      const result = await this.pool.query(
        'SELECT * FROM self_healing_approvals WHERE status = $1 ORDER BY requested_at DESC',
        [status]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      'SELECT * FROM self_healing_approvals ORDER BY requested_at DESC'
    );
    return result.rows;
  }

  async updateApprovalRequest(id: string, updates: {
    status?: string;
    approved_by?: string;
    approval_reason?: string;
    responded_at?: Date;
  }): Promise<ApprovalRequestRow | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) { params.push(updates.status); setClauses.push(`status = $${paramIndex++}`); }
    if (updates.approved_by !== undefined) { params.push(updates.approved_by); setClauses.push(`approved_by = $${paramIndex++}`); }
    if (updates.approval_reason !== undefined) { params.push(updates.approval_reason); setClauses.push(`approval_reason = $${paramIndex++}`); }
    if (updates.responded_at !== undefined) { params.push(updates.responded_at); setClauses.push(`responded_at = $${paramIndex++}`); }

    if (setClauses.length === 0) return this.findApprovalById(id);

    params.push(id);
    const result = await this.pool.query(
      `UPDATE self_healing_approvals SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async markExpiredApprovals(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE self_healing_approvals
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return result.rowCount ?? 0;
  }
}