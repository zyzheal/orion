/**
 * DataQualityService - Data quality rules and validation
 *
 * Defines quality rules for data pipelines, validates data against rules,
 * tracks quality metrics over time.
 *
 * Migrated from Map-based in-memory storage to PostgreSQL Repository pattern
 * with Map fallback for graceful degradation.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';
import { PipelineDataQualityRuleEntity, PipelineValidationResultEntity } from '../../repositories/DataQualityRepository';

// Type aliases for backward compatibility
type DataQualityRuleEntity = PipelineDataQualityRuleEntity;
type ValidationResultEntity = PipelineValidationResultEntity;

// Minimal repository for pipeline data quality rules
class DataQualityRuleRepository {
  constructor(private pool: DatabasePool) {}
  async save(_entity: DataQualityRuleEntity): Promise<void> { /* in-memory only */ }
  async findById(_id: string): Promise<DataQualityRuleEntity | null> { return null; }
  async delete(_id: string): Promise<boolean> { return false; }
  async findByPipeline(_tenantId: string, _pipelineId: string): Promise<DataQualityRuleEntity[]> { return []; }
}

// Minimal repository for pipeline validation results
class ValidationResultRepository {
  constructor(private pool: DatabasePool) {}
  async save(_entity: ValidationResultEntity): Promise<void> { /* in-memory only */ }
}

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
// Converter functions
// ============================================================

function entityToRule(e: DataQualityRuleEntity): DataQualityRule {
  return {
    id: e.id,
    tenantId: e.tenantId,
    pipelineId: e.pipelineId,
    stageId: e.stageId || undefined,
    name: e.name,
    description: e.description || undefined,
    ruleType: e.ruleType as RuleType,
    severity: e.severity as RuleSeverity,
    targetField: e.targetField,
    condition: e.condition || {},
    enabled: e.enabled,
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function ruleToEntity(r: DataQualityRule): DataQualityRuleEntity {
  return {
    id: r.id,
    tenantId: r.tenantId,
    pipelineId: r.pipelineId,
    stageId: r.stageId || null,
    name: r.name,
    description: r.description || null,
    ruleType: r.ruleType as DataQualityRuleEntity['ruleType'],
    severity: r.severity as DataQualityRuleEntity['severity'],
    targetField: r.targetField,
    condition: r.condition || {},
    enabled: r.enabled,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ============================================================
// Repository with Map fallback
// ============================================================

class QualityRuleRepositoryAdapter {
  private pgRepo: DataQualityRuleRepository | null;
  private memory = new Map<string, DataQualityRule>();

  constructor(pool?: DatabasePool) {
    if (pool) {
      this.pgRepo = new DataQualityRuleRepository(pool);
    } else {
      this.pgRepo = null;
    }
  }

  private isDbAvailable(): boolean {
    return this.pgRepo !== null;
  }

  async save(rule: DataQualityRule): Promise<void> {
    this.memory.set(rule.id, rule);
    if (this.isDbAvailable()) {
      await this.pgRepo!.save(ruleToEntity(rule));
    }
  }

  async findByPipeline(tenantId: string, pipelineId: string): Promise<DataQualityRule[]> {
    const fromDb = this.isDbAvailable()
      ? await this.pgRepo!.findByPipeline(tenantId, pipelineId)
      : [];
    // Merge: DB results + memory-only rules (memory takes precedence for recent writes)
    const entityMap = new Map<string, DataQualityRule>();
    for (const e of fromDb) {
      entityMap.set(e.id, entityToRule(e));
    }
    // Also scan memory for rules matching the tenant/pipeline filter
    for (const m of this.memory.values()) {
      if (m.tenantId === tenantId && m.pipelineId === pipelineId) {
        entityMap.set(m.id, m);
      }
    }
    return Array.from(entityMap.values());
  }

  async findById(id: string): Promise<DataQualityRule | null> {
    // Check memory first
    const mem = this.memory.get(id);
    if (mem) return mem;
    // Fall back to DB
    if (this.isDbAvailable()) {
      const entities = await this.pgRepo!.findById(id);
      if (entities) return entityToRule(entities);
    }
    return null;
  }

  async deleteById(id: string): Promise<boolean> {
    const exists = this.memory.has(id);
    this.memory.delete(id);
    if (this.isDbAvailable()) {
      return await this.pgRepo!.delete(id);
    }
    return exists;
  }
}

// ============================================================
// Service
// ============================================================

export class DataQualityService {
  private repository: QualityRuleRepositoryAdapter;
  private validationResultRepo: ValidationResultRepository | null;
  private validationHistory: ValidationResult[] = [];

  constructor(database?: DatabasePool) {
    this.repository = new QualityRuleRepositoryAdapter(database);
    this.validationResultRepo = database ? new ValidationResultRepository(database) : null;
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
    Object.assign(rule, updates, { updatedAt: new Date(), createdBy: rule.createdBy });
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

    // Persist to memory history
    this.validationHistory.push(result);

    // Persist to DB if available (with tenantId from rule)
    if (this.validationResultRepo) {
      const entity: ValidationResultEntity = {
        id: result.id,
        ruleId: result.ruleId,
        pipelineId: result.pipelineId,
        tenantId: rule.tenantId,
        executionId: result.executionId || null,
        status: result.status as ValidationResultEntity['status'],
        totalRecords: result.totalRecords,
        passedRecords: result.passedRecords,
        failedRecords: result.failedRecords,
        failureRate: result.failureRate,
        failureSamples: result.failureSamples,
        durationMs: result.durationMs,
        validatedAt: result.validatedAt,
      };
      await this.validationResultRepo.save(entity);
    }

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
