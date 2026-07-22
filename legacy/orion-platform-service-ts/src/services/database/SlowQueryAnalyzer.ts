/**
 * 慢查询分析服务
 *
 * 功能：
 * 1. 慢查询日志收集与解析
 * 2. 慢查询统计分析（Top N、趋势、分布）
 * 3. 慢查询优化建议
 * 4. 慢查询告警
 */

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

/** 慢查询条目 */
export interface SlowQueryEntry {
  id: string;
  timestamp: Date;
  database: string;
  user: string;
  sql: string;
  queryTime: number;       // 秒
  lockTime: number;        // 秒
  rowsSent: number;
  rowsExamined: number;
  normalizedSql: string;   // 参数化后的 SQL
  fingerprint: string;     // SQL 指纹（用于去重分组）
}

/** 慢查询统计 */
export interface SlowQueryStats {
  totalQueries: number;
  totalDuration: number;
  avgQueryTime: number;
  maxQueryTime: number;
  p50QueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  avgRowsExamined: number;
  maxRowsExamined: number;
}

/** 慢查询 Top N 条目 */
export interface SlowQueryTopN {
  fingerprint: string;
  sampleSql: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  avgRowsExamined: number;
  database: string;
  optimizationTips: string[];
}

/** 慢查询趋势 */
export interface SlowQueryTrend {
  timeBucket: string;  // ISO 时间段标识
  count: number;
  avgQueryTime: number;
  maxQueryTime: number;
  totalDuration: number;
}

/** 慢查询分布 */
export interface SlowQueryDistribution {
  byTimeRange: { range: string; count: number }[];
  byDatabase: { database: string; count: number }[];
  byUser: { user: string; count: number }[];
}

/** 慢查询告警 */
export interface SlowQueryAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  query: SlowQueryEntry;
  threshold: number;
}

/** 慢查询分析配置 */
export interface SlowQueryAnalyzerConfig {
  /** 慢查询阈值（秒） */
  slowQueryThreshold: number;
  /** 告警阈值（秒） */
  alertThreshold: number;
  /** 最大保留条目数 */
  maxEntries: number;
  /** 是否启用自动告警 */
  enableAlert: boolean;
  /** 告警处理器 */
  onAlert?: (alert: SlowQueryAlert) => void;
}

const DEFAULT_CONFIG: SlowQueryAnalyzerConfig = {
  slowQueryThreshold: 1.0,
  alertThreshold: 10.0,
  maxEntries: 10000,
  enableAlert: true,
};

// ==================== 服务实现 ====================

/**
 * 慢查询分析服务
 */
export class SlowQueryAnalyzer extends EventEmitter {
  private config: SlowQueryAnalyzerConfig;
  private entries: SlowQueryEntry[] = [];
  private alerts: SlowQueryAlert[] = [];

