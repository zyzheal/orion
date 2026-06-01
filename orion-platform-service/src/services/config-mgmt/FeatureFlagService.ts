/**
 * FeatureFlagService - Feature flag management with rollout percentage control
 *
 * Supports:
 * - CRUD for feature flags
 * - Percentage-based rollout
 * - User/target-based targeting rules
 * - Flag evaluation
 * - Flag toggle history
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export type FeatureFlagStatus = 'active' | 'inactive' | 'archived';
export type RolloutStrategy = 'percentage' | 'targeted' | 'gradual';

export interface TargetingRule {
  attribute: string;
  operator: 'equals' | 'contains' | 'in' | 'regex' | 'gt' | 'lt';
  value: string | string[];
}

export interface FeatureFlag {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description?: string;
  status: FeatureFlagStatus;
  defaultValue: boolean;
  rolloutPercentage: number;
  rolloutStrategy: RolloutStrategy;
  targetingRules: TargetingRule[];
  environments: string[];
  tags: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  toggleHistory: FlagToggleRecord[];
}

export interface FlagToggleRecord {
  id: string;
  flagId: string;
  oldValue: boolean;
  newValue: boolean;
  changedBy: string;
  reason?: string;
  changedAt: Date;
}

export interface FlagEvaluationResult {
  flagId: string;
  key: string;
  enabled: boolean;
  reason: string;
  evaluatedAt: Date;
}

export interface CreateFeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  defaultValue?: boolean;
  rolloutPercentage?: number;
  rolloutStrategy?: RolloutStrategy;
  targetingRules?: TargetingRule[];
  environments?: string[];
  tags?: string[];
}

export interface UpdateFeatureFlagInput {
  name?: string;
  description?: string;
  status?: FeatureFlagStatus;
  defaultValue?: boolean;
  rolloutPercentage?: number;
  rolloutStrategy?: RolloutStrategy;
  targetingRules?: TargetingRule[];
  environments?: string[];
  tags?: string[];
}

export interface EvaluateFlagContext {
  userId?: string;
  tenantId?: string;
  environment?: string;
  attributes?: Record<string, unknown>;
}

// ============================================================
// Repository
// ============================================================

interface FeatureFlagRow {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  default_value: boolean;
  rollout_percentage: number;
  rollout_strategy: string;
  targeting_rules: Record<string, unknown>[];
  environments: string[];
  tags: string[];
  created_by: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

class FeatureFlagRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, FeatureFlag>();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async save(flag: FeatureFlag): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.set(flag.id, flag);
      return;
    }
    await this.pool!.query(
      `INSERT INTO feature_flags (
        id, tenant_id, key, name, description, status, default_value,
        rollout_percentage, rollout_strategy, targeting_rules, environments,
        tags, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        default_value = EXCLUDED.default_value,
        rollout_percentage = EXCLUDED.rollout_percentage,
        rollout_strategy = EXCLUDED.rollout_strategy,
        targeting_rules = EXCLUDED.targeting_rules,
        environments = EXCLUDED.environments,
        tags = EXCLUDED.tags,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at`,
      [
        flag.id,
        flag.tenantId,
        flag.key,
        flag.name,
        flag.description || null,
        flag.status,
        flag.defaultValue,
        flag.rolloutPercentage,
        flag.rolloutStrategy,
        JSON.stringify(flag.targetingRules),
        JSON.stringify(flag.environments),
        JSON.stringify(flag.tags),
        flag.createdBy,
        flag.updatedBy || null,
        flag.createdAt,
        flag.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<FeatureFlag | null> {
    if (!this.isDbAvailable()) {
      return this.memory.get(id) || null;
    }
    const rows = (
      await this.pool!.query('SELECT * FROM feature_flags WHERE id = $1', [id])
    ).rows;
    if (rows.length === 0) return null;
    return this.rowToFlag(rows[0]);
  }

  async findByKey(tenantId: string, key: string): Promise<FeatureFlag | null> {
    if (!this.isDbAvailable()) {
      for (const flag of this.memory.values()) {
        if (flag.tenantId === tenantId && flag.key === key) return flag;
      }
      return null;
    }
    const rows = (
      await this.pool!.query(
        'SELECT * FROM feature_flags WHERE tenant_id = $1 AND key = $2',
        [tenantId, key]
      )
    ).rows;
    if (rows.length === 0) return null;
    return this.rowToFlag(rows[0]);
  }

  async findByTenant(tenantId: string, filter?: { status?: string; environment?: string }): Promise<FeatureFlag[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.memory.values()).filter(f => f.tenantId === tenantId);
      if (filter?.status) results = results.filter(f => f.status === filter.status);
      if (filter?.environment) results = results.filter(f => f.environments.includes(filter.environment!));
      return results;
    }

    let query = 'SELECT * FROM feature_flags WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIdx = 2;

    if (filter?.status) {
      query += ` AND status = $${paramIdx}`;
      params.push(filter.status);
      paramIdx++;
    }
    if (filter?.environment) {
      query += ` AND environments @> $${paramIdx}::jsonb`;
      params.push(JSON.stringify([filter.environment]));
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: FeatureFlagRow) => this.rowToFlag(r));
  }

  async deleteById(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      return this.memory.delete(id);
    }
    const result = await this.pool!.query('DELETE FROM feature_flags WHERE id = $1', [id]);
    return (result as any).rowCount > 0;
  }

  private rowToFlag(row: FeatureFlagRow): FeatureFlag {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      key: row.key,
      name: row.name,
      description: row.description || undefined,
      status: row.status as FeatureFlagStatus,
      defaultValue: row.default_value,
      rolloutPercentage: row.rollout_percentage,
      rolloutStrategy: row.rollout_strategy as RolloutStrategy,
      targetingRules: (row.targeting_rules as unknown as TargetingRule[]) || [],
      environments: row.environments || [],
      tags: row.tags || [],
      createdBy: row.created_by,
      updatedBy: row.updated_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      toggleHistory: [],
    };
  }
}

// ============================================================
// Service
// ============================================================

export class FeatureFlagService {
  private repository: FeatureFlagRepository;

  constructor(database?: DatabasePool) {
    this.repository = new FeatureFlagRepository(database);
  }

  async createFlag(
    tenantId: string,
    input: CreateFeatureFlagInput,
    createdBy: string
  ): Promise<FeatureFlag> {
    const existing = await this.repository.findByKey(tenantId, input.key);
    if (existing) {
      throw new OrionError(`Feature flag with key '${input.key}' already exists`, ErrorCode.NOT_FOUND);
    }

    const now = new Date();
    const flag: FeatureFlag = {
      id: uuidv4(),
      tenantId,
      key: input.key,
      name: input.name,
      description: input.description,
      status: 'active',
      defaultValue: input.defaultValue ?? false,
      rolloutPercentage: input.rolloutPercentage ?? 0,
      rolloutStrategy: input.rolloutStrategy ?? 'percentage',
      targetingRules: input.targetingRules ?? [],
      environments: input.environments ?? ['development', 'staging', 'production'],
      tags: input.tags ?? [],
      createdBy,
      createdAt: now,
      updatedAt: now,
      toggleHistory: [],
    };

    await this.repository.save(flag);
    return flag;
  }

  async getFlag(id: string): Promise<FeatureFlag | null> {
    return this.repository.findById(id);
  }

  async listFlags(
    tenantId: string,
    filter?: { status?: string; environment?: string }
  ): Promise<FeatureFlag[]> {
    return this.repository.findByTenant(tenantId, filter);
  }

  async updateFlag(
    id: string,
    updates: UpdateFeatureFlagInput,
    updatedBy: string
  ): Promise<FeatureFlag> {
    const flag = await this.repository.findById(id);
    if (!flag) throw new OrionError(`Feature flag '${id}' not found`, ErrorCode.NOT_FOUND);

    if (updates.name !== undefined) flag.name = updates.name;
    if (updates.description !== undefined) flag.description = updates.description;
    if (updates.status !== undefined) flag.status = updates.status;
    if (updates.defaultValue !== undefined) flag.defaultValue = updates.defaultValue;
    if (updates.rolloutPercentage !== undefined) flag.rolloutPercentage = updates.rolloutPercentage;
    if (updates.rolloutStrategy !== undefined) flag.rolloutStrategy = updates.rolloutStrategy;
    if (updates.targetingRules !== undefined) flag.targetingRules = updates.targetingRules;
    if (updates.environments !== undefined) flag.environments = updates.environments;
    if (updates.tags !== undefined) flag.tags = updates.tags;

    flag.updatedBy = updatedBy;
    flag.updatedAt = new Date();

    await this.repository.save(flag);
    return flag;
  }

  async deleteFlag(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }

  async setRolloutPercentage(id: string, percentage: number, updatedBy: string): Promise<FeatureFlag> {
    if (percentage < 0 || percentage > 100) {
      throw new OrionError('Rollout percentage must be between 0 and 100', ErrorCode.OPERATION_FAILED);
    }
    return this.updateFlag(id, { rolloutPercentage: percentage }, updatedBy);
  }

  async evaluateFlag(
    tenantId: string,
    flagKey: string,
    context?: EvaluateFlagContext
  ): Promise<FlagEvaluationResult> {
    const flag = await this.repository.findByKey(tenantId, flagKey);
    if (!flag) {
      return { flagId: '', key: flagKey, enabled: false, reason: 'Flag not found', evaluatedAt: new Date() };
    }
    if (flag.status !== 'active') {
      return { flagId: flag.id, key: flagKey, enabled: false, reason: `Flag is ${flag.status}`, evaluatedAt: new Date() };
    }
    if (context?.environment && !flag.environments.includes(context.environment)) {
      return { flagId: flag.id, key: flagKey, enabled: flag.defaultValue, reason: 'Environment not enabled', evaluatedAt: new Date() };
    }

    // Check targeting rules first
    if (flag.targetingRules.length > 0 && context?.attributes) {
      const allMatch = flag.targetingRules.every(rule => {
        const attrValue = context.attributes![rule.attribute];
        if (attrValue === undefined) return false;
        switch (rule.operator) {
          case 'equals': return attrValue === rule.value;
          case 'contains': return String(attrValue).includes(rule.value as string);
          case 'in': return (rule.value as string[]).includes(String(attrValue));
          case 'gt': return Number(attrValue) > Number(rule.value);
          case 'lt': return Number(attrValue) < Number(rule.value);
          case 'regex': return new RegExp(rule.value as string).test(String(attrValue));
          default: return false;
        }
      });
      if (allMatch) {
        return { flagId: flag.id, key: flagKey, enabled: true, reason: 'Targeting rules matched', evaluatedAt: new Date() };
      }
    }

    // Percentage-based rollout
    if (flag.rolloutStrategy === 'percentage') {
      if (context?.userId) {
        const hash = this.hashUserId(context.userId, flagKey);
        const enabled = hash < flag.rolloutPercentage;
        return {
          flagId: flag.id,
          key: flagKey,
          enabled,
          reason: enabled ? `Rollout ${flag.rolloutPercentage}%: user included` : `Rollout ${flag.rolloutPercentage}%: user excluded`,
          evaluatedAt: new Date(),
        };
      }
    }

    return { flagId: flag.id, key: flagKey, enabled: flag.defaultValue, reason: 'Default value', evaluatedAt: new Date() };
  }

  async recordToggle(
    flagId: string,
    oldValue: boolean,
    newValue: boolean,
    changedBy: string,
    reason?: string
  ): Promise<void> {
    const flag = await this.repository.findById(flagId);
    if (!flag) return;

    const record: FlagToggleRecord = {
      id: uuidv4(),
      flagId,
      oldValue,
      newValue,
      changedBy,
      reason,
      changedAt: new Date(),
    };
    flag.toggleHistory.push(record);
    await this.repository.save(flag);
  }

  private hashUserId(userId: string, flagKey: string): number {
    let hash = 0;
    const str = `${userId}:${flagKey}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}
