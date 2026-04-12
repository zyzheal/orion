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

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 告警去重服务
 */
export class AlertDeduplication {
  private config: DeduplicationConfig;
  private alertGroups: Map<string, AlertGroup> = new Map();
  private fingerprintCache: Map<string, { fingerprint: string; expiresAt: Date }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = {
      deduplicationWindowMs: config?.deduplicationWindowMs || 4 * 60 * 60 * 1000, // 默认4小时
      maxGroupSize: config?.maxGroupSize || 100,
      aggregationIntervalMs: config?.aggregationIntervalMs || 60 * 1000, // 默认1分钟
      ...config,
    };
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

    this.alertGroups.clear();
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
  processAlert(alert: Alert): {
    isDuplicate: boolean;
    group: AlertGroup;
    action: 'create' | 'update' | 'suppress';
  } {
    const fingerprint = alert.fingerprint || this.generateFingerprint(alert).fingerprint;

    // 检查是否重复
    const isDuplicate = this.isDuplicate(fingerprint);

    // 获取或创建分组
    let group = this.alertGroups.get(fingerprint);
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
      this.alertGroups.set(fingerprint, group);
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
  mergeAlerts(fingerprint: string): AlertGroup | null {
    const group = this.alertGroups.get(fingerprint);
    if (!group || group.alerts.length === 0) {
      return null;
    }

    // 已在 processAlert 中合并，这里只是获取结果
    return group;
  }

  /**
   * 获取告警分组
   */
  getAlertGroup(fingerprint: string): AlertGroup | undefined {
    return this.alertGroups.get(fingerprint);
  }

  /**
   * 获取所有活跃告警分组
   */
  getActiveGroups(options?: {
    minCount?: number;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }): AlertGroup[] {
    let groups = Array.from(this.alertGroups.values());

    // 过滤
    if (options?.minCount) {
      groups = groups.filter((g) => g.count >= options.minCount!);
    }

    if (options?.startTime) {
      groups = groups.filter((g) => g.lastOccurrence >= options.startTime!);
    }

    if (options?.endTime) {
      groups = groups.filter((g) => g.firstOccurrence <= options.endTime!);
    }

    // 排序：按最后出现时间降序
    groups.sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime());

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return groups.slice(offset, offset + limit);
  }

  /**
   * 获取统计数据
   */
  getStats(): {
    totalGroups: number;
    totalAlerts: number;
    suppressedAlerts: number;
    topFingerprints: Array<{ fingerprint: string; count: number }>;
  } {
    let totalAlerts = 0;
    let suppressedAlerts = 0;
    const fingerprints: Array<{ fingerprint: string; count: number }> = [];

    for (const group of this.alertGroups.values()) {
      totalAlerts += group.count;
      if (group.suppressed) {
        suppressedAlerts += group.count;
      }
      fingerprints.push({ fingerprint: group.fingerprint, count: group.count });
    }

    // 取 top 10
    fingerprints.sort((a, b) => b.count - a.count);

    return {
      totalGroups: this.alertGroups.size,
      totalAlerts,
      suppressedAlerts,
      topFingerprints: fingerprints.slice(0, 10),
    };
  }

  /**
   * 清理过期数据
   */
  cleanup(): void {
    const now = new Date();
    let cleanedFingerprints = 0;
    let cleanedGroups = 0;

    // 清理指纹缓存
    for (const [fingerprint, data] of this.fingerprintCache.entries()) {
      if (data.expiresAt < now) {
        this.fingerprintCache.delete(fingerprint);
        cleanedFingerprints++;
      }
    }

    // 清理告警分组（保留最近24小时的）
    const groupExpiryTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const [fingerprint, group] of this.alertGroups.entries()) {
      if (group.lastOccurrence < groupExpiryTime) {
        this.alertGroups.delete(fingerprint);
        cleanedGroups++;
      }
    }

    if (cleanedFingerprints > 0 || cleanedGroups > 0) {
      logger.info(
        { cleanedFingerprints, cleanedGroups, remainingGroups: this.alertGroups.size },
        'AlertDeduplication cleanup completed'
      );
    }
  }

  /**
   * 清除所有数据（用于测试）
   */
  clearAll(): void {
    this.alertGroups.clear();
    this.fingerprintCache.clear();
  }

  /**
   * 批量处理告警
   */
  batchProcess(alerts: Alert[]): {
    duplicates: number;
    newAlerts: number;
    suppressed: number;
    groups: AlertGroup[];
  } {
    let duplicates = 0;
    let newAlerts = 0;
    let suppressed = 0;
    const groups: AlertGroup[] = [];

    for (const alert of alerts) {
      const result = this.processAlert(alert);

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
}