  constructor(config: Partial<SlowQueryAnalyzerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 收集慢查询条目
   */
  collect(entry: Omit<SlowQueryEntry, 'id' | 'normalizedSql' | 'fingerprint'>): SlowQueryEntry {
    const fullEntry: SlowQueryEntry = {
      ...entry,
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      normalizedSql: this.normalizeSQL(entry.sql),
      fingerprint: this.computeFingerprint(entry.sql),
    };

    // 保留最近的条目
    if (this.entries.length >= this.config.maxEntries) {
      this.entries.shift();
    }
    this.entries.push(fullEntry);

    // 检查是否需要告警
    if (this.config.enableAlert && entry.queryTime >= this.config.alertThreshold) {
      this.triggerAlert(fullEntry);
    }

    this.emit('entry-collected', fullEntry);
    return fullEntry;
  }

  /**
   * 批量收集
   */
  collectBatch(entries: Omit<SlowQueryEntry, 'id' | 'normalizedSql' | 'fingerprint'>[]): SlowQueryEntry[] {
    return entries.map((e) => this.collect(e));
  }

  /**
   * 获取统计数据
   */
  getStats(query?: {
    database?: string;
    since?: Date;
    until?: Date;
  }): SlowQueryStats {
    let filtered = this.filterEntries(query);

    if (filtered.length === 0) {
      return {
        totalQueries: 0,
        totalDuration: 0,
        avgQueryTime: 0,
        maxQueryTime: 0,
        p50QueryTime: 0,
        p95QueryTime: 0,
        p99QueryTime: 0,
        avgRowsExamined: 0,
        maxRowsExamined: 0,
      };
    }

    const times = filtered.map((e) => e.queryTime).sort((a, b) => a - b);
    const totalDuration = times.reduce((sum, t) => sum + t, 0);

    return {
      totalQueries: filtered.length,
      totalDuration,
      avgQueryTime: totalDuration / filtered.length,
      maxQueryTime: times[times.length - 1],
      p50QueryTime: this.percentile(times, 50),
      p95QueryTime: this.percentile(times, 95),
      p99QueryTime: this.percentile(times, 99),
      avgRowsExamined: filtered.reduce((sum, e) => sum + e.rowsExamined, 0) / filtered.length,
      maxRowsExamined: Math.max(...filtered.map((e) => e.rowsExamined)),
    };
  }

  /**
   * 获取 Top N 慢查询
   */
  getTopN(n: number = 10, query?: {
    database?: string;
    since?: Date;
  }): SlowQueryTopN[] {
    const filtered = this.filterEntries(query);

    // 按指纹分组
    const groups = new Map<string, SlowQueryEntry[]>();
    for (const entry of filtered) {
      const group = groups.get(entry.fingerprint) || [];
      group.push(entry);
      groups.set(entry.fingerprint, group);
    }

    // 计算每组统计
    const topN: SlowQueryTopN[] = [];
    for (const [fingerprint, group] of groups) {
      const totalTime = group.reduce((sum, e) => sum + e.queryTime, 0);
      topN.push({
        fingerprint,
        sampleSql: group[0].sql,
        count: group.length,
        totalTime,
        avgTime: totalTime / group.length,
        maxTime: Math.max(...group.map((e) => e.queryTime)),
        avgRowsExamined: group.reduce((sum, e) => sum + e.rowsExamined, 0) / group.length,
        database: group[0].database,
        optimizationTips: this.generateOptimizationTips(group[0]),
      });
    }

    // 按总耗时排序
    topN.sort((a, b) => b.totalTime - a.totalTime);
    return topN.slice(0, n);
  }

  /**
   * 获取趋势数据
   */
  getTrend(query?: {
    database?: string;
    since?: Date;
    until?: Date;
    granularity?: 'hour' | 'day';
  }): SlowQueryTrend[] {
    const filtered = this.filterEntries(query);
    const granularity = query?.granularity || 'hour';

    // 按时间桶分组
    const buckets = new Map<string, SlowQueryEntry[]>();
    for (const entry of filtered) {
      const bucket = this.getTimeBucket(entry.timestamp, granularity);
      const group = buckets.get(bucket) || [];
      group.push(entry);
      buckets.set(bucket, group);
    }

    // 生成趋势数据
    const trend: SlowQueryTrend[] = [];
    for (const [timeBucket, group] of buckets) {
      const times = group.map((e) => e.queryTime);
      trend.push({
        timeBucket,
        count: group.length,
        avgQueryTime: times.reduce((sum, t) => sum + t, 0) / times.length,
        maxQueryTime: Math.max(...times),
        totalDuration: times.reduce((sum, t) => sum + t, 0),
      });
    }

    trend.sort((a, b) => a.timeBucket.localeCompare(b.timeBucket));
    return trend;
  }

  /**
   * 获取分布数据
   */
  getDistribution(query?: { since?: Date }): SlowQueryDistribution {
    const filtered = this.filterEntries(query);

    // 按时间范围分布
    const timeRanges = [
      { range: '1-3s', min: 1, max: 3 },
      { range: '3-5s', min: 3, max: 5 },
      { range: '5-10s', min: 5, max: 10 },
      { range: '10-30s', min: 10, max: 30 },
      { range: '30-60s', min: 30, max: 60 },
      { range: '>60s', min: 60, max: Infinity },
    ];
    const byTimeRange = timeRanges.map(({ range, min, max }) => ({
      range,
      count: filtered.filter((e) => e.queryTime >= min && e.queryTime < max).length,
    }));

    // 按数据库分布
    const dbCounts = new Map<string, number>();
    for (const entry of filtered) {
      dbCounts.set(entry.database, (dbCounts.get(entry.database) || 0) + 1);
    }
    const byDatabase = Array.from(dbCounts.entries())
      .map(([database, count]) => ({ database, count }))
      .sort((a, b) => b.count - a.count);

    // 按用户分布
    const userCounts = new Map<string, number>();
    for (const entry of filtered) {
      userCounts.set(entry.user, (userCounts.get(entry.user) || 0) + 1);
    }
    const byUser = Array.from(userCounts.entries())
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count);

    return { byTimeRange, byDatabase, byUser };
  }

