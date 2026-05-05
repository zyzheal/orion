/**
 * Quality Gate Enhancement Service - Phase 1
 *
 * Enhanced quality gate with custom rules, thresholds, and blocking policies
 */

import { DatabasePool } from '../database';

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
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async createRule(input: { tenant_id: string; name: string; type: string; threshold: number; operator: string; blocking?: boolean }): Promise<QualityGateRule> {
    const result = await this.pool.query(
      `INSERT INTO quality_gate_rules 
        (tenant_id, name, type, threshold, operator, blocking, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [input.tenant_id, input.name, input.type, input.threshold, input.operator, input.blocking ?? true]
    );
    return result.rows[0];
  }

  async listRules(tenantId: string): Promise<QualityGateRule[]> {
    const result = await this.pool.query(
      'SELECT * FROM quality_gate_rules WHERE tenant_id = $1 AND enabled = true',
      [tenantId]
    );
    return result.rows;
  }

  async evaluateGate(pipelineRunId: string, metrics: Record<string, number>): Promise<QualityGateResult> {
    // Get rules and evaluate
    const rules = await this.listRules('default');
    const failed: Array<{ rule: QualityGateRule; actual_value: number; message: string }> = [];

    for (const rule of rules) {
      const actualValue = metrics[rule.type] || 0;
      const passed = this.evaluateRule(rule, actualValue);
      if (!passed && rule.blocking) {
        failed.push({ rule, actual_value: actualValue, message: `${rule.name} threshold not met` });
      }
    }

    return {
      gate_id: pipelineRunId,
      pipeline_run_id: pipelineRunId,
      passed: failed.length === 0,
      rules_checked: rules.length,
      rules_passed: rules.length - failed.length,
      rules_failed: failed,
      checked_at: new Date(),
    };
  }

  private evaluateRule(rule: QualityGateRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'eq': return value === rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lte': return value <= rule.threshold;
      default: return true;
    }
  }
}