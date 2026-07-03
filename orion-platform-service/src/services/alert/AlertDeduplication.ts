/**
 * AlertDeduplication - 告警去重服务
 *
 * 功能：
 * - 告警指纹生成
 * - 重复告警检测
 * - 告警合并策略
 *
 * 持久化：PostgreSQL alert_deduplication 表，DB 失败时降级到内存 Map
 * 内存缓存：fingerprintCache 是 ephemeral TTL 缓存（快速去重检测）
 *            groupsMemory 是 DB 失败时的分组降级缓存
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger';
import {
  Alert,
  AlertFingerprint,
  AlertGroup,
  DeduplicationConfig,
} from './AlertTypes';
import { getCurrentTraceId, getCurrentTenantId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/** 内存中保存的分组记录 */
interface MemoryGroupRecord {
  group: AlertGroup;
  updatedAt: Date;
}

/**
 * 告警去重服务
 *
 * 分层持久化策略：
 * 1. fingerprintCache（内存 TTL）— 快速去重检测，每次 processAlert 都会写入
 * 2. alert_deduplication 表（PostgreSQL）— 持久化 occurrence 计数和 suppressed 状态
 * 3. groupsMemory（内存 Map）— DB 不可用时的分组降级缓存
 */
export class AlertDeduplication {
  private config: DeduplicationConfig;
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null = null;
  // Fingerprint cache is ephemeral TTL cache - stays in-memory for fast dedup lookup
  private fingerprintCache: Map<string, { fingerprint: string; expiresAt: Date }> = new Map();
  // Group cache for DB fallback: fingerprint -> group + last update time
  private groupsMemory: Map<string, MemoryGroupRecord> = new Map();
  // Track whether DB is available
  private dbAvailable: boolean = true;
  private dbChecked: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null,
    config?: Partial<DeduplicationConfig>,
  ) {
    this.config = {
      deduplicationWindowMs: config?.deduplicationWindowMs || 4 * 60 * 60 * 1000,
      maxGroupSize: config?.maxGroupSize || 100,
      aggregationIntervalMs: config?.aggregationIntervalMs || 60 * 1000,
      ...config,
    };
    this.db = db ?? null;
  }

  /**
   * 启动服务
   */
  start(): void {
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
    this.groupsMemory.clear();

    logger.info('AlertDeduplication service stopped');
  }

  /**
   * 生成告警指纹
   */
  generateFingerprint(alert: Partial<Alert>): AlertFingerprint {
    const labels = alert.labels || {};
    const sortedLabels = Object.keys(labels)
      .sort()
      .map((k) => `${k}="${labels[k]}"`)
      .join(',');

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

    return new Date() < cached.expiresAt;
  }

  /**
   * 记录告警指纹到内存 TTL 缓存
   */
  recordFingerprint(fingerprint: string): void {
    const expiresAt = new Date(Date.now() + this.config.deduplicationWindowMs);
    this.fingerprintCache.set(fingerprint, { fingerprint, expiresAt });
  }

  // ==================== DB 操作层（带降级） ====================

  /**
   * 探测 DB 可用性，同时验证表是否存在。
   */
  private async probeDbAvailability(): Promise<boolean> {
    if (!this.db) {
      return false;
    }
    if (this.dbChecked) {
      return this.dbAvailable;
    }
    this.dbChecked = true;

    const testFp = '__db_probe_test__';
    const now = new Date();

    try {
      await this.db.query(
        `INSERT INTO alert_deduplication (tenant_id, fingerprint, alert_id, first_seen, last_seen, occurrence_count, suppressed)
         VALUES ('00000000-0000-0000-0000-000000000000', $1, gen_random_uuid(), $2, $3, $4, $5)`,
        [testFp, now, now, 1, false],
      );

      const selectResult = await this.db.query(
        `SELECT COUNT(*) AS cnt FROM alert_deduplication WHERE fingerprint = $1`,
        [testFp],
      );
      const cnt = parseInt((selectResult.rows[0] as any)?.cnt ?? '0', 10);

      // 清理测试行
      try {
        await this.db.query(`DELETE FROM alert_deduplication WHERE fingerprint = $1`, [testFp]);
      } catch {
        // ignore cleanup error
      }

      const available = cnt > 0;
      if (!available) {
        logger.warn({ traceId: getCurrentTraceId() }, 'DB probe failed — switching to memory-only mode');
      }

      this.dbAvailable = available;
      return available;
    } catch (_err) {
      logger.warn({ traceId: getCurrentTraceId() }, 'DB probe failed: error — switching to memory-only mode');
      this.dbAvailable = false;
      return false;
    }
  }

  /**
   * 获取告警分组 — 优先 PostgreSQL，失败降级到内存
   */
  private async getGroupFromStore(fingerprint: string): Promise<AlertGroup | undefined> {
    // 1) DB 不可用时从内存缓存读取
    const memRecord = this.groupsMemory.get(fingerprint);
    if (memRecord && this.dbAvailable === false) {
      return memRecord.group;
    }

    // 2) 如果还没探测 DB，先探测
    if (!this.dbChecked && this.db) {
      await this.probeDbAvailability();
    }

    // 3) DB 不可用或未配置
    if (!this.db || this.dbAvailable === false) {
      if (!this.db) {
        return undefined;
      }
      const fallback = this.groupsMemory.get(fingerprint);
      return fallback ? fallback.group : undefined;
    }

    try {
      const result = await this.db.query(
        `SELECT
           fingerprint,
           MIN(first_seen) AS first_seen,
           MAX(last_seen) AS last_seen,
           SUM(occurrence_count) AS total_count,
           MAX(suppressed) AS suppressed
         FROM alert_deduplication
         WHERE fingerprint = $1
         GROUP BY fingerprint`,
        [fingerprint],
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      const row = result.rows[0];
      return {
        fingerprint: row.fingerprint,
        alerts: [] as unknown as Alert[],
        count: parseInt(row.total_count, 10),
        firstOccurrence: new Date(row.first_seen),
        lastOccurrence: new Date(row.last_seen),
        suppressed: row.suppressed,
      };
    } catch (err) {
      this.dbAvailable = false;
      logger.error(
        { traceId: getCurrentTraceId(), err, fingerprint },
        'Failed to query alert_deduplication from PostgreSQL, switching to memory cache'
      );
      const fallback = this.groupsMemory.get(fingerprint);
      return fallback ? fallback.group : undefined;
    }
  }

  /**
   * 保存分组到 store（PostgreSQL + 内存降级）
   */
  private async saveGroupToStore(group: AlertGroup): Promise<void> {
    const now = new Date();
    const tenantId = getCurrentTenantId();

    // 始终写入内存缓存
    this.groupsMemory.set(group.fingerprint, { group, updatedAt: now });

    if (!this.db) {
      return;
    }

    if (!this.dbChecked) {
      await this.probeDbAvailability();
      if (this.dbAvailable === false) {
        return;
      }
    }

    if (this.dbAvailable === false) {
      return;
    }

    try {
      await this.db.query(
        `INSERT INTO alert_deduplication (tenant_id, fingerprint, alert_id, first_seen, last_seen, occurrence_count, suppressed)
         VALUES ($1, $2, gen_random_uuid(), $3, $4, $5, $6)`,
        [tenantId, group.fingerprint, group.firstOccurrence, group.lastOccurrence, group.count, group.suppressed],
      );
    } catch (err) {
      this.dbAvailable = false;
      logger.error(
        { traceId: getCurrentTraceId(), err, fingerprint: group.fingerprint },
        'Failed to persist dedup group to PostgreSQL, using memory-only'
      );
    }
  }

  /**
   * 更新分组到 store（PostgreSQL + 内存降级）
   */
  private async updateGroupToStore(group: AlertGroup): Promise<void> {
    const now = new Date();
    const tenantId = getCurrentTenantId();

    // 始终更新内存缓存
    this.groupsMemory.set(group.fingerprint, { group, updatedAt: now });

    if (!this.db || this.dbAvailable === false) {
      return;
    }

    try {
      await this.db.query(
        `INSERT INTO alert_deduplication (tenant_id, fingerprint, alert_id, last_seen, occurrence_count, suppressed)
         VALUES ($1, $2, gen_random_uuid(), $3, $4, $5)`,
        [tenantId, group.fingerprint, now, 1, group.suppressed],
      );
    } catch (err) {
      this.dbAvailable = false;
      logger.debug(
        { traceId: getCurrentTraceId(), fingerprint: group.fingerprint },
        'Failed to append dedup record to PostgreSQL (memory already updated)'
      );
    }
  }

  /**
   * 从 PostgreSQL 获取活跃分组列表
   */
  private async getGroupsFromDB(
    minCount?: number,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100,
    offset: number = 0,
  ): Promise<AlertGroup[]> {
    if (!this.db || this.dbAvailable === false) {
      return [];
    }

    try {
      const innerParams: unknown[] = [];
      let idx = 1;

      let innerWhere = '';
      if (startTime) {
        innerWhere += ` AND last_seen >= $${idx}`;
        innerParams.push(startTime);
        idx++;
      }
      if (endTime) {
        innerWhere += ` AND first_seen <= $${idx}`;
        innerParams.push(endTime);
        idx++;
      }

      let having = '';
      if (minCount) {
        having = ` HAVING SUM(occurrence_count) >= $${idx}`;
        innerParams.push(minCount);
        idx++;
      }

      const query = `SELECT
                        fingerprint,
                        MIN(first_seen) AS first_seen,
                        MAX(last_seen) AS last_seen,
                        SUM(occurrence_count) AS total_count,
                        MAX(suppressed) AS suppressed
                      FROM alert_deduplication
                      WHERE 1=1${innerWhere}
                      GROUP BY fingerprint${having}
                      ORDER BY last_seen DESC LIMIT $${idx++} OFFSET $${idx++}`;
      innerParams.push(limit, offset);

      const result = await this.db.query(query, innerParams);
      return result.rows.map((row: any) => ({
        fingerprint: row.fingerprint,
        alerts: [] as unknown as Alert[],
        count: parseInt(row.total_count, 10),
        firstOccurrence: new Date(row.first_seen),
        lastOccurrence: new Date(row.last_seen),
        suppressed: row.suppressed,
      }));
    } catch (err) {
      this.dbAvailable = false;
      logger.error(
        { traceId: getCurrentTraceId(), err },
        'Failed to query active groups from PostgreSQL'
      );
      return [];
    }
  }

  /**
   * 从 PostgreSQL 获取统计数据
   */
  private async getStatsFromDB(): Promise<{ totalGroups: number; totalAlerts: number; suppressedGroups: number }> {
    if (!this.db || this.dbAvailable === false) {
      return { totalGroups: 0, totalAlerts: 0, suppressedGroups: 0 };
    }

    try {
      const result = await this.db.query(
        `SELECT
           COUNT(DISTINCT fingerprint) AS total_groups,
           COALESCE(SUM(occurrence_count), 0) AS total_alerts,
           COUNT(CASE WHEN suppressed = true THEN 1 END) AS suppressed_records
         FROM alert_deduplication`,
      );
      const row = result.rows[0];
      return {
        totalGroups: parseInt(row.total_groups, 10),
        totalAlerts: parseInt(row.total_alerts, 10),
        suppressedGroups: parseInt(row.suppressed_records, 10),
      };
    } catch (err) {
      this.dbAvailable = false;
      logger.error(
        { traceId: getCurrentTraceId(), err },
        'Failed to query dedup stats from PostgreSQL'
      );
      return { totalGroups: 0, totalAlerts: 0, suppressedGroups: 0 };
    }
  }

  /**
   * 从 PostgreSQL 获取 top fingerprints
   */
  private async getTopFingerprintsFromDB(limit: number = 10): Promise<Array<{ fingerprint: string; count: number }>> {
    if (!this.db || this.dbAvailable === false) {
      return [];
    }

    try {
      const result = await this.db.query(
        `SELECT fingerprint, SUM(occurrence_count) AS cnt
         FROM alert_deduplication
         GROUP BY fingerprint
         ORDER BY cnt DESC
         LIMIT $1`,
        [limit],
      );
      return result.rows.map((row: any) => ({
        fingerprint: row.fingerprint,
        count: parseInt(row.cnt, 10),
      }));
    } catch (err) {
      this.dbAvailable = false;
      logger.error(
        { traceId: getCurrentTraceId(), err },
        'Failed to query top fingerprints from PostgreSQL'
      );
      return [];
    }
  }

  /**
   * 从 PostgreSQL 清理过期记录
   */
  private async deleteExpiredFromDB(olderThan: Date): Promise<number> {
    if (!this.db || this.dbAvailable === false) {
      return 0;
    }

    try {
      const result = await this.db.query(
        `DELETE FROM alert_deduplication
         WHERE last_seen < $1`,
        [olderThan],
      );
      return result.rowCount ?? 0;
    } catch (err) {
      logger.error(
        { traceId: getCurrentTraceId(), err },
        'Failed to clean up expired dedup records from PostgreSQL'
      );
      return 0;
    }
  }

  /**
   * 从 PostgreSQL 清除所有数据
   */
  private async deleteAllFromDB(): Promise<void> {
    if (!this.db || this.dbAvailable === false) {
      return;
    }

    try {
      await this.db.query(`TRUNCATE alert_deduplication RESTART IDENTITY`);
    } catch (err) {
      logger.error(
        { traceId: getCurrentTraceId(), err },
        'Failed to truncate alert_deduplication table'
      );
    }
  }

  // ==================== 公开接口 ====================

  /**
   * 处理告警去重
   */
  async processAlert(alert: Alert): Promise<{
    isDuplicate: boolean;
    group: AlertGroup;
    action: 'create' | 'update' | 'suppress';
  }> {
    const fingerprint = alert.fingerprint || this.generateFingerprint(alert).fingerprint;

    const isDuplicate = this.isDuplicate(fingerprint);

    let group = await this.getGroupFromStore(fingerprint);
    let action: 'create' | 'update' | 'suppress';

    if (!group) {
      group = {
        fingerprint,
        alerts: [alert],
        count: 1,
        firstOccurrence: alert.startsAt,
        lastOccurrence: alert.startsAt,
        suppressed: false,
      };
      await this.saveGroupToStore(group);
      action = 'create';

      this.recordFingerprint(fingerprint);
    } else {
      group.alerts.push(alert);
      group.count++;
      group.lastOccurrence = alert.startsAt;

      if (group.alerts.length > this.config.maxGroupSize) {
        group.alerts = group.alerts.slice(-this.config.maxGroupSize);
      }

      action = isDuplicate ? 'suppress' : 'update';

      await this.updateGroupToStore(group);

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
   */
  async mergeAlerts(fingerprint: string): Promise<AlertGroup | null> {
    const group = await this.getGroupFromStore(fingerprint);
    if (!group) {
      return null;
    }
    return group;
  }

  /**
   * 获取告警分组（从 PostgreSQL，失败降级到内存）
   */
  async getAlertGroup(fingerprint: string): Promise<AlertGroup | undefined> {
    return this.getGroupFromStore(fingerprint);
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
    const fromDB = await this.getGroupsFromDB(
      options?.minCount,
      options?.startTime,
      options?.endTime,
      options?.limit || 100,
      options?.offset || 0,
    );

    if (fromDB.length === 0 && this.dbAvailable === false) {
      const now = new Date();
      const expiry = new Date(now.getTime() - this.config.deduplicationWindowMs);
      let memoryGroups = [...this.groupsMemory.values()]
        .filter(r => r.updatedAt >= expiry)
        .map(r => r.group);
      if (options?.minCount) {
        memoryGroups = memoryGroups.filter(g => g.count >= options.minCount!);
      }
      return memoryGroups;
    }

    return fromDB;
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
    const stats = await this.getStatsFromDB();
    const topFingerprints = await this.getTopFingerprintsFromDB(10);

    if (stats.totalGroups === 0 && this.dbAvailable === false) {
      const allGroups = [...this.groupsMemory.values()].map(r => r.group);
      return {
        totalGroups: allGroups.length,
        totalAlerts: allGroups.reduce((sum, g) => sum + g.count, 0),
        suppressedAlerts: allGroups.filter(g => g.suppressed).length,
        topFingerprints: allGroups
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map(g => ({ fingerprint: g.fingerprint, count: g.count })),
      };
    }

    return {
      totalGroups: stats.totalGroups,
      totalAlerts: stats.totalAlerts,
      suppressedAlerts: stats.suppressedGroups,
      topFingerprints,
    };
  }

  /**
   * 清理过期数据
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    let cleanedFingerprints = 0;

    // 清理指纹缓存
    for (const [fingerprint, data] of this.fingerprintCache.entries()) {
      if (data.expiresAt < now) {
        this.fingerprintCache.delete(fingerprint);
        cleanedFingerprints++;
      }
    }

    // 清理过期的内存分组缓存
    const groupExpiryTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    for (const [fingerprint, record] of this.groupsMemory.entries()) {
      if (record.updatedAt < groupExpiryTime) {
        this.groupsMemory.delete(fingerprint);
      }
    }

    let cleanedGroups = 0;
    if (this.dbAvailable) {
      cleanedGroups = await this.deleteExpiredFromDB(groupExpiryTime);
    }

    if (cleanedFingerprints > 0 || cleanedGroups > 0) {
      const remaining = (await this.getStatsFromDB()).totalGroups;
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
    this.groupsMemory.clear();
    await this.deleteAllFromDB();
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
}
