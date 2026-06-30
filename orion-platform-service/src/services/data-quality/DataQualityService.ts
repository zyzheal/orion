/**
 * Data Quality Service
 * Manages data quality rules, checks, and monitoring
 * Migrated from in-memory Map() to PostgreSQL Repository pattern
 */

import { v4 as uuidv4 } from 'uuid';
import { DataQualityRuleRepository, DataQualityCheckRepository } from '../../repositories/DataQualityRepository';

export interface QualityRule {
  id: string;
  tenant_id: string;
  name: string;
  table_name: string;
  column_name?: string;
  rule_type: 'not_null' | 'unique' | 'range' | 'regex' | 'custom' | 'freshness' | 'volume';
  config: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  last_check_at: string | null;
  last_status: 'pass' | 'fail' | 'error' | null;
  pass_rate: number;
  created_at: string;
  updated_at: string;
}

export interface QualityCheck {
  id: string;
  rule_id: string;
  rule_name: string;
  status: 'pass' | 'fail' | 'error';
  actual_value: string;
  expected_value: string;
  checked_at: string;
  details?: string;
}

export class DataQualityService {
  private ruleRepo: DataQualityRuleRepository;
  private checkRepo: DataQualityCheckRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.ruleRepo = new DataQualityRuleRepository(db);
    this.checkRepo = new DataQualityCheckRepository(db);
  }

  async createRule(input: {
    tenant_id: string;
    name: string;
    table_name: string;
    column_name?: string;
    rule_type: string;
    config?: Record<string, unknown>;
    severity?: string;
  }): Promise<QualityRule> {
    const entity = await this.ruleRepo.create({
      tenantId: input.tenant_id,
      name: input.name,
      tableName: input.table_name,
      columnName: input.column_name || null,
      ruleType: input.rule_type,
      config: input.config || {},
      severity: input.severity || 'warning',
      enabled: true,
      lastCheckAt: null,
      lastStatus: null,
      passRate: 0,
    });
    return this.entityToDto(entity);
  }

  async listRules(tenantId: string): Promise<QualityRule[]> {
    const { entities } = await this.ruleRepo.findByTenant({ tenantId });
    return entities.map(e => this.entityToDto(e));
  }

  async getRule(id: string): Promise<QualityRule | undefined> {
    const entity = await this.ruleRepo.findById(id);
    if (!entity) return undefined;
    return this.entityToDto(entity);
  }

  async updateRule(id: string, input: Partial<QualityRule>): Promise<QualityRule | undefined> {
    const existing = await this.ruleRepo.findById(id);
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.table_name !== undefined) updateData.tableName = input.table_name;
    if (input.column_name !== undefined) updateData.columnName = input.column_name;
    if (input.rule_type !== undefined) updateData.ruleType = input.rule_type;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.severity !== undefined) updateData.severity = input.severity;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    if (Object.keys(updateData).length === 0) return this.entityToDto(existing);

    const updated = await this.ruleRepo.update(id, updateData);
    return this.entityToDto(updated);
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.ruleRepo.delete(id);
  }

  async runCheck(ruleId: string): Promise<QualityCheck> {
    const rule = await this.ruleRepo.findById(ruleId);
    if (!rule) throw new Error('Rule not found');

    const checkEntity = await this.checkRepo.create({
      tenantId: rule.tenantId,
      ruleId,
      ruleName: rule.name,
      status: 'pass',
      actualValue: 'N/A',
      expectedValue: 'N/A',
      details: 'Simulated check result',
    });

    // Update rule status
    await this.ruleRepo.updateCheckResult(ruleId, 'pass', 100);

    return this.checkToDto(checkEntity);
  }

  async listChecks(tenantId: string, ruleId?: string): Promise<QualityCheck[]> {
    const { entities } = await this.checkRepo.findByTenant(tenantId, ruleId);
    return entities.map(e => this.checkToDto(e));
  }

  private entityToDto(entity: any): QualityRule {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      name: entity.name,
      table_name: entity.tableName,
      column_name: entity.columnName ?? undefined,
      rule_type: entity.ruleType,
      config: entity.config || {},
      severity: entity.severity,
      enabled: entity.enabled,
      last_check_at: entity.lastCheckAt ? new Date(entity.lastCheckAt).toISOString() : null,
      last_status: entity.lastStatus ?? null,
      pass_rate: entity.passRate ?? 0,
      created_at: entity.createdAt ? new Date(entity.createdAt).toISOString() : new Date().toISOString(),
      updated_at: entity.updatedAt ? new Date(entity.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  private checkToDto(entity: any): QualityCheck {
    return {
      id: entity.id,
      rule_id: entity.ruleId,
      rule_name: entity.ruleName,
      status: entity.status,
      actual_value: entity.actualValue ?? 'N/A',
      expected_value: entity.expectedValue ?? 'N/A',
      checked_at: entity.checkedAt ? new Date(entity.checkedAt).toISOString() : new Date().toISOString(),
      details: entity.details ?? undefined,
    };
  }
}
