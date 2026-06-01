/**
 * DataQualityService - Data quality rules and validation
 *
 * Defines quality rules for data pipelines, validates data against rules,
 * tracks quality metrics over time.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export type RuleType = 'not_null' | 'unique' | 'range' | 'pattern' | 'custom' | 'referential' | 'completeness';
export type RuleSeverity = 'critical' | 'warning' | 'info';
export type ValidationStatus = 'passed' | 'failed' | 'warning';

export interface DataQualityRule {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId?: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  severity: RuleSeverity;
  targetField: string;
  condition: Record<string, unknown>;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  id: string;
  ruleId: string;
  pipelineId: string;
  executionId?: string;
  status: ValidationStatus;
  totalRecords: number;
  passedRecords: number;
  failedRecords: number;
  failureRate: number;
  failureSamples: unknown[];
  validatedAt: Date;
  durationMs: number;
}

export interface CreateQualityRuleInput {
  pipelineId: string;
  stageId?: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  severity?: RuleSeverity;
  targetField: string;
  condition: Record<string, unknown>;
}

// ============================================================
// Repository
// ============================================================

class QualityRuleRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, DataQualityRule>();

  constructor(pool?: DatabasePool) { this.pool = pool || null; }
  private isDbAvailable(): boolean { return this.pool !== null; }

  async save(rule: DataQualityRule): Promise<void> {
    if (!this.isDbAvailable()) { this.memory.set(rule.id, rule); return; }
    await this.pool!.query(
      `INSERT INTO data_quality_rules (
        id, tenant_id, pipeline_id, stage_id, name, description, rule_type,
        severity, target_field, condition, enabled, created_by, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, description=EXCLUDED.description, rule_type=EXCLUDED.rule_type,
        severity=EXCLUDED.severity, target_field=EXCLUDED.target_field,
        condition=EXCLUDED.condition, enabled=EXCLUDED.enabled, updated_at=EXCLUDED.updated_at`,
      [
        rule.id, rule.tenantId, rule.pipelineId, rule.stageId || null, rule.name,
        rule.description || null, rule.ruleType, rule.severity, rule.targetField,
        JSON.stringify(rule.condition), rule.enabled, rule.createdBy,
        rule.createdAt, rule.updatedAt,
      ]
    );
  }

  async findByPipeline(tenantId: string, pipelineId: string): Promise<DataQualityRule[]> {
    if (!this.isDbAvailable()) {
      return Array.from(this.memory.values()).filter(r => r.tenantId === tenantId && r.pipelineId === pipelineId);
    }
    const rows = (await this.pool!.query(
      'SELECT * FROM data_quality_rules WHERE tenant_id = $1 AND pipeline_id = $2 ORDER BY created_at',
      [tenantId, pipelineId]
    )).rows;
    return rows.map((r: any) => this.rowToRule(r));
  }

  async findById(id: string): Promise<DataQualityRule | null> {
    if (!this.isDbAvailable()) return this.memory.get(id) || null;
    const rows = (await this.pool!.query('SELECT * FROM data_quality_rules WHERE id = $1', [id])).rows;
    return rows.length ? this.rowToRule(rows[0]) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) return this.memory.delete(id);
    const result = await this.pool!.query('DELETE FROM data_quality_rules WHERE id = $1', [id]);
    return (result as any).rowCount > 0;
  }

  private rowToRule(row: any): DataQualityRule {
    return {
      id: row.id, tenantId: row.tenant_id, pipelineId: row.pipeline_id,
      stageId: row.stage_id || undefined, name: row.name, description: row.description || undefined,
      ruleType: row.rule_type as RuleType, severity: row.severity as RuleSeverity,
      targetField: row.target_field, condition: (row.condition as Record<string, unknown>) || {},
      enabled: row.enabled, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class DataQualityService {
  private repository: QualityRuleRepository;
  private validationHistory: ValidationResult[] = [];

  constructor(database?: DatabasePool) {
    this.repository = new QualityRuleRepository(database);
  }

  async createRule(tenantId: string, input: CreateQualityRuleInput, createdBy: string): Promise<DataQualityRule> {
    const now = new Date();
    const rule: DataQualityRule = {
      id: uuidv4(), tenantId, pipelineId: input.pipelineId,
      stageId: input.stageId, name: input.name, description: input.description,
      ruleType: input.ruleType, severity: input.severity || 'warning',
      targetField: input.targetField, condition: input.condition,
      enabled: true, createdBy, createdAt: now, updatedAt: now,
    };
    await this.repository.save(rule);
    return rule;
  }

  async getRules(tenantId: string, pipelineId: string): Promise<DataQualityRule[]> {
    return this.repository.findByPipeline(tenantId, pipelineId);
  }

  async getRule(id: string): Promise<DataQualityRule | null> {
    return this.repository.findById(id);
  }

  async updateRule(id: string, updates: Partial<DataQualityRule>, updatedBy: string): Promise<DataQualityRule> {
    const rule = await this.repository.findById(id);
    if (!rule) throw new OrionError(`Quality rule '${id}' not found`, ErrorCode.NOT_FOUND);
    Object.assign(rule, updates, { updatedAt: new Date() });
    await this.repository.save(rule);
    return rule;
  }

  async toggleRule(id: string): Promise<DataQualityRule> {
    const rule = await this.repository.findById(id);
    if (!rule) throw new OrionError(`Quality rule '${id}' not found`, ErrorCode.NOT_FOUND);
    rule.enabled = !rule.enabled;
    rule.updatedAt = new Date();
    await this.repository.save(rule);
    return rule;
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }

  async validateData(
    ruleId: string,
    data: Record<string, unknown>[],
    executionId?: string
  ): Promise<ValidationResult> {
    const rule = await this.repository.findById(ruleId);
    if (!rule) throw new OrionError(`Quality rule '${ruleId}' not found`, ErrorCode.NOT_FOUND);
    if (!rule.enabled) throw new OrionError(`Rule is disabled`, 'VALIDATION_ERROR');

    const startTime = Date.now();
    let passedCount = 0;
    const failureSamples: unknown[] = [];

    for (const record of data) {
      const passed = this.evaluateRule(rule, record);
      if (passed) passedCount++;
      else {
        if (failureSamples.length < 5) failureSamples.push(record);
      }
    }

    const result: ValidationResult = {
      id: uuidv4(), ruleId, pipelineId: rule.pipelineId, executionId,
      status: failureSamples.length > 0 ? (rule.severity === 'critical' ? 'failed' : 'warning') : 'passed',
      totalRecords: data.length, passedRecords: passedCount, failedRecords: data.length - passedCount,
      failureRate: data.length > 0 ? (data.length - passedCount) / data.length : 0,
      failureSamples, validatedAt: new Date(), durationMs: Date.now() - startTime,
    };
    this.validationHistory.push(result);
    return result;
  }

  getValidationHistory(pipelineId?: string): ValidationResult[] {
    if (pipelineId) return this.validationHistory.filter(v => v.pipelineId === pipelineId);
    return this.validationHistory.slice(-100);
  }

  private evaluateRule(rule: DataQualityRule, record: Record<string, unknown>): boolean {
    const value = record[rule.targetField];
    switch (rule.ruleType) {
      case 'not_null': return value !== null && value !== undefined && value !== '';
      case 'unique': return value !== undefined;
      case 'range': {
        const num = Number(value);
        const cond = rule.condition;
        if (cond.min !== undefined && num < Number(cond.min)) return false;
        if (cond.max !== undefined && num > Number(cond.max)) return false;
        return true;
      }
      case 'pattern': return typeof value === 'string' && new RegExp(rule.condition.pattern as string).test(value);
      case 'completeness': {
        const threshold = Number(rule.condition.threshold || 0.9);
        const fields = (rule.condition.fields as string[]) || [];
        const filled = fields.filter(f => record[f] !== null && record[f] !== undefined && record[f] !== '').length;
        return fields.length === 0 || filled / fields.length >= threshold;
      }
      case 'referential': return value !== undefined;
      case 'custom': return true;
      default: return true;
    }
  }
}
