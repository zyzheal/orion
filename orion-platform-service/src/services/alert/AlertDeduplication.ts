/**
 * AlertDeduplication - 告警去重服务
 *
 * 功能：
 * - 告警指纹生成
 * - 重复告警检测
 * - 告警合并策略
 *
 * 持久化：使用 AlertDeduplicationGroupRepository (PostgreSQL) 存储告警分组
 * 内存缓存：fingerprintCache 是 ephemeral TTL 缓存，仅用于快速去重检测
 */

import crypto from 'crypto';
import pino from 'pino';
import {
  Alert,
  AlertFingerprint,
  AlertGroup,
  DeduplicationConfig,
} from './AlertTypes';
import { AlertDeduplicationGroupRepository, AlertDeduplicationGroupEntity } from '../../repositories/AlertDeduplicationGroupRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 告警去重服务
 *
 * 所有告警分组数据通过 PostgreSQL Repository 持久化。
 * fingerprintCache 是 ephemeral TTL 缓存，仅用于快速去重检测，不持久化。
 */
export class AlertDeduplication {
  private config: DeduplicationConfig;
  private dedupGroupRepository: AlertDeduplicationGroupRepository;
  // Fingerprint cache is ephemeral TTL cache - stays in-memory for fast dedup lookup
  private fingerprintCache: Map<string, { fingerprint: string; expiresAt: Date }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    config?: Partial<DeduplicationConfig>,
  ) {
    this.config = {
      deduplicationWindowMs: config?.deduplicationWindowMs || 4 * 60 * 60 * 1000, // 默认4小时
      maxGroupSize: config?.maxGroupSize || 100,
      aggregationIntervalMs: config?.aggregationIntervalMs || 60 * 1000, // 默认1分钟
      ...config,
    };
    this.dedupGroupRepository = new AlertDeduplicationGroupRepository(db);
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
   * 检测重复告警（基于内存 TTL 缓存）
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
   * 记录告警指纹到内存 TTL 缓存
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
   * 获取告警分组（从 PostgreSQL）
   */
  async getAlertGroup(fingerprint: string): Promise<AlertGroup | undefined> {
    const entity = await this.dedupGroupRepository.findByFingerprint(fingerprint);
    return entity ? this.entityToGroup(entity) : undefined;
  }

  /**
   * 获取所有活跃告警分组（从 PostgreSQL）
   */
  async getActiveGroups(options?: {
    minCount?: number;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AlertGroup[]> {
    const entities = await this.dedupGroupRepository.findActive(
      options?.minCount,
      options?.startTime,
      options?.endTime,
      options?.limit || 100,
      options?.offset || 0,
    );
    return entities.map(e => this.entityToGroup(e));
  }

  /**
   * 获取统计数据（从 PostgreSQL）
   */
  async getStats(): Promise<{
    totalGroups: number;
    totalAlerts: number;
    suppressedAlerts: number;
    topFingerprints: Array<{ fingerprint: string; count: number }>;
  }> {
    const stats = await this.dedupGroupRepository.getStats();
    const topFingerprints = await this.dedupGroupRepository.getTopFingerprints(10);
    return {
      totalGroups: stats.totalGroups,
      totalAlerts: stats.totalAlerts,
      suppressedAlerts: 0, // Would need a separate query
      topFingerprints,
    };
  }

  /**
   * 清理过期数据
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let cleanedFingerprints = 0;

    // 清理指纹缓存 (always in-memory TTL cache)
    for (const [fingerprint, data] of this.fingerprintCache.entries()) {
      if (data.expiresAt < now) {
        this.fingerprintCache.delete(fingerprint);
        cleanedFingerprints++;
      }
    }

    // 清理过期告警分组（保留最近24小时的），通过 PostgreSQL 删除
    const groupExpiryTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cleanedGroups = await this.dedupGroupRepository.deleteExpired(groupExpiryTime);

    if (cleanedFingerprints > 0 || cleanedGroups > 0) {
      const remaining = (await this.dedupGroupRepository.getStats()).totalGroups;
      logger.info(
        { cleanedFingerprints, cleanedGroups, remainingGroups: remaining },
        'AlertDeduplication cleanup completed'
      );
    }
  }

  /**
   * 清除所有数据（用于测试）
   */
  async clearAll(): Promise<void> {
    this.fingerprintCache.clear();
    // Delete all groups from PostgreSQL
    const stats = await this.dedupGroupRepository.getStats();
    if (stats.totalGroups > 0) {
      // Use a far-past date to delete all groups
      await this.dedupGroupRepository.deleteExpired(new Date(Date.now() + 24 * 60 * 60 * 1000));
    }
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
   * Save a group to PostgreSQL repository
   */
  private async saveGroup(group: AlertGroup): Promise<void> {
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
      logger.error({ traceId: getCurrentTraceId(), err, fingerprint: group.fingerprint }, 'Failed to persist dedup group');
      throw err;
    }
  }

  /**
   * Update a group in PostgreSQL repository
   */
  private async updateGroup(group: AlertGroup): Promise<void> {
    try {
      await this.dedupGroupRepository.update(group.fingerprint, {
        alerts: group.alerts as any,
        count: group.count,
        lastOccurrence: group.lastOccurrence,
        suppressed: group.suppressed,
        suppressionReason: group.suppressionReason ?? null,
      } as any);
    } catch (err) {
      logger.error({ traceId: getCurrentTraceId(), err, fingerprint: group.fingerprint }, 'Failed to update dedup group in repository');
      throw err;
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
