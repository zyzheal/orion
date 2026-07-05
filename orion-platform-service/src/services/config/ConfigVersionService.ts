/**
 * Configuration Version Management Service
 *
 * 配置版本管理 - 支持变更追踪与回滚
 */

import { createLogger } from '../../utils/logger';
import { ConfigVersionRepository } from '../../repositories/ConfigVersionRepository';
import { OrionError, ErrorCode } from '../../errors';
import crypto from 'crypto';

const logger = createLogger('ConfigVersionService');

// ==================== 版本记录 ====================

export interface ConfigVersion {
  id: string;
  domain: string;
  key: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: Date;
  changeType: 'create' | 'update' | 'delete';
  version: number;
  comment?: string;
  checksum: string;
}

// ==================== 快照记录 ====================

export interface ConfigSnapshot {
  id: string;
  snapshotName: string;
  createdBy: string;
  createdAt: Date;
  configData: Record<string, any>;
  checksum: string;
  description?: string;
}

// ==================== 版本服务 ====================

export class ConfigVersionService {
  constructor(private repo: ConfigVersionRepository, private tenantId: string) {}

  /**
   * 记录配置变更
   */
  async recordChange(
    domain: string,
    key: string,
    oldValue: any,
    newValue: any,
    changedBy: string,
    changeType: 'create' | 'update' | 'delete',
    comment?: string
  ): Promise<ConfigVersion> {
    const version = await this.repo.getMaxVersion(domain, key);
    const nextVersion = version + 1;
    const checksum = this.calculateChecksum(newValue);

    const id = this.generateId();
    await this.repo.insertVersion({
      id,
      domain,
      key,
      oldValue: JSON.stringify(oldValue ?? {}),
      newValue: JSON.stringify(newValue ?? {}),
      changedBy,
      changedAt: new Date(),
      changeType,
      version: nextVersion,
      comment,
      checksum,
    });

    logger.info({ domain, key, version: nextVersion }, 'Config change recorded');

    return {
      id,
      domain,
      key,
      oldValue,
      newValue,
      changedBy,
      changedAt: new Date(),
      changeType,
      version: nextVersion,
      comment,
      checksum,
    };
  }

  /**
   * 获取配置变更历史
   */
  async getHistory(
    domain?: string,
    key?: string,
    limit: number = 50
  ): Promise<ConfigVersion[]> {
    const entities = await this.repo.findVersions({ domain, key, limit });
    return entities.map(this.mapEntityToVersion);
  }

  /**
   * 回滚到指定版本
   */
  async rollback(
    domain: string,
    key: string,
    targetVersion: number,
    rolledBackBy: string,
    reason?: string
  ): Promise<ConfigVersion> {
    const history = await this.getHistory(domain, key, targetVersion);
    const targetRecord = history.find(v => v.version === targetVersion);

    if (!targetRecord) {
      throw new OrionError(`Version ${targetVersion} not found for ${domain}.${key}`, ErrorCode.NOT_FOUND);
    }

    const rollbackRecord = await this.recordChange(
      domain,
      key,
      targetRecord.newValue,
      targetRecord.oldValue,
      rolledBackBy,
      'update',
      `Rollback to version ${targetVersion}. Reason: ${reason || 'N/A'}`
    );

    logger.info({ domain, key, targetVersion }, 'Config rolled back');
    return rollbackRecord;
  }

  /**
   * 创建配置快照
   */
  async createSnapshot(
    name: string,
    configData: Record<string, any>,
    createdBy: string,
    description?: string
  ): Promise<ConfigSnapshot> {
    const snapshot: ConfigSnapshot = {
      id: this.generateId(),
      snapshotName: name,
      createdBy,
      createdAt: new Date(),
      configData,
      checksum: this.calculateChecksum(configData),
      description,
    };

    await this.repo.insertSnapshot({
      id: snapshot.id,
      tenantId: this.tenantId,
      snapshotName: name,
      createdBy,
      createdAt: snapshot.createdAt,
      configData: JSON.stringify(configData),
      checksum: snapshot.checksum,
      description,
    });

    logger.info({ name, id: snapshot.id }, 'Config snapshot created');
    return snapshot;
  }

  /**
   * 恢复快照
   */
  async restoreSnapshot(
    snapshotId: string,
    _restoredBy: string
  ): Promise<ConfigSnapshot> {
    const entity = await this.repo.findSnapshotById(snapshotId, this.tenantId);

    if (!entity) {
      throw new OrionError(`Snapshot ${snapshotId} not found`, ErrorCode.NOT_FOUND);
    }

    return this.mapEntityToSnapshot(entity);
  }

  /**
   * 列出快照
   */
  async listSnapshots(limit: number = 20): Promise<ConfigSnapshot[]> {
    const entities = await this.repo.findSnapshots({ tenantId: this.tenantId, limit });
    return entities.map(this.mapEntityToSnapshot);
  }

  /**
  /**
   * 比较两个版本之间的配置差异
   *
   * 以 version1Id 变更后的 newValue 为基线，对比 version2Id 变更后的 newValue，
   * 返回 added / removed / changed 三个维度的差异。
   */
  async diff(version1Id: string, version2Id: string): Promise<{
    added: string[];
    removed: string[];
    changed: { key: string; old: any; new: any }[];
  }> {
    const [v1, v2] = await Promise.all([
      this.repo.findVersionById(version1Id),
      this.repo.findVersionById(version2Id),
    ]);

    if (!v1 || !v2) {
      throw new OrionError('Version not found', ErrorCode.NOT_FOUND);
    }

    // v1.newValue 是版本 1 变更后的配置状态（基线）
    // v2.newValue 是版本 2 变更后的配置状态（目标）
    const baseObj = JSON.parse(v1.newValue);
    const targetObj = JSON.parse(v2.newValue);

    const added = Object.keys(targetObj).filter(k => !(k in baseObj));
    const removed = Object.keys(baseObj).filter(k => !(k in targetObj));
    const changed = Object.keys(targetObj)
      .filter(k => k in baseObj && baseObj[k] !== targetObj[k])
      .map(k => ({ key: k, old: baseObj[k], new: targetObj[k] }));

    return { added, removed, changed };
  }

  // ==================== 私有方法 ====================

  private generateId(): string {
    return `cfg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  private mapEntityToVersion(entity: { id: string; domain: string; key: string; oldValue: string; newValue: string; changedBy: string; changedAt: Date; changeType: string; version: number; comment?: string; checksum: string }): ConfigVersion {
    return {
      id: entity.id,
      domain: entity.domain,
      key: entity.key,
      oldValue: JSON.parse(entity.oldValue || '{}'),
      newValue: JSON.parse(entity.newValue || '{}'),
      changedBy: entity.changedBy,
      changedAt: entity.changedAt,
      changeType: entity.changeType as ConfigVersion['changeType'],
      version: entity.version,
      comment: entity.comment,
      checksum: entity.checksum,
    };
  }

  private mapEntityToSnapshot(entity: { id: string; snapshotName: string; createdBy: string; createdAt: Date; configData: string; checksum: string; description?: string }): ConfigSnapshot {
    return {
      id: entity.id,
      snapshotName: entity.snapshotName,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      configData: JSON.parse(entity.configData || '{}'),
      checksum: entity.checksum,
      description: entity.description,
    };
  }
}

export default ConfigVersionService;