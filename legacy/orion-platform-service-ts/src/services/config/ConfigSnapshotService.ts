/**
 * ConfigSnapshotService — Business logic for config version snapshot management
 *
 * Features:
 *   - Create point-in-time snapshots of individual config entries
 *   - List and retrieve snapshots by config ID
 *   - Restore a config entry to a previously captured snapshot state
 *   - Diff two snapshots to show configuration changes
 *   - Auto-snapshot before config modifications
 *   - Cleanup old snapshots based on retention policy
 *
 * Multi-tenancy: All operations are scoped by tenantId.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import {
  ConfigSnapshotRepository,
  ConfigSnapshotEntity,
} from '../../repositories/ConfigSnapshotRepository';
import { ConfigRepository } from '../../repositories/ConfigRepository';
import { OrionError, ErrorCode } from '../../errors';
import { CacheService } from '../cache/CacheService';
import { createLogger } from '../../utils/logger';

// ==================== Types ====================

export interface ConfigSnapshotInfo {
  id: string;
  configId: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  description?: string;
  data: Record<string, any>;
  checksum: string;
}

export interface SnapshotDiffResult {
  snapshotId1: string;
  snapshotId2: string;
  added: string[];
  removed: string[];
  changed: { key: string; oldValue: any; newValue: any }[];
  changeSummary: string;
  generatedAt: Date;
}

export interface CreateSnapshotInput {
  configId?: string;
  configKey?: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface AutoSnapshotResult {
  snapshotId: string;
  configId: string;
  previousChecksum: string;
  newChecksum: string;
  createdAt: Date;
}

// ==================== Service ====================

export class ConfigSnapshotService {
  private snapshotRepo: ConfigSnapshotRepository;
  private configRepo: ConfigRepository;
  private cache: CacheService;
  private logger = createLogger('config-snapshot-service');

  constructor(
    snapshotRepo: ConfigSnapshotRepository,
    configRepo: ConfigRepository,
    cache?: CacheService,
  ) {
    this.snapshotRepo = snapshotRepo;
    this.configRepo = configRepo;
    this.cache = cache || new CacheService(null);
  }

  /**
   * Resolve a config identifier to a configId.
   * Accepts either a raw configId or a configKey (looked up by tenant).
   * Returns undefined if neither is provided or the config is not found.
   */
  async resolveConfigId(
    tenantId: string,
    configId?: string,
    configKey?: string,
  ): Promise<string | undefined> {
    if (configId) return configId;
    if (!configKey) return undefined;

    const entry = await this.configRepo.findByKey(configKey, undefined, tenantId);
    return entry?.id;
  }

  // ==================== Snapshot CRUD ====================

  /**
   * Create a snapshot of a config entry at its current state.
   * Captures the full config value as JSONB.
   * Accepts either configId or configKey to identify the target config.
   */
  async createSnapshot(
    tenantId: string,
    input: CreateSnapshotInput,
  ): Promise<ConfigSnapshotInfo> {
    if (!input.name || !input.createdBy) {
      throw new OrionError(
        'name and createdBy are required',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (!input.configId && !input.configKey) {
      throw new OrionError(
        'Either configId or configKey is required',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Resolve configId from configKey if needed
    let configId = input.configId;
    if (!configId && input.configKey) {
      const configEntry = await this.configRepo.findByKey(input.configKey, undefined, tenantId);
      if (!configEntry) {
        throw new OrionError(
          `Config with key '${input.configKey}' not found for tenant '${tenantId}'`,
          ErrorCode.NOT_FOUND,
        );
      }
      if (!configEntry.id) {
        throw new OrionError(
          `Config entry has no id: ${input.configKey}`,
          ErrorCode.NOT_FOUND,
        );
      }
      configId = configEntry.id;
    }

    // Fetch the current config entry to capture its state
    if (!configId) {
      throw new OrionError('Config ID is required', ErrorCode.VALIDATION_ERROR);
    }
    const configEntry = await this.configRepo.findById(configId);
    if (!configEntry) {
      throw new OrionError(
        `Config '${configId}' not found`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Enforce tenant isolation — the config must belong to this tenant
    if (configEntry.scopeId !== tenantId) {
      throw new OrionError(
        `Config '${configId}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    const data = configEntry.value ?? {};
    const dataStr = JSON.stringify(data);
    const checksum = createHash('sha256').update(dataStr).digest('hex');

    const entity: ConfigSnapshotEntity = {
      id: uuidv4(),
      configId: configId,
      name: input.name ?? '',
      data,
      createdBy: input.createdBy ?? '',
      createdAt: new Date(),
    };

    await this.snapshotRepo.create({
      id: entity.id,
      configId: entity.configId,
      name: entity.name,
      data: entity.data,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
    });

    // Invalidate snapshot list cache for this config
    await this.cache.del(`config:snapshots:${tenantId}:${configId}`);

    this.logger.info(
      { configId, snapshotId: entity.id, name: input.name },
      'Config snapshot created',
    );

    return {
      id: entity.id,
      configId: entity.configId,
      name: entity.name,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      description: input.description,
      data,
      checksum,
    };
  }

  /**
   * List snapshots for a specific config entry, or all snapshots for the tenant
   * when configId is not provided. Supports pagination via limit/offset.
   */
  async listSnapshots(
    tenantId: string,
    configId?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ data: ConfigSnapshotInfo[]; total: number }> {
    // Build cache key based on filter scope
    const cacheKey = configId
      ? `config:snapshots:${tenantId}:${configId}:${limit}:${offset}`
      : `config:snapshots:${tenantId}:all:${limit}:${offset}`;

    const cached = await this.cache.get<{ data: ConfigSnapshotInfo[]; total: number }>(cacheKey);
    if (cached) return cached;

    let snapshots: ConfigSnapshotEntity[];
    let total: number;

    if (configId) {
      // Scoped to a specific config — use the dedicated repository method
      snapshots = await this.snapshotRepo.findByConfigId({ configId, limit: limit + offset });
      total = snapshots.length;
      snapshots = snapshots.slice(offset, offset + limit);
    } else {
      // Global listing for the tenant — use BaseRepository.findAll with pagination
      const result = await this.snapshotRepo.findAll({
        orderBy: 'created_at',
        orderDir: 'DESC',
        limit: limit + offset,
        offset,
      });
      snapshots = result.entities;
      total = result.total;
    }

    const data: ConfigSnapshotInfo[] = snapshots.map((s) => {
      const dataStr = JSON.stringify(s.data);
      const checksum = createHash('sha256').update(dataStr).digest('hex');
      return {
        id: s.id,
        configId: s.configId,
        name: s.name,
        createdBy: s.createdBy,
        createdAt: s.createdAt,
        data: s.data,
        checksum,
      };
    });

    const result = { data, total };
    await this.cache.set(cacheKey, result, 120);
    return result;
  }

  /**
   * Get a single snapshot by ID with full data
   */
  async getSnapshot(
    tenantId: string,
    snapshotId: string,
  ): Promise<ConfigSnapshotInfo | null> {
    const snapshot = await this.snapshotRepo.findById(snapshotId);
    if (!snapshot) return null;

    // Verify tenant isolation through the associated config
    const configEntry = await this.configRepo.findById(snapshot.configId);
    if (!configEntry || configEntry.scopeId !== tenantId) {
      return null;
    }

    const dataStr = JSON.stringify(snapshot.data);
    const checksum = createHash('sha256').update(dataStr).digest('hex');

    return {
      id: snapshot.id,
      configId: snapshot.configId,
      name: snapshot.name,
      createdBy: snapshot.createdBy,
      createdAt: snapshot.createdAt,
      data: snapshot.data,
      checksum,
    };
  }

  /**
   * Restore a config entry to the state captured in a snapshot.
   * Overwrites the current config value with the snapshot data.
   */
  async restoreSnapshot(
    tenantId: string,
    snapshotId: string,
    restoredBy: string,
  ): Promise<{ restoredCount: number; configKeys: string[] }> {
    const snapshot = await this.snapshotRepo.findById(snapshotId);
    if (!snapshot) {
      throw new OrionError(
        `Snapshot '${snapshotId}' not found`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Verify tenant isolation
    const configEntry = await this.configRepo.findById(snapshot.configId);
    if (!configEntry || configEntry.scopeId !== tenantId) {
      throw new OrionError(
        `Snapshot '${snapshotId}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Update the config entry with the snapshot data
    await this.configRepo.updateValue(snapshot.configId, snapshot.data, restoredBy);

    // Invalidate caches
    await this.cache.del(`config:snapshots:${tenantId}:${snapshot.configId}:*`);
    await this.cache.del(`config:entry:${tenantId}:${configEntry.key}`);

    const configKeys = Object.keys(snapshot.data);

    this.logger.info(
      { tenantId, snapshotId, configId: snapshot.configId, restoredCount: configKeys.length },
      'Config snapshot restored successfully',
    );

    return { restoredCount: configKeys.length, configKeys };
  }

  /**
   * Delete a snapshot by ID with tenant isolation check.
   * Returns true if the snapshot was found and deleted.
   */
  async deleteSnapshot(
    tenantId: string,
    snapshotId: string,
  ): Promise<boolean> {
    const snapshot = await this.snapshotRepo.findById(snapshotId);
    if (!snapshot) {
      return false;
    }

    // Verify tenant isolation through the associated config
    const configEntry = await this.configRepo.findById(snapshot.configId);
    if (!configEntry || configEntry.scopeId !== tenantId) {
      return false;
    }

    const deleted = await this.snapshotRepo.delete(snapshotId);

    // Invalidate caches
    await this.cache.del(`config:snapshots:${tenantId}:${snapshot.configId}:*`);

    this.logger.info(
      { tenantId, snapshotId, configId: snapshot.configId },
      'Config snapshot deleted',
    );

    return deleted;
  }

  /**
   * Compare two snapshots and return the detailed diff
   */
  async diffSnapshots(
    tenantId: string,
    snapshotId1: string,
    snapshotId2: string,
  ): Promise<SnapshotDiffResult> {
    const [s1, s2] = await Promise.all([
      this.getSnapshot(tenantId, snapshotId1),
      this.getSnapshot(tenantId, snapshotId2),
    ]);

    if (!s1) {
      throw new OrionError(
        `Snapshot '${snapshotId1}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }
    if (!s2) {
      throw new OrionError(
        `Snapshot '${snapshotId2}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Ensure both snapshots belong to the same config
    if (s1.configId !== s2.configId) {
      throw new OrionError(
        `Cannot diff snapshots from different configs: '${s1.configId}' vs '${s2.configId}'`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const baseObj = s1.data;
    const targetObj = s2.data;

    const added = Object.keys(targetObj).filter(k => !(k in baseObj));
    const removed = Object.keys(baseObj).filter(k => !(k in targetObj));
    const changed = Object.keys(targetObj)
      .filter(k => k in baseObj && JSON.stringify(baseObj[k]) !== JSON.stringify(targetObj[k]))
      .map(k => ({ key: k, oldValue: baseObj[k], newValue: targetObj[k] }));

    const changeSummary =
      `${added.length} added, ${removed.length} removed, ${changed.length} modified`;

    return {
      snapshotId1: s1.id,
      snapshotId2: s2.id,
      added,
      removed,
      changed,
      changeSummary,
      generatedAt: new Date(),
    };
  }

  // ==================== Auto-Snapshot & Cleanup ====================

  /**
   * Automatically create a snapshot before a config change.
   * Returns the snapshot info or null if the config doesn't exist.
   */
  async autoSnapshot(
    tenantId: string,
    configId: string,
  ): Promise<AutoSnapshotResult | null> {
    const configEntry = await this.configRepo.findById(configId);
    if (!configEntry || configEntry.scopeId !== tenantId) {
      return null;
    }

    const dataStr = JSON.stringify(configEntry.value);
    const newChecksum = createHash('sha256').update(dataStr).digest('hex');

    // Check if a snapshot with the same checksum already exists (avoid duplicates)
    const existingSnapshots = await this.snapshotRepo.findByConfigId({ configId, limit: 1 });
    const previousChecksum = existingSnapshots.length > 0
      ? createHash('sha256').update(JSON.stringify(existingSnapshots[0].data)).digest('hex')
      : '';

    // Only create snapshot if data has changed since last snapshot
    if (previousChecksum === newChecksum) {
      this.logger.debug(
        { configId, checksum: newChecksum },
        'Auto-snapshot skipped — data unchanged since last snapshot',
      );
      return null;
    }

    const snapshotName = `auto-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const entity: ConfigSnapshotEntity = {
      id: uuidv4(),
      configId,
      name: snapshotName,
      data: configEntry.value,
      createdBy: 'system',
      createdAt: new Date(),
    };

    await this.snapshotRepo.create({
      id: entity.id,
      configId: entity.configId,
      name: entity.name,
      data: entity.data,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
    });

    await this.cache.del(`config:snapshots:${tenantId}:${configId}:*`);

    this.logger.info(
      { configId, snapshotId: entity.id, previousChecksum, newChecksum },
      'Auto-snapshot created before config change',
    );

    return {
      snapshotId: entity.id,
      configId: entity.configId,
      previousChecksum,
      newChecksum,
      createdAt: entity.createdAt,
    };
  }

  /**
   * Remove snapshots older than retentionDays for a specific config.
   * Returns the number of snapshots deleted.
   */
  async cleanupOldSnapshots(
    tenantId: string,
    configId: string,
    retentionDays: number,
  ): Promise<number> {
    // Verify config exists and belongs to tenant
    const configEntry = await this.configRepo.findById(configId);
    if (!configEntry || configEntry.scopeId !== tenantId) {
      throw new OrionError(
        `Config '${configId}' not found for tenant '${tenantId}'`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Get snapshots older than retention period
    const allSnapshots = await this.snapshotRepo.findByConfigId({ configId, limit: 1000 });
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;
    for (const snapshot of allSnapshots) {
      if (snapshot.createdAt < cutoffDate) {
        await this.snapshotRepo.delete(snapshot.id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await this.cache.del(`config:snapshots:${tenantId}:${configId}:*`);
      this.logger.info(
        { configId, tenantId, deletedCount, retentionDays },
        'Old config snapshots cleaned up',
      );
    }

    return deletedCount;
  }
}
