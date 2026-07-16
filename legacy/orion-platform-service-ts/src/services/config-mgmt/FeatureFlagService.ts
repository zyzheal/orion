/**
 * FeatureFlagService - Feature flag management with rollout percentage control
 *
 * Supports:
 * - CRUD for feature flags
 * - Percentage-based rollout
 * - User/target-based targeting rules
 * - Flag evaluation
 * - Flag toggle history
 *
 * Migrated from inline Map storage to PostgreSQL Repository pattern (353).
 * Falls back to in-memory Map when no database is available.
 */

import { v4 as uuidv4 } from 'uuid';
import { FeatureFlagRepository } from '../../repositories/FeatureFlagRepository';
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
// Service
// ============================================================

export class FeatureFlagService {
  private repository: FeatureFlagRepository;

  constructor(pool?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new FeatureFlagRepository(pool);
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

    return this.repository.create(flag);
  }

  async getFlag(id: string): Promise<FeatureFlag | null> {
    const flag = await this.repository.findById(id);
    if (!flag) return null;
    // Attach toggle history
    flag.toggleHistory = await this.repository.getToggleHistory(id);
    return flag;
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

    const updated = await this.repository.update(id, flag);
    if (!updated) {
      throw new OrionError(`Feature flag '${id}' not found during update`, ErrorCode.NOT_FOUND);
    }
    return updated;
  }

  async deleteFlag(id: string): Promise<boolean> {
    return this.repository.delete(id);
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
    await this.repository.recordToggle({
      flagId,
      oldValue,
      newValue,
      changedBy,
      reason,
      changedAt: new Date(),
    });
  }

  async getToggleHistory(flagId: string): Promise<FlagToggleRecord[]> {
    return this.repository.getToggleHistory(flagId);
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
