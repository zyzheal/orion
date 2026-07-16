/**
 * FeatureFlagRepository — PostgreSQL data access for feature flag management
 *
 * Manages the feature_flags and flag_toggle_history tables.
 * Supports graceful degradation to in-memory Map when no DB is available.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  FeatureFlag,
  FlagToggleRecord,
  TargetingRule,
  FeatureFlagStatus,
  RolloutStrategy,
} from '../services/config-mgmt/FeatureFlagService';

export interface FeatureFlagRow {
  id: string;
  tenant_id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  default_value: boolean;
  rollout_percentage: number;
  rollout_strategy: string;
  targeting_rules: unknown[];
  environments: string[];
  tags: string[];
  created_by: string;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ToggleHistoryRow {
  id: string;
  flag_id: string;
  old_value: boolean;
  new_value: boolean;
  changed_by: string;
  reason: string | null;
  changed_at: Date | string;
}

export class FeatureFlagRepository {
  private dbQuery: ((text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>) | null;
  private memory = new Map<string, FeatureFlag>();

  constructor(pool?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.dbQuery = pool ? pool.query.bind(pool) : null;
  }

  private isDbAvailable(): boolean {
    return this.dbQuery !== null;
  }

  // ---- Feature Flag CRUD ----

  async findById(id: string): Promise<FeatureFlag | null> {
    if (!this.isDbAvailable()) {
      return this.memory.get(id) || null;
    }
    const result = await this.dbQuery!('SELECT * FROM feature_flags WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToFlag(result.rows[0]);
  }

  async findByKey(tenantId: string, key: string): Promise<FeatureFlag | null> {
    if (!this.isDbAvailable()) {
      for (const flag of this.memory.values()) {
        if (flag.tenantId === tenantId && flag.key === key) return flag;
      }
      return null;
    }
    const result = await this.dbQuery!(
      'SELECT * FROM feature_flags WHERE tenant_id = $1 AND key = $2',
      [tenantId, key]
    );
    if (result.rows.length === 0) return null;
    return this.rowToFlag(result.rows[0]);
  }

  async findByTenant(
    tenantId: string,
    filter?: { status?: string; environment?: string }
  ): Promise<FeatureFlag[]> {
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
    const result = await this.dbQuery!(query, params);
    return result.rows.map((r: FeatureFlagRow) => this.rowToFlag(r));
  }

  async create(flag: FeatureFlag): Promise<FeatureFlag> {
    if (!this.isDbAvailable()) {
      this.memory.set(flag.id, flag);
      return flag;
    }
    const result = await this.dbQuery!(
      `INSERT INTO feature_flags (
        id, tenant_id, key, name, description, status, default_value,
        rollout_percentage, rollout_strategy, targeting_rules, environments,
        tags, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
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
    return this.rowToFlag(result.rows[0]);
  }

  async update(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    const flag = await this.findById(id);
    if (!flag) return null;

    Object.assign(flag, updates);
    const now = new Date();
    flag.updatedAt = now;

    if (!this.isDbAvailable()) {
      this.memory.set(flag.id, flag);
      return flag;
    }

    const result = await this.dbQuery!(
      `UPDATE feature_flags SET
        name = $1,
        description = $2,
        status = $3,
        default_value = $4,
        rollout_percentage = $5,
        rollout_strategy = $6,
        targeting_rules = $7,
        environments = $8,
        tags = $9,
        updated_by = $10,
        updated_at = $11
      WHERE id = $12 RETURNING *`,
      [
        flag.name,
        flag.description || null,
        flag.status,
        flag.defaultValue,
        flag.rolloutPercentage,
        flag.rolloutStrategy,
        JSON.stringify(flag.targetingRules),
        JSON.stringify(flag.environments),
        JSON.stringify(flag.tags),
        flag.updatedBy || null,
        flag.updatedAt,
        flag.id,
      ]
    );
    return this.rowToFlag(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) {
      return this.memory.delete(id);
    }
    const result = await this.dbQuery!('DELETE FROM feature_flags WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ---- Toggle History ----

  async recordToggle(record: Omit<FlagToggleRecord, 'id'>): Promise<FlagToggleRecord> {
    const flag = await this.findById(record.flagId);
    if (!flag) return record as FlagToggleRecord;

    const fullRecord: FlagToggleRecord = {
      ...record,
      id: uuidv4(),
    };

    // Append to flag's in-memory history
    flag.toggleHistory = flag.toggleHistory || [];
    flag.toggleHistory.push(fullRecord);

    // Save flag back to persist updated toggleHistory
    await this.update(record.flagId, { toggleHistory: flag.toggleHistory } as Partial<FeatureFlag>);

    // Persist to DB toggle_history table
    if (this.isDbAvailable()) {
      await this.dbQuery!(
        `INSERT INTO flag_toggle_history (flag_id, old_value, new_value, changed_by, reason, changed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          fullRecord.flagId,
          fullRecord.oldValue,
          fullRecord.newValue,
          fullRecord.changedBy,
          fullRecord.reason || null,
          fullRecord.changedAt,
        ]
      );
    }

    return fullRecord;
  }

  async getToggleHistory(flagId: string): Promise<FlagToggleRecord[]> {
    if (!this.isDbAvailable()) {
      const flag = this.memory.get(flagId);
      return flag?.toggleHistory || [];
    }

    const result = await this.dbQuery!(
      'SELECT * FROM flag_toggle_history WHERE flag_id = $1 ORDER BY changed_at DESC',
      [flagId]
    );

    return result.rows.map((row: ToggleHistoryRow) => ({
      id: row.id,
      flagId: row.flag_id,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedBy: row.changed_by,
      reason: row.reason || undefined,
      changedAt: new Date(row.changed_at),
    }));
  }

  // ---- Helpers ----

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
      targetingRules: (row.targeting_rules as TargetingRule[]) || [],
      environments: row.environments || [],
      tags: row.tags || [],
      createdBy: row.created_by,
      updatedBy: row.updated_by || undefined,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
      updatedAt: typeof row.updated_at === 'string' ? new Date(row.updated_at) : row.updated_at,
      toggleHistory: [],
    };
  }
}
