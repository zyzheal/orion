/**
 * MySQL 主从延迟监控器
 *
 * 功能：
 * 1. 主从延迟检测（SHOW SLAVE STATUS）
 * 2. 延迟阈值告警
 * 3. 延迟趋势分析
 */

import { EventEmitter } from 'events';

/**
 * 延迟级别定义
 */
export enum LagLevel {
  NORMAL = 'normal',      // < 10s
  WARNING = 'warning',    // 10s - 30s
  CRITICAL = 'critical',  // 30s - 60s
  SEVERE = 'severe',      // > 60s
}

/**
 * 降级级别定义
 */
export enum DegradationLevel {
  LEVEL_0 = 0,  // 正常，无降级
  LEVEL_1 = 1,  // L1: 暂停从库分析查询
  LEVEL_2 = 2,  // L2: 从库读请求降至20%
  LEVEL_3 = 3,  // L3: 从库读请求100%切断
}

/**
 * 延迟阈值配置
 */
export interface LagThresholds {
  warning: number;    // 警告阈值（秒），默认 10s
  critical: number;   // 严重阈值（秒），默认 30s
  severe: number;     // 紧急阈值（秒），默认 60s
}

/**
 * 从库状态信息
 */
export interface ReplicaStatus {
  host: string;
  port: number;
  ioRunning: boolean;
  sqlRunning: boolean;
  secondsBehindMaster: number;
  lastError?: string;
  lastIoError?: string;
  lastSqlError?: string;
  relayMasterLogFile: string;
  execMasterLogPos: number;
  readMasterLogPos: number;
  retrievedGtidSet?: string;
  executedGtidSet?: string;
}

/**
 * 延迟数据点
 */
export interface LagDataPoint {
  timestamp: Date;
  lag: number;
  level: LagLevel;
  replicaHost: string;
}

/**
 * 延迟趋势分析结果
 */
export interface LagTrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  rateOfChange: number;  // 每秒延迟变化量
  predictedLag: number;  // 预测 1 分钟后的延迟
  confidence: number;    // 预测置信度 0-1
}

/**
 * 延迟监控配置
 */
export interface ReplicationLagMonitorConfig {
  /** 检查间隔（毫秒），默认 5000ms */
  checkInterval: number;
  /** 延迟阈值配置 */
  thresholds: LagThresholds;
  /** 历史数据保留时间（毫秒），默认 1 小时 */
  historyRetention: number;
  /** 趋势分析窗口大小（数据点数量），默认 12 */
  trendWindowSize: number;
  /** 数据库查询函数 */
  executeQuery: (sql: string) => Promise<{ rows: any[] }>;
}

const DEFAULT_THRESHOLDS: LagThresholds = {
  warning: 10,
  critical: 30,
  severe: 60,
};

const DEFAULT_CONFIG: Omit<ReplicationLagMonitorConfig, 'executeQuery'> = {
  checkInterval: 5000,
  thresholds: DEFAULT_THRESHOLDS,
  historyRetention: 3600000, // 1 hour
  trendWindowSize: 12,
};

/**
 * 主从延迟监控器
 */
export class ReplicationLagMonitor extends EventEmitter {
  private config: ReplicationLagMonitorConfig;
  private checkTimer?: ReturnType<typeof setInterval>;
  private lagHistory: Map<string, LagDataPoint[]> = new Map();
  private currentReplicas: Map<string, ReplicaStatus> = new Map();
  private currentLevel: DegradationLevel = DegradationLevel.LEVEL_0;
  private isMonitoring: boolean = false;

