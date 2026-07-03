import { DatabasePool } from '../database';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
/**
 * Quality Gate Enhancement Service
 *
 * Provides configurable quality gate rules that can block pipeline runs
 * when thresholds are not met. Supports coverage, complexity, security,
 * performance, and custom rule types.
 */

export interface QualityGateRule {
  id: string;
  tenant_id: string;
  name: string;
  type: 'coverage' | 'complexity' | 'security' | 'performance' | 'custom';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  blocking: boolean;
  enabled: boolean;
  created_at: Date;
}

export interface QualityGateResult {
  gate_id: string;
  pipeline_run_id: string;
  passed: boolean;
  rules_checked: number;
  rules_passed: number;
  rules_failed: Array<{ rule: QualityGateRule; actual_value: number; message: string }>;
  checked_at: Date;
}

export class QualityGateEnhancementService {
  constructor(private pool: DatabasePool) {}

  // ==================== Rule CRUD ====================

  async createRule(input: {
    tenant_id?: string;
    name: string;
    type: 'coverage' | 'complexity' | 'security' | 'performance' | 'custom';
    threshold: number;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    blocking?: boolean;
  }): Promise<QualityGateRule> {
    const tenantId = input.tenant_id || getCurrentTenantId();
    const result = await this.pool.query(
      `INSERT INTO quality_gate_rules
        (tenant_id, name, type, threshold, operator, blocking, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [tenantId, input.name, input.type, input.threshold, input.operator, input.blocking ?? true]
    );
    logger.info({ ruleId: result.rows[0].id, type: input.type }, 'Quality gate rule created');
    return result.rows[0];
  }

  async findById(id: string, tenantId?: string): Promise<QualityGateRule | null> {
    const conditions = ['id = $1'];
    const params: any[] = [id];
    if (tenantId) {
      conditions.push('tenant_id = $2');
      params.push(tenantId);
    }
    const result = await this.pool.query(
      `SELECT * FROM quality_gate_rules WHERE ${conditions.join(' AND ')} LIMIT 1`,
      params
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async listRules(tenantId?: string): Promise<QualityGateRule[]> {
    const tid = tenantId || getCurrentTenantId();
    const result = await this.pool.query(
      'SELECT * FROM quality_gate_rules WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC',
      [tid]
    );
    return result.rows;
  }

  async updateRule(id: string, updates: Partial<Pick<QualityGateRule, 'threshold' | 'operator' | 'blocking' | 'enabled'>>, tenantId?: string): Promise<QualityGateRule | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      sets.push(`${key} = $${idx}`);
      params.push(value);
      idx++;
    }

    if (sets.length === 0) return this.findById(id, tenantId);

    params.push(id);
    if (tenantId) {
      params.push(tenantId);
    }

    const tenantFilter = tenantId ? `AND tenant_id = $${idx}` : '';
    const result = await this.pool.query(
      `UPDATE quality_gate_rules SET ${sets.join(', ')} WHERE id = $${idx - 1} ${tenantFilter} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async deleteRule(id: string, tenantId?: string): Promise<boolean> {
    const params: any[] = [id];
    const clauses = ['id = $1'];
    if (tenantId) {
      clauses.push('tenant_id = $2');
      params.push(tenantId);
    }
    const result = await this.pool.query(
      `DELETE FROM quality_gate_rules WHERE ${clauses.join(' AND ')}`,
      params
    );
    return (result.rowCount || 0) > 0;
  }

  async toggleRule(id: string, enabled: boolean, tenantId?: string): Promise<QualityGateRule | null> {
    return this.updateRule(id, { enabled }, tenantId);
  }

  // ==================== Gate Evaluation ====================

  async evaluateGate(
    pipelineRunId: string,
    metrics: Record<string, number>,
    tenantId?: string
  ): Promise<QualityGateResult> {
    const tid = tenantId || getCurrentTenantId();
    const rules = await this.listRules(tid);
    const failed: Array<{ rule: QualityGateRule; actual_value: number; message: string }> = [];

    for (const rule of rules) {
      const actualValue = metrics[rule.type] || 0;
      const passed = this.evaluateRule(rule, actualValue);
      if (!passed && rule.blocking) {
        failed.push({
          rule,
          actual_value: actualValue,
          message: `${rule.name}: expected ${rule.operator} ${rule.threshold}, got ${actualValue}`,
        });
      }
    }

    const result: QualityGateResult = {
      gate_id: pipelineRunId,
      pipeline_run_id: pipelineRunId,
      passed: failed.length === 0,
      rules_checked: rules.length,
      rules_passed: rules.length - failed.length,
      rules_failed: failed,
      checked_at: new Date(),
    };

    logger.info(
      { pipelineRunId, passed: result.passed, rulesChecked: rules.length, rulesFailed: failed.length },
      'Quality gate evaluated'
    );

    return result;
  }

  private evaluateRule(rule: QualityGateRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt':  return value > rule.threshold;
      case 'lt':  return value < rule.threshold;
      case 'eq':  return value === rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lte': return value <= rule.threshold;
      default:    return true;
    }
  }
}
