/**
 * MySQL 数据库故障切换处理器
 *
 * 功能：
 * 1. 降级级别管理（L1/L2/L3）
 * 2. 自动恢复检测
 * 3. 告警通知
 */

import { EventEmitter } from 'events';
import {
  ReplicationLagMonitor,
  DegradationLevel,
  LagLevel,
  ReplicaStatus,
  LagTrendAnalysis,
} from './ReplicationLagMonitor';
import { ReadTrafficManager, RoutingDecision, ReadRequestContext, TrafficDistribution } from './ReadTrafficManager';

/**
 * 故障切换状态
 */
export enum FailoverState {
  NORMAL = 'normal',
  DEGRADED = 'degraded',
  RECOVERING = 'recovering',
  FAILED_OVER = 'failed_over',
}

/**
 * 降级事件
 */
export interface DegradationEvent {
  timestamp: Date;
  previousLevel: DegradationLevel;
  newLevel: DegradationLevel;
  trigger: 'lag_threshold' | 'manual' | 'replica_failure' | 'trend_analysis' | 'auto_recovery';
  maxLag: number;
  averageLag: number;
  affectedReplicas: string[];
  message: string;
}

/**
 * 恢复事件
 */
export interface RecoveryEvent {
  timestamp: Date;
  previousLevel: DegradationLevel;
  newLevel: DegradationLevel;
  recoveryTime: number; // 毫秒
  maxLag: number;
  checksPassed: number;
  message: string;
}

/**
 * 告警事件
 */
export interface FailoverAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical' | 'severe';
  level: DegradationLevel;
  message: string;
  maxLag: number;
  replicas: ReplicaStatus[];
  trend?: LagTrendAnalysis;
}

/**
 * 故障切换处理器配置
 */
export interface DatabaseFailoverHandlerConfig {
  /** 延迟监控器实例 */
  lagMonitor: ReplicationLagMonitor;
  /** 流量管理器实例 */
  trafficManager: ReadTrafficManager;
  /** 是否启用自动恢复 */
  enableAutoRecovery: boolean;
  /** 恢复检查间隔（毫秒） */
  recoveryCheckInterval: number;
  /** 恢复所需的连续成功检查次数 */
  recoverySuccessThreshold: number;
  /** 告警冷却时间（毫秒） */
  alertCooldownPeriod: number;
  /** 是否启用趋势分析预测 */
  enableTrendPrediction: boolean;
  /** 告警通知处理器 */
  onAlert?: (alert: FailoverAlert) => void;
}

const DEFAULT_CONFIG: Partial<DatabaseFailoverHandlerConfig> = {
  enableAutoRecovery: true,
  recoveryCheckInterval: 5000,
  recoverySuccessThreshold: 3,
  alertCooldownPeriod: 60000, // 1 分钟
  enableTrendPrediction: true,
};

/**
 * 数据库故障切换处理器
 */
export class DatabaseFailoverHandler extends EventEmitter {
  private config: DatabaseFailoverHandlerConfig;
  private lagMonitor: ReplicationLagMonitor;
  private trafficManager: ReadTrafficManager;
  private currentState: FailoverState = FailoverState.NORMAL;
  private currentLevel: DegradationLevel = DegradationLevel.LEVEL_0;
  private recoveryCheckTimer?: ReturnType<typeof setInterval>;
  private recoverySuccessCount: number = 0;
  private lastAlertTime: Map<DegradationLevel, Date> = new Map();
  private degradationHistory: DegradationEvent[] = [];
  private recoveryHistory: RecoveryEvent[] = [];
  private alertHistory: FailoverAlert[] = [];
  private lastDegradationTime?: Date;

  constructor(config: Partial<DatabaseFailoverHandlerConfig> & {
    lagMonitor: ReplicationLagMonitor;
    trafficManager: ReadTrafficManager;
  }) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as DatabaseFailoverHandlerConfig;

    this.lagMonitor = this.config.lagMonitor;
    this.trafficManager = this.config.trafficManager;

