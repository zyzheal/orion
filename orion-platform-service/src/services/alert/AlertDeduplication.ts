/**
 * AlertDeduplication - 告警去重服务
 *
 * 功能：
 * - 告警指纹生成
 * - 重复告警检测
 * - 告警合并策略
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import pino from 'pino';
import {
  Alert,
  AlertFingerprint,
  AlertGroup,
  DeduplicationConfig,
  AlertStatus,
} from './AlertTypes';
import { AlertDeduplicationGroupRepository, AlertDeduplicationGroupEntity } from '../../repositories/AlertDeduplicationGroupRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 告警去重服务
 */
export class AlertDeduplication {
  private config: DeduplicationConfig;
  private dedupGroupRepository?: AlertDeduplicationGroupRepository;
  // In-memory fallback for alert groups
  private alertGroupsMemory: Map<string, AlertGroup> = new Map();
  // Fingerprint cache is ephemeral TTL cache - stays in-memory
  private fingerprintCache: Map<string, { fingerprint: string; expiresAt: Date }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    config?: Partial<DeduplicationConfig>,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.config = {
      deduplicationWindowMs: config?.deduplicationWindowMs || 4 * 60 * 60 * 1000, // 默认4小时
      maxGroupSize: config?.maxGroupSize || 100,
      aggregationIntervalMs: config?.aggregationIntervalMs || 60 * 1000, // 默认1分钟
      ...config,
    };
    if (db) {
      this.dedupGroupRepository = new AlertDeduplicationGroupRepository(db);
    }
  }

  /**
   * 启动服务
   */
  start(): void {
    // 启动清理定时器
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.aggregationIntervalMs);

    logger.info('AlertDeduplication service started');
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.alertGroupsMemory.clear();
    this.fingerprintCache.clear();

    logger.info('AlertDeduplication service stopped');
  }

  /**
   * 生成告警指纹
   */
  generateFingerprint(alert: Partial<Alert>): AlertFingerprint {
    // 标签排序后序列化
    const labels = alert.labels || {};
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((k) => `${k}="${labels[k]}"`)
      .join(',');

    // 计算各部分哈希
    const labelsHash = crypto
      .createHash('sha256')
      .update(sortedLabels)
      .digest('hex')
      .substring(0, 16);

    const nameHash = crypto
      .createHash('sha256')
      .update(alert.name || '')
      .digest('hex')
      .substring(0, 16);

    const sourceHash = crypto
      .createHash('sha256')
      .update(`${alert.sourceType}:${alert.sourceId}`)
      .digest('hex')
      .substring(0, 16);

    // 组合生成完整指纹
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${nameHash}:${labelsHash}:${sourceHash}`)
      .digest('hex')
      .substring(0, 32);

    return {
      fingerprint,
      labelsHash,
      nameHash,
      sourceHash,
    };
  }

  /**
   * 检测重复告警
   */
  isDuplicate(fingerprint: string): boolean {
    const cached = this.fingerprintCache.get(fingerprint);
    if (!cached) {
      return false;
    }

    // 检查是否在去重窗口内
    return new Date() < cached.expiresAt;
  }

  /**
   * 记录告警指纹
   */
  recordFingerprint(fingerprint: string): void {
    const expiresAt = new Date(Date.now() + this.config.deduplicationWindowMs);
    this.fingerprintCache.set(fingerprint, { fingerprint, expiresAt });
  }

  /**
   * 处理告警去重
   * 返回：是否为重复告警、告警分组信息
   */
  async processAlert(alert: Alert): Promise<{
    isDuplicate: boolean;
    group: AlertGroup;
    action: 'create' | 'update' | 'suppress';
  }> {
    const fingerprint = alert.fingerprint || this.generateFingerprint(alert).fingerprint;

    // 检查是否重复
    const isDuplicate = this.isDuplicate(fingerprint);

    // 获取或创建分组
    let group = await this.getAlertGroup(fingerprint);
    let action: 'create' | 'update' | 'suppress';

    if (!group) {
      // 创建新分组
      group = {
        fingerprint,
        alerts: [alert],
        count: 1,
        firstOccurrence: alert.startsAt,
        lastOccurrence: alert.startsAt,
        suppressed: false,
      };
      await this.saveGroup(group);
      action = 'create';

      // 记录指纹
      this.recordFingerprint(fingerprint);
    } else {
      // 更新已有分组
      group.alerts.push(alert);
      group.count++;
      group.lastOccurrence = alert.startsAt;

      // 检查分组大小限制
      if (group.alerts.length > this.config.maxGroupSize) {
        group.alerts = group.alerts.slice(-this.config.maxGroupSize);
      }

      action = isDuplicate ? 'suppress' : 'update';

      // 更新持久化
      await this.updateGroup(group);

      // 更新指纹过期时间
      this.recordFingerprint(fingerprint);
    }

    return {
      isDuplicate,
      group,
      action,
    };
  }

  /**
   * 合并告警分组
   * 将多个相同指纹的告警合并为一个摘要
   */
  async mergeAlerts(fingerprint: string): Promise<AlertGroup | null> {
    const group = await this.getAlertGroup(fingerprint);
    if (!group || group.alerts.length === 0) {
      return null;
    }
    return group;
  }

  /**
   * 获取告警分组
   */
  async getAlertGroup(fingerprint: string): Promise<AlertGroup | undefined> {
    if (this.dedupGroupRepository) {
      const entity = await this.dedupGroupRepository.findByFingerprint(fingerprint);
      return entity ? this.entityToGroup(entity) : undefined;
    }
    return this.alertGroupsMemory.get(fingerprint);
  }

  /**
   * 获取所有活跃告警分组
   */
  async getActiveGroups(options?: {
    minCount?: number;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AlertGroup[]> {
    if (this.dedupGroupRepository) {
      const entities = await this.dedupGroupRepository.findActive(
        options?.minCount,
        options?.startTime,
        options?.endTime,
        options?.limit || 100,
        options?.offset || 0,
      );
      return entities.map(e => this.entityToGroup(e));
    }

    let groups = Array.from(this.alertGroupsMemory.values());

    if (options?.minCount) {
      groups = groups.filter((g) => g.count >= options.minCount!);
    }
    if (options?.startTime) {
      groups = groups.filter((g) => g.lastOccurrence >= options.startTime!);
    }
    if (options?.endTime) {
      groups = groups.filter((g) => g.firstOccurrence <= options.endTime!);
    }

    groups.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return groups.slice(offset, offset + limit);
  }

  /**
   * 获取统计数据
   */
  async getStats(): Promise<{
    totalGroups: number;
    totalAlerts: number;
    suppressedAlerts: number;
    topFingerprints: Array<{ fingerprint: string; count: number }>;
  }> {
    if (this.dedupGroupRepository) {
      const stats = await this.dedupGroupRepository.getStats();
      const topFingerprints = await this.dedupGroupRepository.getTopFingerprints(10);
      return {
        totalGroups: stats.totalGroups,
        totalAlerts: stats.totalAlerts,
        suppressedAlerts: 0, // Would need a separate query
        topFingerprints,
      };
    }

    let totalAlerts = 0;
    let suppressedAlerts = 0;
    const fingerprints: Array<{ fingerprint: string; count: number }> = [];

    for (const group of this.alertGroupsMemory.values()) {
      totalAlerts += group.count;
      if (group.suppressed) {
        suppressedAlerts += group.count;
      }
      fingerprints.push({ fingerprint: group.fingerprint, count: group.count });
    }

    fingerprints.sort((a, b) => b.count - a.count);

    return {
      totalGroups: this.alertGroupsMemory.size,
      totalAlerts,
      suppressedAlerts,
      topFingerprints: fingerprints.slice(0, 10),
    };
  }

  /**
   * 清理过期数据
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let cleanedFingerprints = 0;
    let cleanedGroups = 0;

    // 清理指纹缓存 (always in-memory)
    for (const [fingerprint, data] of this.fingerprintCache.entries()) {
      if (data.expiresAt < now) {
        this.fingerprintCache.delete(fingerprint);
        cleanedFingerprints++;
      }
    }

    // 清理告警分组（保留最近24小时的）
    const groupExpiryTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (this.dedupGroupRepository) {
      cleanedGroups = await this.dedupGroupRepository.deleteExpired(groupExpiryTime);
    } else {
      for (const [fingerprint, group] of this.alertGroupsMemory.entries()) {
        if (group.lastOccurrence < groupExpiryTime) {
          this.alertGroupsMemory.delete(fingerprint);
          cleanedGroups++;
        }
      }
    }

    if (cleanedFingerprints > 0 || cleanedGroups > 0) {
      const remaining = this.dedupGroupRepository
        ? (await this.dedupGroupRepository.getStats()).totalGroups
        : this.alertGroupsMemory.size;
      logger.info(
        { cleanedFingerprints, cleanedGroups, remainingGroups: remaining },
        'AlertDeduplication cleanup completed'
      );
    }
  }

  /**
   * 清除所有数据（用于测试）
   */
  clearAll(): void {
    this.alertGroupsMemory.clear();
    this.fingerprintCache.clear();
  }

  /**
   * 批量处理告警
   */
  async batchProcess(alerts: Alert[]): Promise<{
    duplicates: number;
    newAlerts: number;
    suppressed: number;
    groups: AlertGroup[];
  }> {
    let duplicates = 0;
    let newAlerts = 0;
    let suppressed = 0;
    const groups: AlertGroup[] = [];

    for (const alert of alerts) {
      const result = await this.processAlert(alert);

      if (result.isDuplicate) {
        duplicates++;
        if (result.action === 'suppress') {
          suppressed++;
        }
      } else {
        newAlerts++;
      }

      groups.push(result.group);
    }

    return {
      duplicates,
      newAlerts,
      suppressed,
      groups,
    };
  }

  // ==================== Repository Helper Methods ====================

  /**
   * Save a group to repository or memory
   */
  private async saveGroup(group: AlertGroup): Promise<void> {
    if (this.dedupGroupRepository) {
      try {
        await this.dedupGroupRepository.create({
          id: group.fingerprint,
          tenantId: 'default',
          alerts: group.alerts as any,
          count: group.count,
          firstOccurrence: group.firstOccurrence,
          lastOccurrence: group.lastOccurrence,
          suppressed: group.suppressed,
          suppressionReason: group.suppressionReason ?? null,
        } as any);
      } catch (err) {
        logger.warn({ err, fingerprint: group.fingerprint }, 'Failed to persist dedup group, using memory');
        this.alertGroupsMemory.set(group.fingerprint, group);
      }
    } else {
      this.alertGroupsMemory.set(group.fingerprint, group);
    }
  }

  /**
   * Update a group in repository or memory
   */
  private async updateGroup(group: AlertGroup): Promise<void> {
    if (this.dedupGroupRepository) {
      try {
        await this.dedupGroupRepository.update(group.fingerprint, {
          alerts: group.alerts as any,
          count: group.count,
          lastOccurrence: group.lastOccurrence,
          suppressed: group.suppressed,
          suppressionReason: group.suppressionReason ?? null,
        } as any);
      } catch (err) {
        logger.warn({ err, fingerprint: group.fingerprint }, 'Failed to update dedup group in repository');
        this.alertGroupsMemory.set(group.fingerprint, group);
      }
    } else {
      this.alertGroupsMemory.set(group.fingerprint, group);
    }
  }

  /**
   * Convert repository entity to AlertGroup
   */
  private entityToGroup(entity: AlertDeduplicationGroupEntity): AlertGroup {
    return {
      fingerprint: entity.id,
      alerts: entity.alerts as unknown as Alert[],
      count: entity.count,
      firstOccurrence: entity.firstOccurrence,
      lastOccurrence: entity.lastOccurrence,
      suppressed: entity.suppressed,
      suppressionReason: entity.suppressionReason ?? undefined,
    };
  }
}