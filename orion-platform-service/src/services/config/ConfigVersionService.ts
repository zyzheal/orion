/**
 * Configuration Version Management Service
 * 
 * 配置版本管理 - 支持变更追踪与回滚
 */

import pino from 'pino';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ name: 'ConfigVersionService' });

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
  constructor(private pool: DatabasePool) {}

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
    const version = await this.getNextVersion(domain, key);
    const checksum = this.calculateChecksum(newValue);
    
    const record: ConfigVersion = {
      id: this.generateId(),
      domain,
      key,
      oldValue,
      newValue,
      changedBy,
      changedAt: new Date(),
      changeType,
      version,
      comment,
      checksum,
    };

    await this.pool.query(
      `INSERT INTO config_versions 
       (id, domain, key, old_value, new_value, changed_by, change_type, version, comment, checksum, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.id,
        record.domain,
        record.key,
        JSON.stringify(record.oldValue),
        JSON.stringify(record.newValue),
        record.changedBy,
        record.changeType,
        record.version,
        record.comment,
        record.checksum,
        record.changedAt,
      ]
    );

    logger.info({ domain, key, version }, 'Config change recorded');
    return record;
  }

  /**
   * 获取配置变更历史
   */
  async getHistory(
    domain?: string,
    key?: string,
    limit: number = 50
  ): Promise<ConfigVersion[]> {
    let query = 'SELECT * FROM config_versions';
    const params: any[] = [];
    const conditions: string[] = [];

    if (domain) {
      conditions.push(`domain = $${params.length + 1}`);
      params.push(domain);
    }
    if (key) {
      conditions.push(`key = $${params.length + 1}`);
      params.push(key);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY changed_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows.map(this.mapRowToVersion);
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

    // 记录回滚操作
    const rollbackRecord = await this.recordChange(
      domain,
      key,
      targetRecord.newValue,  // 当前值
      targetRecord.oldValue,  // 回滚到旧值
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

    await this.pool.query(
      `INSERT INTO config_snapshots 
       (id, snapshot_name, created_by, config_data, checksum, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        snapshot.id,
        snapshot.snapshotName,
        snapshot.createdBy,
        JSON.stringify(snapshot.configData),
        snapshot.checksum,
        snapshot.description,
        snapshot.createdAt,
      ]
    );

    logger.info({ name, id: snapshot.id }, 'Config snapshot created');
    return snapshot;
  }

  /**
   * 恢复快照
   */
  async restoreSnapshot(
    snapshotId: string,
    restoredBy: string
  ): Promise<ConfigSnapshot> {
    const result = await this.pool.query(
      'SELECT * FROM config_snapshots WHERE id = $1',
      [snapshotId]
    );

    if (result.rows.length === 0) {
      throw new OrionError(`Snapshot ${snapshotId} not found`, ErrorCode.NOT_FOUND);
    }

    const snapshot = this.mapRowToSnapshot(result.rows[0]);
    
    logger.info({ snapshotId }, 'Snapshot restored');
    return snapshot;
  }

  /**
   * 列出快照
   */
  async listSnapshots(limit: number = 20): Promise<ConfigSnapshot[]> {
    const result = await this.pool.query(
      'SELECT * FROM config_snapshots ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(this.mapRowToSnapshot);
  }

  /**
   * 比较两个版本差异
   */
  async diff(version1Id: string, version2Id: string): Promise<{
    added: string[];
    removed: string[];
    changed: { key: string; old: any; new: any }[];
  }> {
    const [v1, v2] = await Promise.all([
      this.pool.query('SELECT * FROM config_versions WHERE id = $1', [version1Id]),
      this.pool.query('SELECT * FROM config_versions WHERE id = $1', [version2Id]),
    ]);

    if (v1.rows.length === 0 || v2.rows.length === 0) {
      throw new OrionError('Version not found', ErrorCode.NOT_FOUND);
    }

    const oldObj = v1.rows[0].new_value;
    const newObj = v2.rows[0].new_value;

    const added = Object.keys(newObj).filter(k => !oldObj[k]);
    const removed = Object.keys(oldObj).filter(k => !newObj[k]);
    const changed = Object.keys(newObj)
      .filter(k => oldObj[k] && oldObj[k] !== newObj[k])
      .map(k => ({ key: k, old: oldObj[k], new: newObj[k] }));

    return { added, removed, changed };
  }

  // ==================== 私有方法 ====================

  private async getNextVersion(domain: string, key: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT MAX(version) as max_version FROM config_versions WHERE domain = $1 AND key = $2',
      [domain, key]
    );
    return (result.rows[0]?.max_version || 0) + 1;
  }

  private generateId(): string {
    return `cfg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(data: any): string {
    const crypto = require('crypto');
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  private mapRowToVersion(row: any): ConfigVersion {
    return {
      id: row.id,
      domain: row.domain,
      key: row.key,
      oldValue: JSON.parse(row.old_value || '{}'),
      newValue: JSON.parse(row.new_value || '{}'),
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      changeType: row.change_type,
      version: row.version,
      comment: row.comment,
      checksum: row.checksum,
    };
  }

  private mapRowToSnapshot(row: any): ConfigSnapshot {
    return {
      id: row.id,
      snapshotName: row.snapshot_name,
      createdBy: row.created_by,
      createdAt: row.created_at,
      configData: JSON.parse(row.config_data || '{}'),
      checksum: row.checksum,
      description: row.description,
    };
  }
}

export default ConfigVersionService;