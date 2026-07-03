/**
 * AutomationRuleRepository - Automation Rule Data Access Layer
 *
 * Manages automation_rules and automation_rule_executions tables
 */

import { BaseRepository } from '../db/base-repository';
import {
  AutomationRule,
  AutomationRuleExecution,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '../../services/ticketing/types';

export class AutomationRuleRepository extends BaseRepository<AutomationRule> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'automation_rules');
  }

  // ==================== Automation Rule CRUD ====================

  async createRule(input: CreateAutomationRuleInput, tenantId: string): Promise<AutomationRule> {
    const id = `AR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO automation_rules (id, tenant_id, name, description, enabled, priority, conditions, actions, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [
        id,
        tenantId,
        input.name,
        input.description || null,
        input.enabled ?? true,
        input.priority ?? 0,
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        input.createdBy || null,
      ]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async findRuleById(id: string): Promise<AutomationRule | null> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findAllRules(options?: { enabled?: boolean; limit?: number; offset?: number }): Promise<AutomationRule[]> {
    const tenantId = this.getTenantId();
    let query = 'SELECT * FROM automation_rules WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options?.enabled !== undefined) {
      params.push(options.enabled);
      query += ` AND enabled = $${paramIndex++}`;
    }

    query += ' ORDER BY priority DESC, created_at DESC';
    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${paramIndex++}`;
    }
    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${paramIndex++}`;
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateRule(id: string, input: UpdateAutomationRuleInput): Promise<AutomationRule | null> {
    const tenantId = this.getTenantId();
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (input.name !== undefined) { params.push(input.name); sets.push(`name = $${idx++}`); }
    if (input.description !== undefined) { params.push(input.description); sets.push(`description = $${idx++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); sets.push(`enabled = $${idx++}`); }
    if (input.priority !== undefined) { params.push(input.priority); sets.push(`priority = $${idx++}`); }
    if (input.conditions !== undefined) { params.push(JSON.stringify(input.conditions)); sets.push(`conditions = $${idx++}`); }
    if (input.actions !== undefined) { params.push(JSON.stringify(input.actions)); sets.push(`actions = $${idx++}`); }

    if (sets.length === 0) return this.findRuleById(id);
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const result = await this.db.query(
      `UPDATE automation_rules SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      'DELETE FROM automation_rules WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async incrementExecutionCount(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    await this.db.query(
      'UPDATE automation_rules SET execution_count = execution_count + 1, last_executed = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
  }

  async getEnabledRules(tenantId: string): Promise<AutomationRule[]> {
    const result = await this.db.query(
      'SELECT * FROM automation_rules WHERE tenant_id = $1 AND enabled = true ORDER BY priority DESC, created_at ASC',
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  // ==================== Execution Logs ====================

  async createExecution(execution: Omit<AutomationRuleExecution, 'id' | 'executedAt'>): Promise<AutomationRuleExecution> {
    const id = `EXEC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO automation_rule_executions (id, rule_id, ticket_id, triggered_by, conditions_met, actions_taken, status, error_message, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        id,
        execution.ruleId,
        execution.ticketId,
        execution.triggeredBy,
        JSON.stringify(execution.conditionsMet),
        JSON.stringify(execution.actionsTaken),
        execution.status,
        execution.errorMessage || null,
        execution.completedAt || null,
      ]
    );
    return this.mapExecutionRow(result.rows[0]);
  }

  async updateExecution(id: string, updates: { status?: string; errorMessage?: string; completedAt?: Date }): Promise<AutomationRuleExecution | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) { params.push(updates.status); sets.push(`status = $${idx++}`); }
    if (updates.errorMessage !== undefined) { params.push(updates.errorMessage); sets.push(`error_message = $${idx++}`); }
    if (updates.completedAt !== undefined) { params.push(updates.completedAt); sets.push(`completed_at = $${idx++}`); }

    if (sets.length === 0) return null;
    params.push(id);
    const result = await this.db.query(
      `UPDATE automation_rule_executions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows.length > 0 ? this.mapExecutionRow(result.rows[0]) : null;
  }

  async getExecutionsByRule(ruleId: string, tenantId: string, limit = 50): Promise<AutomationRuleExecution[]> {
    const result = await this.db.query(
      `SELECT e.* FROM automation_rule_executions e
       JOIN automation_rules r ON e.rule_id = r.id
       WHERE r.id = $1 AND r.tenant_id = $2
       ORDER BY e.executed_at DESC LIMIT $3`,
      [ruleId, tenantId, limit],
    );
    return result.rows.map(row => this.mapExecutionRow(row));
  }

  async getExecutionsByTicket(ticketId: string, tenantId: string): Promise<AutomationRuleExecution[]> {
    const result = await this.db.query(
      `SELECT e.* FROM automation_rule_executions e
       JOIN automation_rules r ON e.rule_id = r.id
       WHERE e.ticket_id = $1 AND r.tenant_id = $2
       ORDER BY e.executed_at DESC`,
      [ticketId, tenantId],
    );
    return result.rows.map(row => this.mapExecutionRow(row));
  }

  // ==================== Row Mapping ====================

  protected mapRowToEntity(row: any): AutomationRule {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled ?? true,
      priority: row.priority ?? 0,
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
      executionCount: row.execution_count || 0,
      lastExecuted: row.last_executed,
      createdBy: row.created_by,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }

  private mapExecutionRow(row: any): AutomationRuleExecution {
    return {
      id: row.id,
      ruleId: row.rule_id,
      ticketId: row.ticket_id,
      triggeredBy: row.triggered_by as any,
      conditionsMet: typeof row.conditions_met === 'string' ? JSON.parse(row.conditions_met) : row.conditions_met,
      actionsTaken: typeof row.actions_taken === 'string' ? JSON.parse(row.actions_taken) : row.actions_taken,
      status: row.status as any,
      errorMessage: row.error_message,
      executedAt: row.executed_at ? new Date(row.executed_at) : new Date(),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}
