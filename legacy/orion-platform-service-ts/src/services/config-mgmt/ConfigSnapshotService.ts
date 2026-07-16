/**
 * ConfigSnapshotService — Business logic for configuration version snapshots
 *
 * Features:
 *   - Create version snapshots (capture full config state at a point in time)
 *   - List version history for a config key
 *   - Rollback to a specific version
 *   - Compare two versions to show differences
 *
 * Multi-tenancy: All operations are scoped by tenantId (domain).
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import {
  ConfigVersionRepository,
  ConfigVersionEntity,
  ConfigSnapshotEntity,
} from '../../repositories/ConfigVersionRepository';
import { ConfigRepository, ConfigEntry } from './ConfigRepository';
import { OrionError, ErrorCode } from '../../errors';
import { CacheService } from '../cache/CacheService';
import { createLogger } from '../../utils/logger';

// ==================== Types ====================

export interface ConfigSnapshotInfo {
  id: string;
  tenantId: string;
  snapshotName: string;
  createdBy: string;
  createdAt: Date;
  description?: string;
  configKeys: string[];
  configCount: number;
  checksum: string;
}

export interface ConfigVersionInfo {
  id: string;
  tenantId: string;
  domain: string;
  key: string;
  version: number;
  changeType: string;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  changedBy: string;
  changedAt: Date;
  comment?: string;
  checksum: string;
}

export interface VersionComparisonResult {
  configId: string;
  key: string;
  fromVersion: number;
  toVersion: number;
  fromValue: Record<string, any> | null;
  toValue: Record<string, any> | null;
  addedKeys: string[];
  removedKeys: string[];
  modifiedKeys: { key: string; oldValue: any; newValue: any }[];
  changeSummary: string;
  generatedAt: Date;
}

export interface CreateSnapshotInput {
  snapshotName: string;
  description?: string;
  createdBy: string;
}

// ==================== Service ====================

export class ConfigSnapshotService {
  private versionRepo: ConfigVersionRepository;
  private configRepo: ConfigRepository;
  private cache: CacheService;
  private logger = createLogger('config-snapshot-service');

  constructor(
    versionRepo: ConfigVersionRepository,
    configRepo: ConfigRepository,
    cache?: CacheService,
  ) {
    this.versionRepo = versionRepo;
    this.configRepo = configRepo;
    this.cache = cache || new CacheService(null);
  }

  // ==================== Snapshot CRUD ====================

  /**
   * Create a snapshot — captures all active config entries for the tenant at this point in time.
   */
  async createSnapshot(
    tenantId: string,
    input: CreateSnapshotInput,
  ): Promise<ConfigSnapshotInfo> {
    if (!input.snapshotName || !input.createdBy) {
      throw new OrionError('snapshotName and createdBy are required', ErrorCode.VALIDATION_ERROR);
    }

    // Gather all active configs for this tenant
    const configs = await this.configRepo.findAll(tenantId);
    const configData: Record<string, any> = {};
    const configKeys: string[] = [];

    for (const config of configs) {
      const key = config.key;
      configKeys.push(key);
      configData[key] = config.value;
    }

    const configDataStr = JSON.stringify(configData);
    const checksum = createHash('sha256').update(configDataStr).digest('hex');

    const snapshot: ConfigSnapshotEntity = {
      id: uuidv4(),
      tenantId,
      snapshotName: input.snapshotName,
      createdBy: input.createdBy,
      createdAt: new Date(),
      configData: configDataStr,
      checksum,
      description: input.description,
    };

    await this.versionRepo.insertSnapshot(snapshot);

    // Invalidate snapshot list cache
    await this.cache.del(`config:snapshots:${tenantId}`);

    return {
      id: snapshot.id,
      tenantId: snapshot.tenantId,
      snapshotName: snapshot.snapshotName,
      createdBy: snapshot.createdBy,
      createdAt: snapshot.createdAt,
      description: snapshot.description,
      configKeys,
      configCount: configKeys.length,
      checksum: snapshot.checksum,
    };
  }

  /**
   * List all snapshots for a tenant
   */
  async listSnapshots(
    tenantId: string,
    limit: number = 20,
  ): Promise<ConfigSnapshotInfo[]> {
    // Try cache first
    const cacheKey = `config:snapshots:${tenantId}:${limit}`;
    const cached = await this.cache.get<ConfigSnapshotInfo[]>(cacheKey);
    if (cached) return cached;

    const snapshots = await this.versionRepo.findSnapshots({ tenantId, limit });

    const result: ConfigSnapshotInfo[] = snapshots.map((s: ConfigSnapshotEntity) => {
      try {
        const configData = JSON.parse(s.configData);
        const configKeys = Object.keys(configData);
        return {
          id: s.id,
          tenantId: s.tenantId,
          snapshotName: s.snapshotName,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          description: s.description,
          configKeys,
          configCount: configKeys.length,
          checksum: s.checksum,
        };
      } catch {
        return {
          id: s.id,
          tenantId: s.tenantId,
          snapshotName: s.snapshotName,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          description: s.description,
          configKeys: [],
          configCount: 0,
          checksum: s.checksum,
        };
      }
    });

    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  /**
   * Get a single snapshot by ID
   */
  async getSnapshot(
    tenantId: string,
    snapshotId: string,
  ): Promise<ConfigSnapshotInfo | null> {
    const snapshot = await this.versionRepo.findSnapshotById(snapshotId, tenantId);
    if (!snapshot) return null;

    try {
      const configData = JSON.parse(snapshot.configData);
      const configKeys = Object.keys(configData);
      return {
        id: snapshot.id,
        tenantId: snapshot.tenantId,
        snapshotName: snapshot.snapshotName,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
        description: snapshot.description,
        configKeys,
        configCount: configKeys.length,
        checksum: snapshot.checksum,
      };
    } catch {
      return {
        id: snapshot.id,
        tenantId: snapshot.tenantId,
        snapshotName: snapshot.snapshotName,
        createdBy: snapshot.createdBy,
        createdAt: snapshot.createdAt,
        description: snapshot.description,
        configKeys: [],
        configCount: 0,
        checksum: snapshot.checksum,
      };
    }
  }

  /**
   * Get the full config data of a snapshot
   */
  async getSnapshotData(
    tenantId: string,
    snapshotId: string,
  ): Promise<Record<string, any> | null> {
    const snapshot = await this.versionRepo.findSnapshotById(snapshotId, tenantId);
    if (!snapshot) return null;
    try {
      return JSON.parse(snapshot.configData) as Record<string, any>;
    } catch {
      return null;
    }
  }

  /**
   * Restore a snapshot — replaces all active config entries for the tenant
   * with the data captured in the snapshot.
   */
  async restoreSnapshot(
    tenantId: string,
    snapshotId: string,
    restoredBy: string,
  ): Promise<{ restoredCount: number; configKeys: string[] }> {
    const snapshot = await this.versionRepo.findSnapshotById(snapshotId, tenantId);
    if (!snapshot) {
      throw new OrionError(
        `Snapshot '${snapshotId}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    let configData: Record<string, any>;
    try {
      configData = JSON.parse(snapshot.configData) as Record<string, any>;
    } catch {
      throw new OrionError(
        'Invalid snapshot data',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const configKeys = Object.keys(configData);
    let restoredCount = 0;

    for (const key of configKeys) {
      const value = configData[key];
      await this.configRepo.set(tenantId, key, value, restoredBy);
      restoredCount++;
    }

    this.logger.info(
      { tenantId, snapshotId, restoredCount, configKeys },
      'Snapshot restored successfully',
    );

    return { restoredCount, configKeys };
  }

  /**
   * Delete a snapshot (soft concept — removes the snapshot record)
   */
  async deleteSnapshot(tenantId: string, snapshotId: string): Promise<boolean> {
    const result = await this.versionRepo.deleteSnapshot(snapshotId, tenantId);
    if (result) {
      await this.cache.del(`config:snapshots:${tenantId}:*`);
    }
    return result;
  }

  // ==================== Version History ====================

  /**
   * Record a new version entry when a config value changes.
   * Call this from ConfigService.set() and ConfigService.updateConfig().
   */
  async recordVersion(
    tenantId: string,
    domain: string,
    key: string,
    oldValue: Record<string, any> | null,
    newValue: Record<string, any>,
    changedBy: string,
    changeType: 'create' | 'update' | 'delete' = 'update',
    comment?: string,
  ): Promise<ConfigVersionInfo> {
    const configEntry = await this.configRepo.findByKey(tenantId, key);
    const configId = configEntry?.id || `config-${uuidv4()}`;

    const nextVersion = await this.versionRepo.getMaxVersion(domain, key) + 1;
    const oldValueStr = oldValue ? JSON.stringify(oldValue) : null;
    const newValueStr = JSON.stringify(newValue);
    const checksum = createHash('sha256')
      .update(`${domain}:${key}:${nextVersion}:${newValueStr}`)
      .digest('hex');

    const versionEntity: ConfigVersionEntity = {
      id: uuidv4(),
      domain: tenantId,
      key,
      oldValue: oldValueStr ?? '',
      newValue: newValueStr,
      changedBy,
      changedAt: new Date(),
      changeType,
      version: nextVersion,
      comment,
      checksum,
    };

    await this.versionRepo.insertVersion(versionEntity);

    // Invalidate version cache
    await this.cache.del(`config:versions:${tenantId}:${key}`);

    return this.mapVersionEntityToInfo(versionEntity);
  }

  /**
   * List version history for a specific config key (tenant-isolated)
   */
  async listVersions(
    tenantId: string,
    key: string,
    limit: number = 50,
  ): Promise<ConfigVersionInfo[]> {
    // Try cache
    const cacheKey = `config:versions:${tenantId}:${key}:${limit}`;
    const cached = await this.cache.get<ConfigVersionInfo[]>(cacheKey);
    if (cached) return cached;

    const versions = await this.versionRepo.findVersions({
      domain: tenantId,
      key,
      limit,
    });

    const result = versions.map(this.mapVersionEntityToInfo);
    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  /**
   * Get a specific version by its version number
   */
  async getVersion(
    tenantId: string,
    key: string,
    version: number,
  ): Promise<ConfigVersionInfo | null> {
    const versions = await this.versionRepo.findVersions({
      domain: tenantId,
      key,
      limit: 1000,
    });
    const found = versions.find((v: ConfigVersionEntity) => v.version === version);
    return found ? this.mapVersionEntityToInfo(found) : null;
  }

  // ==================== Rollback ====================

  /**
   * Rollback a config key to a specific version.
   * Creates a new version entry with the old value and updates the config entry.
   */
  async rollbackToVersion(
    tenantId: string,
    domain: string,
    key: string,
    targetVersion: number,
    rolledBackBy: string,
  ): Promise<ConfigVersionInfo> {
    // Verify the target version exists
    const targetVersionInfo = await this.getVersion(tenantId, key, targetVersion);
    if (!targetVersionInfo) {
      throw new OrionError(
        `Version ${targetVersion} not found for key '${key}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Get current config entry
    const currentEntry = await this.configRepo.findByKey(tenantId, key);
    if (!currentEntry) {
      throw new OrionError(
        `Config key '${key}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Determine the value to restore
    let restoreValue: Record<string, any>;
    try {
      restoreValue = JSON.parse(targetVersionInfo.newValue as any) as Record<string, any>;
    } catch {
      restoreValue = { value: targetVersionInfo.newValue };
    }

    // Record the rollback as a new version entry
    const currentValue = currentEntry.value as Record<string, any>;
    const rollbackComment = `Rollback to version ${targetVersion}`;

    const recorded = await this.recordVersion(
      tenantId,
      domain,
      key,
      currentValue,
      restoreValue,
      rolledBackBy,
      'update',
      rollbackComment,
    );

    // Update the config entry with the rolled-back value
    await this.configRepo.set(tenantId, key, restoreValue, rolledBackBy);

    return recorded;
  }

  // ==================== Version Comparison ====================

  /**
   * Compare two versions of a config key and return detailed differences.
   */
  async compareVersions(
    tenantId: string,
    key: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<VersionComparisonResult> {
    const fromInfo = await this.getVersion(tenantId, key, fromVersion);
    const toInfo = await this.getVersion(tenantId, key, toVersion);

    if (!fromInfo) {
      throw new OrionError(
        `Source version ${fromVersion} not found for key '${key}'`,
        ErrorCode.NOT_FOUND,
      );
    }
    if (!toInfo) {
      throw new OrionError(
        `Target version ${toVersion} not found for key '${key}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    let fromValue: Record<string, any> = {};
    let toValue: Record<string, any> = {};

    try {
      fromValue = JSON.parse(fromInfo.newValue as any) as Record<string, any>;
    } catch {
      fromValue = { value: fromInfo.newValue };
    }
    try {
      toValue = JSON.parse(toInfo.newValue as any) as Record<string, any>;
    } catch {
      toValue = { value: toInfo.newValue };
    }

    const fromKeys = new Set(Object.keys(fromValue));
    const toKeys = new Set(Object.keys(toValue));

    const addedKeys: string[] = [];
    const removedKeys: string[] = [];
    const modifiedKeys: { key: string; oldValue: any; newValue: any }[] = [];

    for (const key of toKeys) {
      if (!fromKeys.has(key)) {
        addedKeys.push(key);
      } else {
        if (JSON.stringify(fromValue[key]) !== JSON.stringify(toValue[key])) {
          modifiedKeys.push({ key, oldValue: fromValue[key], newValue: toValue[key] });
        }
      }
    }

    for (const key of fromKeys) {
      if (!toKeys.has(key)) {
        removedKeys.push(key);
      }
    }

    const totalChanges = addedKeys.length + removedKeys.length + modifiedKeys.length;
    const changeSummary = `${addedKeys.length} added, ${removedKeys.length} removed, ${modifiedKeys.length} modified`;

    return {
      configId: key,
      key,
      fromVersion,
      toVersion,
      fromValue,
      toValue,
      addedKeys,
      removedKeys,
      modifiedKeys,
      changeSummary,
      generatedAt: new Date(),
    };
  }

  // ==================== Helpers ====================

  private mapVersionEntityToInfo(entity: ConfigVersionEntity): ConfigVersionInfo {
    let oldValue: Record<string, any> | null = null;
    let newValue: Record<string, any> | null = null;

    try {
      oldValue = entity.oldValue ? JSON.parse(entity.oldValue) : null;
    } catch {
      oldValue = entity.oldValue ? { value: entity.oldValue } : null;
    }
    try {
      newValue = entity.newValue ? JSON.parse(entity.newValue) : null;
    } catch {
      newValue = entity.newValue ? { value: entity.newValue } : null;
    }

    return {
      id: entity.id,
      tenantId: entity.domain,
      domain: entity.domain,
      key: entity.key,
      version: entity.version,
      changeType: entity.changeType,
      oldValue,
      newValue,
      changedBy: entity.changedBy,
      changedAt: entity.changedAt,
      comment: entity.comment,
      checksum: entity.checksum,
    };
  }
}
