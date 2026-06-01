/**
 * ConfigVersionService - Configuration version history and rollback
 *
 * Tracks all configuration changes, provides version history,
 * diff between versions, and rollback capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export interface ConfigVersion {
  id: string;
  tenantId: string;
  configKey: string;
  configGroup?: string;
  environment: string;
  value: Record<string, unknown>;
  versionNumber: number;
  previousVersionId?: string;
  changeType: 'create' | 'update' | 'rollback';
  changedBy: string;
  changeReason?: string;
  createdAt: Date;
  tags?: string[];
}

export interface ConfigVersionDiff {
  configKey: string;
  environment: string;
  fromVersion: number;
  toVersion: number;
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  modified: Record<string, { old: unknown; new: unknown }>;
}

export interface RollbackResult {
  success: boolean;
  newVersionId: string;
  newVersionNumber: number;
  rolledBackTo: number;
  rolledBackBy: string;
  rolledBackAt: Date;
}

// ============================================================
// Repository
// ============================================================

class ConfigVersionRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, ConfigVersion[]>();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  private memoryKey(tenantId: string, configKey: string, environment: string): string {
    return `${tenantId}:${configKey}:${environment}`;
  }

  async save(version: ConfigVersion): Promise<void> {
    if (!this.isDbAvailable()) {
      const key = this.memoryKey(version.tenantId, version.configKey, version.environment);
      const versions = this.memory.get(key) || [];
      versions.push(version);
      versions.sort((a, b) => b.versionNumber - a.versionNumber);
      this.memory.set(key, versions);
      return;
    }
    await this.pool!.query(
      `INSERT INTO config_versions (
        id, tenant_id, config_key, config_group, environment, value,
        version_number, previous_version_id, change_type, changed_by,
        change_reason, created_at, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        version.id, version.tenantId, version.configKey, version.configGroup || null,
        version.environment, JSON.stringify(version.value), version.versionNumber,
        version.previousVersionId || null, version.changeType, version.changedBy,
        version.changeReason || null, version.createdAt, JSON.stringify(version.tags || []),
      ]
    );
  }

  async getVersions(
    tenantId: string,
    configKey: string,
    environment: string,
    limit: number = 50
  ): Promise<ConfigVersion[]> {
    if (!this.isDbAvailable()) {
      const key = this.memoryKey(tenantId, configKey, environment);
      return (this.memory.get(key) || []).slice(0, limit);
    }
    const rows = (
      await this.pool!.query(
        `SELECT * FROM config_versions
         WHERE tenant_id = $1 AND config_key = $2 AND environment = $3
         ORDER BY version_number DESC LIMIT $4`,
        [tenantId, configKey, environment, limit]
      )
    ).rows;
    return rows.map((r: any) => this.rowToVersion(r));
  }

  async getVersionById(id: string): Promise<ConfigVersion | null> {
    if (!this.isDbAvailable()) {
      for (const versions of this.memory.values()) {
        const found = versions.find(v => v.id === id);
        if (found) return found;
      }
      return null;
    }
    const rows = (await this.pool!.query('SELECT * FROM config_versions WHERE id = $1', [id])).rows;
    if (rows.length === 0) return null;
    return this.rowToVersion(rows[0]);
  }

  async getLatestVersion(tenantId: string, configKey: string, environment: string): Promise<ConfigVersion | null> {
    const versions = await this.getVersions(tenantId, configKey, environment, 1);
    return versions.length > 0 ? versions[0] : null;
  }

  private rowToVersion(row: any): ConfigVersion {
    return {
      id: row.id, tenantId: row.tenant_id, configKey: row.config_key,
      configGroup: row.config_group || undefined, environment: row.environment,
      value: (row.value as Record<string, unknown>) || {},
      versionNumber: row.version_number,
      previousVersionId: row.previous_version_id || undefined,
      changeType: row.change_type as ConfigVersion['changeType'],
      changedBy: row.changed_by, changeReason: row.change_reason || undefined,
      createdAt: row.created_at, tags: row.tags || undefined,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class ConfigVersionService {
  private repository: ConfigVersionRepository;

  constructor(database?: DatabasePool) {
    this.repository = new ConfigVersionRepository(database);
  }

  async recordVersion(
    tenantId: string,
    configKey: string,
    environment: string,
    value: Record<string, unknown>,
    changeType: ConfigVersion['changeType'],
    changedBy: string,
    configGroup?: string,
    changeReason?: string,
    previousVersionId?: string
  ): Promise<ConfigVersion> {
    const latest = await this.repository.getLatestVersion(tenantId, configKey, environment);
    const versionNumber = latest ? latest.versionNumber + 1 : 1;

    const version: ConfigVersion = {
      id: uuidv4(),
      tenantId,
      configKey,
      configGroup,
      environment,
      value,
      versionNumber,
      previousVersionId: previousVersionId || latest?.id,
      changeType,
      changedBy,
      changeReason,
      createdAt: new Date(),
    };

    await this.repository.save(version);
    return version;
  }

  async getVersionHistory(
    tenantId: string,
    configKey: string,
    environment: string,
    limit: number = 50
  ): Promise<ConfigVersion[]> {
    return this.repository.getVersions(tenantId, configKey, environment, limit);
  }

  async getVersionById(id: string): Promise<ConfigVersion | null> {
    return this.repository.getVersionById(id);
  }

  async rollbackToVersion(
    tenantId: string,
    configKey: string,
    environment: string,
    targetVersionNumber: number,
    rolledBackBy: string
  ): Promise<RollbackResult> {
    const versions = await this.repository.getVersions(tenantId, configKey, environment, 200);
    const target = versions.find(v => v.versionNumber === targetVersionNumber);
    if (!target) throw new OrionError(`Version ${targetVersionNumber} not found`, ErrorCode.NOT_FOUND);

    const newVersion = await this.recordVersion(
      tenantId, configKey, environment,
      target.value, 'rollback', rolledBackBy,
      target.configGroup, `Rolled back to version ${targetVersionNumber}`,
      target.id
    );

    return {
      success: true,
      newVersionId: newVersion.id,
      newVersionNumber: newVersion.versionNumber,
      rolledBackTo: targetVersionNumber,
      rolledBackBy,
      rolledBackAt: newVersion.createdAt,
    };
  }

  async diffVersions(
    tenantId: string,
    configKey: string,
    environment: string,
    fromVersion: number,
    toVersion: number
  ): Promise<ConfigVersionDiff> {
    const versions = await this.repository.getVersions(tenantId, configKey, environment, 200);
    const from = versions.find(v => v.versionNumber === fromVersion);
    const to = versions.find(v => v.versionNumber === toVersion);

    if (!from) throw new OrionError(`Version ${fromVersion} not found`, ErrorCode.NOT_FOUND);
    if (!to) throw new OrionError(`Version ${toVersion} not found`, ErrorCode.NOT_FOUND);

    const diff: ConfigVersionDiff = {
      configKey,
      environment,
      fromVersion,
      toVersion,
      added: {},
      removed: {},
      modified: {},
    };

    const oldKeys = new Set(Object.keys(from.value));
    const newKeys = new Set(Object.keys(to.value));

    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        diff.added[key] = to.value[key];
      } else if (JSON.stringify(from.value[key]) !== JSON.stringify(to.value[key])) {
        diff.modified[key] = { old: from.value[key], new: to.value[key] };
      }
    }
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        diff.removed[key] = from.value[key];
      }
    }

    return diff;
  }
}