  constructor(config: Partial<ReplicationLagMonitorConfig> & { executeQuery: ReplicationLagMonitorConfig['executeQuery'] }) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        ...config.thresholds,
      },
    };
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.checkTimer = setInterval(() => {
      this.performCheck().catch((err) => {
        this.emit('error', err);
      });
    }, this.config.checkInterval);

    // 立即执行一次检查
    this.performCheck().catch((err) => {
      this.emit('error', err);
    });

    this.emit('started');
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    this.isMonitoring = false;
    this.emit('stopped');
  }

  /**
   * 获取当前降级级别
   */
  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * 获取所有从库状态
   */
  getReplicaStatuses(): Map<string, ReplicaStatus> {
    return new Map(this.currentReplicas);
  }

  /**
   * 获取指定从库状态
   */
  getReplicaStatus(host: string): ReplicaStatus | undefined {
    return this.currentReplicas.get(host);
  }

  /**
   * 获取最大延迟
   */
  getMaxLag(): number {
    let maxLag = 0;
    for (const status of this.currentReplicas.values()) {
      if (status.secondsBehindMaster > maxLag) {
        maxLag = status.secondsBehindMaster;
      }
    }
    return maxLag;
  }

  /**
   * 获取平均延迟
   */
  getAverageLag(): number {
    const statuses = Array.from(this.currentReplicas.values());
    if (statuses.length === 0) {
      return 0;
    }
    const totalLag = statuses.reduce((sum, s) => sum + s.secondsBehindMaster, 0);
    return totalLag / statuses.length;
  }

  /**
   * 获取延迟历史
   */
  getLagHistory(host?: string): LagDataPoint[] {
    if (host) {
      return this.lagHistory.get(host) || [];
    }
    // 返回所有从库的历史合并
    const allHistory: LagDataPoint[] = [];
    for (const history of this.lagHistory.values()) {
      allHistory.push(...history);
    }
    return allHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 分析延迟趋势
   */
  analyzeTrend(host: string): LagTrendAnalysis {
    const history = this.lagHistory.get(host) || [];

    if (history.length < 2) {
      return {
        trend: 'stable',
        rateOfChange: 0,
        predictedLag: 0,
        confidence: 0,
      };
    }

    // 取最近的数据点进行趋势分析
    const recentHistory = history.slice(-this.config.trendWindowSize);

    if (recentHistory.length < 2) {
      return {
        trend: 'stable',
        rateOfChange: 0,
        predictedLag: recentHistory[0]?.lag || 0,
        confidence: 0,
      };
    }

    // 计算线性回归
    const { slope, intercept, r2 } = this.linearRegression(recentHistory);

    // 预测 1 分钟后的延迟
    const predictedLag = Math.max(0, intercept + slope * (recentHistory.length + 12));

    // 判断趋势
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(slope) > 0.5) { // 每秒变化超过 0.5 秒
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      trend,
      rateOfChange: slope,
      predictedLag,
      confidence: r2,
    };
  }

  /**
   * 根据延迟计算降级级别
   */
  calculateDegradationLevel(lag: number): DegradationLevel {
    const { thresholds } = this.config;

    if (lag >= thresholds.severe) {
      return DegradationLevel.LEVEL_3;
    }
    if (lag >= thresholds.critical) {
      return DegradationLevel.LEVEL_2;
    }
    if (lag >= thresholds.warning) {
      return DegradationLevel.LEVEL_1;
    }
    return DegradationLevel.LEVEL_0;
  }

  /**
   * 将延迟转换为级别枚举
   */
  classifyLag(lag: number): LagLevel {
    const { thresholds } = this.config;

    if (lag >= thresholds.severe) {
      return LagLevel.SEVERE;
    }
    if (lag >= thresholds.critical) {
      return LagLevel.CRITICAL;
    }
    if (lag >= thresholds.warning) {
      return LagLevel.WARNING;
    }
    return LagLevel.NORMAL;
  }

  /**
   * 执行延迟检查
   */
  private async performCheck(): Promise<void> {
    try {
      // 查询从库状态
      const result = await this.config.executeQuery('SHOW SLAVE STATUS');
      const statuses = this.parseReplicaStatus(result.rows);

      // 更新从库状态
      this.currentReplicas.clear();
      for (const status of statuses) {
        const key = `${status.host}:${status.port}`;
        this.currentReplicas.set(key, status);

        // 记录历史数据
        this.addLagDataPoint(status);

        // 清理过期历史数据
        this.cleanupHistory(key);
      }

      // 计算最大延迟和降级级别
      const maxLag = this.getMaxLag();
      const newLevel = this.calculateDegradationLevel(maxLag);

      // 如果级别发生变化，发出事件
      if (newLevel !== this.currentLevel) {
        const previousLevel = this.currentLevel;
        this.currentLevel = newLevel;
        this.emit('level-change', {
          previousLevel,
          newLevel,
          maxLag,
          averageLag: this.getAverageLag(),
          timestamp: new Date(),
        });

        // 发出告警
        this.emitAlert(newLevel, maxLag);
      }

      // 发出检查完成事件
      this.emit('check-complete', {
        maxLag,
        averageLag: this.getAverageLag(),
        level: this.currentLevel,
        replicaCount: this.currentReplicas.size,
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 解析从库状态
   */
  private parseReplicaStatus(rows: any[]): ReplicaStatus[] {
    return rows.map((row) => ({
      host: row.Master_Host || row.Host || 'unknown',
      port: parseInt(row.Master_Port || row.Port || '3306', 10),
      ioRunning: row.Slave_IO_Running === 'Yes',
      sqlRunning: row.Slave_SQL_Running === 'Yes',
      secondsBehindMaster: parseInt(row.Seconds_Behind_Master || '0', 10),
      lastError: row.Last_Error,
      lastIoError: row.Last_IO_Error,
      lastSqlError: row.Last_SQL_Error,
      relayMasterLogFile: row.Relay_Master_Log_File || '',
      execMasterLogPos: parseInt(row.Exec_Master_Log_Pos || '0', 10),
      readMasterLogPos: parseInt(row.Read_Master_Log_Pos || '0', 10),
      retrievedGtidSet: row.Retrieved_Gtid_Set,
      executedGtidSet: row.Executed_Gtid_Set,
    }));
  }

  /**
   * 添加延迟数据点
   */
  private addLagDataPoint(status: ReplicaStatus): void {
    const key = `${status.host}:${status.port}`;
    const history = this.lagHistory.get(key) || [];

    const dataPoint: LagDataPoint = {
      timestamp: new Date(),
      lag: status.secondsBehindMaster,
      level: this.classifyLag(status.secondsBehindMaster),
      replicaHost: key,
    };

    history.push(dataPoint);
    this.lagHistory.set(key, history);
  }

  /**
   * 清理过期历史数据
   */
  private cleanupHistory(key: string): void {
    const history = this.lagHistory.get(key);
    if (!history) {
      return;
    }

    const cutoff = Date.now() - this.config.historyRetention;
    const filtered = history.filter((p) => p.timestamp.getTime() > cutoff);
    this.lagHistory.set(key, filtered);
  }

  /**
   * 发出告警
   */
  private emitAlert(level: DegradationLevel, lag: number): void {
    const alertLevel = this.getAlertLevel(level);
    const message = this.getAlertMessage(level, lag);

    this.emit('alert', {
      level: alertLevel,
      message,
      lag,
      degradationLevel: level,
      timestamp: new Date(),
    });
  }

  /**
   * 获取告警级别
   */
  private getAlertLevel(level: DegradationLevel): 'info' | 'warning' | 'critical' | 'severe' {
    switch (level) {
      case DegradationLevel.LEVEL_1:
        return 'warning';
      case DegradationLevel.LEVEL_2:
        return 'critical';
      case DegradationLevel.LEVEL_3:
        return 'severe';
      default:
        return 'info';
    }
  }

  /**
   * 获取告警消息
   */
  private getAlertMessage(level: DegradationLevel, lag: number): string {
    switch (level) {
      case DegradationLevel.LEVEL_1:
        return `MySQL replication lag warning: ${lag}s - pausing replica analysis queries`;
      case DegradationLevel.LEVEL_2:
        return `MySQL replication lag critical: ${lag}s - reducing replica read traffic to 20%`;
      case DegradationLevel.LEVEL_3:
        return `MySQL replication lag severe: ${lag}s - cutting off all replica read traffic`;
      default:
        return `MySQL replication lag normal: ${lag}s`;
    }
  }

  /**
   * 线性回归计算
   */
  private linearRegression(data: LagDataPoint[]): { slope: number; intercept: number; r2: number } {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map((d) => d.lag);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算 R²
    const yMean = sumY / n;
    const ssTotal = y.reduce((total, yi) => total + (yi - yMean) ** 2, 0);
    const ssResidual = y.reduce((total, yi, i) => {
      const predicted = intercept + slope * x[i];
      return total + (yi - predicted) ** 2;
    }, 0);
    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
  }

  /**
   * 获取监控状态
   */
  getStatus(): {
    isMonitoring: boolean;
    currentLevel: DegradationLevel;
    maxLag: number;
    averageLag: number;
    replicaCount: number;
    historySize: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      currentLevel: this.currentLevel,
      maxLag: this.getMaxLag(),
      averageLag: this.getAverageLag(),
      replicaCount: this.currentReplicas.size,
      historySize: Array.from(this.lagHistory.values()).reduce((sum, h) => sum + h.length, 0),
    };
  }
}