  /**
   * 获取告警历史
   */
  getAlerts(limit: number = 50): SlowQueryAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<SlowQueryAnalyzerConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * 获取配置
   */
  getConfig(): SlowQueryAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * 清空数据
   */
  clear(): void {
    this.entries = [];
    this.alerts = [];
  }

  // ==================== 内部方法 ====================

  /**
   * SQL 归一化（将参数替换为 ?）
   */
  private normalizeSQL(sql: string): string {
    return sql
      .replace(/'[^']*'/g, '?')
      .replace(/"[^"]*"/g, '?')
      .replace(/\b\d+\b/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 计算 SQL 指纹
   */
  private computeFingerprint(sql: string): string {
    const normalized = this.normalizeSQL(sql);
    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `fp-${Math.abs(hash).toString(36)}`;
  }

  /**
   * 触发告警
   */
  private triggerAlert(entry: SlowQueryEntry): void {
    let severity: 'info' | 'warning' | 'critical' = 'warning';
    if (entry.queryTime >= this.config.alertThreshold * 3) {
      severity = 'critical';
    } else if (entry.queryTime >= this.config.alertThreshold * 2) {
      severity = 'warning';
    } else {
      severity = 'info';
    }

    const alert: SlowQueryAlert = {
      id: `alert-${Date.now()}`,
      timestamp: new Date(),
      severity,
      message: `检测到慢查询: ${entry.queryTime.toFixed(2)}s (阈值: ${this.config.alertThreshold}s)`,
      query: entry,
      threshold: this.config.alertThreshold,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    if (this.config.onAlert) {
      this.config.onAlert(alert);
    }
  }

  /**
   * 过滤条目
   */
  private filterEntries(query?: {
    database?: string;
    since?: Date;
    until?: Date;
  }): SlowQueryEntry[] {
    let filtered = [...this.entries];
    if (query?.database) {
      filtered = filtered.filter((e) => e.database === query.database);
    }
    if (query?.since) {
      filtered = filtered.filter((e) => e.timestamp >= query.since!);
    }
    if (query?.until) {
      filtered = filtered.filter((e) => e.timestamp <= query.until!);
    }
    return filtered;
  }

  /**
   * 计算百分位数
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 获取时间桶
   */
  private getTimeBucket(date: Date, granularity: 'hour' | 'day'): string {
    const d = new Date(date);
    if (granularity === 'hour') {
      d.setMinutes(0, 0, 0);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return d.toISOString();
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationTips(entry: SlowQueryEntry): string[] {
    const tips: string[] = [];
    const sql = entry.sql.toUpperCase();

    if (entry.rowsExamined > 10000) {
      tips.push('扫描行数过多，建议添加合适的索引');
    }
    if (entry.rowsSent > 1000) {
      tips.push('返回行数过多，建议使用 LIMIT 限制');
    }
    if (sql.includes('SELECT *')) {
      tips.push('避免 SELECT *，只查询需要的字段');
    }
    if (sql.includes('LIKE \'%')) {
      tips.push('左模糊查询无法使用索引，考虑全文搜索');
    }
    if (entry.queryTime > 10 && entry.lockTime > 1) {
      tips.push('锁等待时间较长，检查是否有锁竞争');
    }
    if (sql.includes('ORDER BY') && !sql.includes('LIMIT')) {
      tips.push('ORDER BY 无 LIMIT 可能导致大量排序');
    }
    if (tips.length === 0) {
      tips.push('建议使用 EXPLAIN 分析执行计划');
    }
    return tips;
  }
}