    // 绑定延迟监控器事件
    this.setupLagMonitorListeners();
  }

  /**
   * 启动故障切换处理器
   */
  start(): void {
    // 启动延迟监控
    this.lagMonitor.start();

    // 启动恢复检查
    if (this.config.enableAutoRecovery) {
      this.startRecoveryCheck();
    }

    this.emit('started', { timestamp: new Date() });
  }

  /**
   * 停止故障切换处理器
   */
  stop(): void {
    this.lagMonitor.stop();
    this.stopRecoveryCheck();
    this.emit('stopped', { timestamp: new Date() });
  }

  /**
   * 手动设置降级级别
   */
  setDegradationLevel(level: DegradationLevel, reason: string = 'Manual override'): void {
    this.applyDegradationLevel(level, 'manual', reason);
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): {
    state: FailoverState;
    level: DegradationLevel;
    maxLag: number;
    averageLag: number;
    distribution: TrafficDistribution;
    replicaStatuses: Map<string, ReplicaStatus>;
    degradationCount: number;
    recoveryCount: number;
  } {
    const statuses = this.lagMonitor.getReplicaStatuses();
    return {
      state: this.currentState,
      level: this.currentLevel,
      maxLag: this.lagMonitor.getMaxLag(),
      averageLag: this.lagMonitor.getAverageLag(),
      distribution: this.trafficManager.getCurrentDistribution(),
      replicaStatuses: statuses,
      degradationCount: this.degradationHistory.length,
      recoveryCount: this.recoveryHistory.length,
    };
  }

  /**
   * 获取降级历史
   */
  getDegradationHistory(limit: number = 10): DegradationEvent[] {
    return this.degradationHistory.slice(-limit);
  }

  /**
   * 获取恢复历史
   */
  getRecoveryHistory(limit: number = 10): RecoveryEvent[] {
    return this.recoveryHistory.slice(-limit);
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit: number = 10): FailoverAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * 为读请求获取路由决策
   */
  routeReadRequest(context: ReadRequestContext): RoutingDecision {
    return this.trafficManager.selectNode(context);
  }

  /**
   * 获取延迟趋势分析
   */
  getLagTrend(host: string): LagTrendAnalysis {
    return this.lagMonitor.analyzeTrend(host);
  }

  /**
   * 设置节点健康状态
   */
  setNodeHealth(nodeId: string, healthy: boolean, latency?: number): void {
    this.trafficManager.updateNodeHealth(nodeId, healthy, latency);
  }

  /**
   * 重置到正常状态
   */
  reset(): void {
    this.currentLevel = DegradationLevel.LEVEL_0;
    this.currentState = FailoverState.NORMAL;
    this.trafficManager.setDegradationLevel(DegradationLevel.LEVEL_0, 'Manual reset');
    this.recoverySuccessCount = 0;
    this.lastDegradationTime = undefined;
    this.emit('reset', { timestamp: new Date() });
  }

  /**
   * 设置延迟监控器监听器
   */
  private setupLagMonitorListeners(): void {
    this.lagMonitor.on('level-change', (data) => {
      this.handleLevelChange(data);
    });

    this.lagMonitor.on('alert', (alertData) => {
      this.handleAlert(alertData);
    });

    this.lagMonitor.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * 处理级别变更
   */
  private handleLevelChange(data: {
    previousLevel: DegradationLevel;
    newLevel: DegradationLevel;
    maxLag: number;
    averageLag: number;
    timestamp: Date;
  }): void {
    const { previousLevel, newLevel, maxLag, averageLag, timestamp } = data;

    // 更新流量管理器
    const reason = this.getDegradationReason(newLevel, maxLag);
    this.trafficManager.setDegradationLevel(newLevel, reason);

    // 更新当前状态
    this.currentLevel = newLevel;
    if (newLevel > DegradationLevel.LEVEL_0) {
      this.currentState = FailoverState.DEGRADED;
      this.lastDegradationTime = timestamp;
    } else {
      this.currentState = FailoverState.NORMAL;
    }

    // 记录降级事件
    if (newLevel > previousLevel) {
      const event: DegradationEvent = {
        timestamp,
        previousLevel,
        newLevel,
        trigger: 'lag_threshold',
        maxLag,
        averageLag,
        affectedReplicas: this.getUnhealthyReplicas(),
        message: reason,
      };
      this.degradationHistory.push(event);
      this.emit('degradation', event);
    }

    // 记录恢复事件
    if (newLevel < previousLevel) {
      const recoveryTime = this.lastDegradationTime
        ? timestamp.getTime() - this.lastDegradationTime.getTime()
        : 0;

      const event: RecoveryEvent = {
        timestamp,
        previousLevel,
        newLevel,
        recoveryTime,
        maxLag,
        checksPassed: this.recoverySuccessCount,
        message: `Recovered from level ${previousLevel} to ${newLevel}`,
      };
      this.recoveryHistory.push(event);
      this.recoverySuccessCount = 0;
      this.emit('recovery', event);
    }
  }

  /**
   * 处理告警
   */
  private handleAlert(alertData: {
    level: string;
    message: string;
    lag: number;
    degradationLevel: DegradationLevel;
    timestamp: Date;
  }): void {
    const { level, message, lag, degradationLevel, timestamp } = alertData;

    // 检查告警冷却
    const lastAlert = this.lastAlertTime.get(degradationLevel);
    if (lastAlert && timestamp.getTime() - lastAlert.getTime() < this.config.alertCooldownPeriod) {
      return;
    }

    // 创建告警
    const alert: FailoverAlert = {
      id: `alert-${Date.now()}`,
      timestamp,
      severity: level as 'info' | 'warning' | 'critical' | 'severe',
      level: degradationLevel,
      message,
      maxLag: lag,
      replicas: Array.from(this.lagMonitor.getReplicaStatuses().values()),
    };

    // 添加趋势分析
    if (this.config.enableTrendPrediction) {
      const replicas = this.lagMonitor.getReplicaStatuses();
      for (const [host] of replicas) {
        alert.trend = this.lagMonitor.analyzeTrend(host);
        break; // 只取第一个从库的趋势
      }
    }

    // 记录告警
    this.alertHistory.push(alert);
    this.lastAlertTime.set(degradationLevel, timestamp);

    // 发送告警
    this.emit('alert', alert);

    // 调用告警处理器
    if (this.config.onAlert) {
      this.config.onAlert(alert);
    }
  }

  /**
   * 启动恢复检查
   */
  private startRecoveryCheck(): void {
    if (this.recoveryCheckTimer) {
      return;
    }

    this.recoveryCheckTimer = setInterval(() => {
      this.performRecoveryCheck();
    }, this.config.recoveryCheckInterval);
  }

  /**
   * 停止恢复检查
   */
  private stopRecoveryCheck(): void {
    if (this.recoveryCheckTimer) {
      clearInterval(this.recoveryCheckTimer);
      this.recoveryCheckTimer = undefined;
    }
  }

  /**
   * 执行恢复检查
   */
  private performRecoveryCheck(): void {
    // 只有在降级状态才检查恢复
    if (this.currentLevel === DegradationLevel.LEVEL_0) {
      return;
    }

    const maxLag = this.lagMonitor.getMaxLag();
    const currentLevel = this.currentLevel;

    // 检查是否可以恢复
    if (this.trafficManager.canRecoverFromDegradation(currentLevel, maxLag)) {
      this.recoverySuccessCount++;

      // 达到恢复阈值
      if (this.recoverySuccessCount >= this.config.recoverySuccessThreshold) {
        this.recoverToNextLevel();
      }
    } else {
      // 重置成功计数
      this.recoverySuccessCount = 0;
    }
  }

  /**
   * 恢复到下一级别
   */
  private recoverToNextLevel(): void {
    const nextLevel = this.currentLevel - 1;
    if (nextLevel >= DegradationLevel.LEVEL_0) {
      this.currentState = FailoverState.RECOVERING;
      this.emit('recovering', {
        previousLevel: this.currentLevel,
        targetLevel: nextLevel,
        timestamp: new Date(),
      });

      // 应用恢复
      this.applyDegradationLevel(nextLevel, 'auto_recovery', 'Automatic recovery');
    }
  }

  /**
   * 应用降级级别
   */
  private applyDegradationLevel(
    level: DegradationLevel,
    trigger: DegradationEvent['trigger'],
    reason: string
  ): void {
    const previousLevel = this.currentLevel;
    const maxLag = this.lagMonitor.getMaxLag();
    const averageLag = this.lagMonitor.getAverageLag();
    const timestamp = new Date();

    // 更新流量管理器
    this.trafficManager.setDegradationLevel(level, reason);

    // 更新当前状态
    this.currentLevel = level;
    if (level > DegradationLevel.LEVEL_0) {
      this.currentState = FailoverState.DEGRADED;
      if (!this.lastDegradationTime) {
        this.lastDegradationTime = timestamp;
      }
    } else {
      this.currentState = FailoverState.NORMAL;
      this.lastDegradationTime = undefined;
    }

    // 记录事件
    if (level > previousLevel) {
      const event: DegradationEvent = {
        timestamp,
        previousLevel,
        newLevel: level,
        trigger,
        maxLag,
        averageLag,
        affectedReplicas: this.getUnhealthyReplicas(),
        message: reason,
      };
      this.degradationHistory.push(event);
      this.emit('degradation', event);
    } else if (level < previousLevel) {
      const recoveryTime = this.lastDegradationTime
        ? timestamp.getTime() - this.lastDegradationTime.getTime()
        : 0;

      const event: RecoveryEvent = {
        timestamp,
        previousLevel,
        newLevel: level,
        recoveryTime,
        maxLag,
        checksPassed: this.recoverySuccessCount,
        message: reason,
      };
      this.recoveryHistory.push(event);
      this.recoverySuccessCount = 0;
      this.emit('recovery', event);

      if (level === DegradationLevel.LEVEL_0) {
        this.lastDegradationTime = undefined;
      }
    }
  }

  /**
   * 获取降级原因
   */
  private getDegradationReason(level: DegradationLevel, lag: number): string {
    switch (level) {
      case DegradationLevel.LEVEL_1:
        return `Replication lag (${lag}s) exceeded warning threshold - pausing replica analysis queries`;
      case DegradationLevel.LEVEL_2:
        return `Replication lag (${lag}s) exceeded critical threshold - reducing replica traffic to 20%`;
      case DegradationLevel.LEVEL_3:
        return `Replication lag (${lag}s) exceeded severe threshold - cutting off all replica traffic`;
      default:
        return 'Normal operation';
    }
  }

  /**
   * 获取不健康的从库列表
   */
  private getUnhealthyReplicas(): string[] {
    const unhealthy: string[] = [];
    const statuses = this.lagMonitor.getReplicaStatuses();
    // 使用默认的 warning 阈值 10 秒
    const warningThreshold = 10;

    for (const [key, status] of statuses) {
      if (!status.ioRunning || !status.sqlRunning || status.secondsBehindMaster > warningThreshold) {
        unhealthy.push(key);
      }
    }
    return unhealthy;
  }

  /**
   * 获取配置
   */
  getConfig(): {
    enableAutoRecovery: boolean;
    recoveryCheckInterval: number;
    recoverySuccessThreshold: number;
    alertCooldownPeriod: number;
    enableTrendPrediction: boolean;
  } {
    return {
      enableAutoRecovery: this.config.enableAutoRecovery,
      recoveryCheckInterval: this.config.recoveryCheckInterval,
      recoverySuccessThreshold: this.config.recoverySuccessThreshold,
      alertCooldownPeriod: this.config.alertCooldownPeriod,
      enableTrendPrediction: this.config.enableTrendPrediction,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<Pick<DatabaseFailoverHandlerConfig,
    'enableAutoRecovery' | 'recoveryCheckInterval' |
    'recoverySuccessThreshold' | 'alertCooldownPeriod' | 'enableTrendPrediction'
  >>): void {
    Object.assign(this.config, updates);

    // 如果恢复检查间隔变化，重启检查
    if ('recoveryCheckInterval' in updates && this.config.enableAutoRecovery) {
      this.stopRecoveryCheck();
      this.startRecoveryCheck();
    }

    this.emit('config-updated', { updates, timestamp: new Date() });
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    uptime: number;
    currentState: FailoverState;
    currentLevel: DegradationLevel;
    totalDegradations: number;
    totalRecoveries: number;
    totalAlerts: number;
    averageRecoveryTime: number;
    currentLag: {
      max: number;
      average: number;
    };
    healthyReplicas: number;
    totalReplicas: number;
  } {
    const totalRecoveryTime = this.recoveryHistory.reduce(
      (sum, event) => sum + event.recoveryTime,
      0
    );
    const statuses = this.lagMonitor.getReplicaStatuses();
    let healthyCount = 0;
    for (const status of statuses.values()) {
      if (status.ioRunning && status.sqlRunning && status.secondsBehindMaster < 10) {
        healthyCount++;
      }
    }

    return {
      uptime: Date.now() - (this.degradationHistory[0]?.timestamp?.getTime() || Date.now()),
      currentState: this.currentState,
      currentLevel: this.currentLevel,
      totalDegradations: this.degradationHistory.length,
      totalRecoveries: this.recoveryHistory.length,
      totalAlerts: this.alertHistory.length,
      averageRecoveryTime: this.recoveryHistory.length > 0
        ? totalRecoveryTime / this.recoveryHistory.length
        : 0,
      currentLag: {
        max: this.lagMonitor.getMaxLag(),
        average: this.lagMonitor.getAverageLag(),
      },
      healthyReplicas: healthyCount,
      totalReplicas: statuses.size,
    };
  }
}