/**
 * MySQL 数据库故障切换处理器
 *
 * 功能：
 * 1. 降级级别管理（L1/L2/L3）
 * 2. 自动恢复检测
 * 3. 告警通知
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  ReplicationLagMonitor,
  DegradationLevel,
  LagLevel,
  ReplicaStatus,
  LagTrendAnalysis,
} from './ReplicationLagMonitor';
import { ReadTrafficManager, RoutingDecision, ReadRequestContext, TrafficDistribution } from './ReadTrafficManager';
import { DbFailoverAlertTimeRepository } from '../../repositories/DbFailoverAlertTimeRepository';
import { DbDegradationEventRepository } from '../../repositories/DbDegradationEventRepository';
import { DbRecoveryEventRepository } from '../../repositories/DbRecoveryEventRepository';
import { DbFailoverAlertRepository } from '../../repositories/DbFailoverAlertRepository';

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
  private alertTimeRepo: DbFailoverAlertTimeRepository;
  private degradationEventRepo: DbDegradationEventRepository;
  private recoveryEventRepo: DbRecoveryEventRepository;
  private failoverAlertRepo: DbFailoverAlertRepository;
  private lastDegradationTime?: Date;
  private tenantId?: string;

  constructor(
    config: Partial<DatabaseFailoverHandlerConfig> & {
      lagMonitor: ReplicationLagMonitor;
      trafficManager: ReadTrafficManager;
    },
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId?: string,
  ) {
    super();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as DatabaseFailoverHandlerConfig;

    this.lagMonitor = this.config.lagMonitor;
    this.trafficManager = this.config.trafficManager;
    this.tenantId = tenantId;
    this.alertTimeRepo = new DbFailoverAlertTimeRepository(db);
    this.degradationEventRepo = new DbDegradationEventRepository(db);
    this.recoveryEventRepo = new DbRecoveryEventRepository(db);
    this.failoverAlertRepo = new DbFailoverAlertRepository(db);

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
  async getCurrentState(): Promise<{
    state: FailoverState;
    level: DegradationLevel;
    maxLag: number;
    averageLag: number;
    distribution: TrafficDistribution;
    replicaStatuses: Map<string, ReplicaStatus>;
    degradationCount: number;
    recoveryCount: number;
  }> {
    const statuses = await this.lagMonitor.getReplicaStatuses();
    const degradationHistory = await this.degradationEventRepo.findRecent(1000, this.tenantId);
    const recoveryHistory = await this.recoveryEventRepo.findRecent(1000, this.tenantId);
    return {
      state: this.currentState,
      level: this.currentLevel,
      maxLag: await this.lagMonitor.getMaxLag(),
      averageLag: await this.lagMonitor.getAverageLag(),
      distribution: this.trafficManager.getCurrentDistribution(),
      replicaStatuses: statuses,
      degradationCount: degradationHistory.length,
      recoveryCount: recoveryHistory.length,
    };
  }

  /**
   * 获取降级历史
   */
  async getDegradationHistory(limit: number = 10): Promise<DegradationEvent[]> {
    const entities = await this.degradationEventRepo.findRecent(limit, this.tenantId);
    return entities.map((e) => ({
      timestamp: e.eventTime,
      previousLevel: e.previousLevel as DegradationLevel,
      newLevel: e.newLevel as DegradationLevel,
      trigger: e.triggerType as DegradationEvent['trigger'],
      maxLag: e.maxLag,
      averageLag: e.averageLag,
      affectedReplicas: e.affectedReplicas,
      message: e.message || '',
    }));
  }

  /**
   * 获取恢复历史
   */
  async getRecoveryHistory(limit: number = 10): Promise<RecoveryEvent[]> {
    const entities = await this.recoveryEventRepo.findRecent(limit, this.tenantId);
    return entities.map((e) => ({
      timestamp: e.eventTime,
      previousLevel: e.previousLevel as DegradationLevel,
      newLevel: e.newLevel as DegradationLevel,
      recoveryTime: e.recoveryTimeMs,
      maxLag: e.maxLag,
      checksPassed: e.checksPassed,
      message: e.message || '',
    }));
  }

  /**
   * 获取告警历史
   */
  async getAlertHistory(limit: number = 10): Promise<FailoverAlert[]> {
    const entities = await this.failoverAlertRepo.findRecent(limit, this.tenantId);
    return entities.map((e) => ({
      id: e.id,
      timestamp: e.alertTime,
      severity: e.severity as FailoverAlert['severity'],
      level: e.degradationLevel as DegradationLevel,
      message: e.message || '',
      maxLag: e.maxLag,
      replicas: e.replicas,
      trend: e.trend as LagTrendAnalysis | undefined,
    }));
  }

  /**
   * 为读请求获取路由决策
   */
  async routeReadRequest(context: ReadRequestContext): Promise<RoutingDecision> {
    return this.trafficManager.selectNode(context);
  }

  /**
   * 获取延迟趋势分析
   */
  async getLagTrend(host: string): Promise<LagTrendAnalysis> {
    return this.lagMonitor.analyzeTrend(host);
  }

  /**
   * 设置节点健康状态
   */
  async setNodeHealth(nodeId: string, healthy: boolean, latency?: number): Promise<void> {
    await this.trafficManager.updateNodeHealth(nodeId, healthy, latency);
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
  private async handleLevelChange(data: {
    previousLevel: DegradationLevel;
    newLevel: DegradationLevel;
    maxLag: number;
    averageLag: number;
    timestamp: Date;
  }): Promise<void> {
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
      const affectedReplicas = await this.getUnhealthyReplicas();
      await this.degradationEventRepo.create({
        id: `deg-${Date.now()}-${randomUUID().slice(0, 8)}`,
        event_time: timestamp,
        previous_level: previousLevel,
        new_level: newLevel,
        trigger_type: 'lag_threshold',
        max_lag: maxLag,
        average_lag: averageLag,
        affected_replicas: affectedReplicas,
        message: reason,
        tenant_id: this.tenantId || null,
      });
      const event: DegradationEvent = {
        timestamp,
        previousLevel,
        newLevel,
        trigger: 'lag_threshold',
        maxLag,
        averageLag,
        affectedReplicas,
        message: reason,
      };
      this.emit('degradation', event);
    }

    // 记录恢复事件
    if (newLevel < previousLevel) {
      const recoveryTime = this.lastDegradationTime
        ? timestamp.getTime() - this.lastDegradationTime.getTime()
        : 0;

      await this.recoveryEventRepo.create({
        id: `rec-${Date.now()}-${randomUUID().slice(0, 8)}`,
        event_time: timestamp,
        previous_level: previousLevel,
        new_level: newLevel,
        recovery_time_ms: recoveryTime,
        max_lag: maxLag,
        checks_passed: this.recoverySuccessCount,
        message: `Recovered from level ${previousLevel} to ${newLevel}`,
        tenant_id: this.tenantId || null,
      });
      const event: RecoveryEvent = {
        timestamp,
        previousLevel,
        newLevel,
        recoveryTime,
        maxLag,
        checksPassed: this.recoverySuccessCount,
        message: `Recovered from level ${previousLevel} to ${newLevel}`,
      };
      this.recoverySuccessCount = 0;
      this.emit('recovery', event);
    }
  }

  /**
   * 处理告警
   */
  private async handleAlert(alertData: {
    level: string;
    message: string;
    lag: number;
    degradationLevel: DegradationLevel;
    timestamp: Date;
  }): Promise<void> {
    const { level, message, lag, degradationLevel, timestamp } = alertData;

    // 检查告警冷却
    const lastAlertEntity = await this.alertTimeRepo.findByLevel(degradationLevel, this.tenantId);
    if (lastAlertEntity && timestamp.getTime() - lastAlertEntity.lastAlertTime.getTime() < this.config.alertCooldownPeriod) {
      return;
    }

    // 创建告警
    const replicas = await this.lagMonitor.getReplicaStatuses();
    const alertId = `alert-${Date.now()}-${randomUUID().slice(0, 8)}`;
    let trendData: Record<string, any> = {};

    // 添加趋势分析
    if (this.config.enableTrendPrediction) {
      for (const [host] of replicas) {
        trendData = await this.lagMonitor.analyzeTrend(host);
        break; // 只取第一个从库的趋势
      }
    }

    await this.failoverAlertRepo.create({
      id: alertId,
      alert_time: timestamp,
      severity: level,
      degradation_level: degradationLevel,
      message,
      max_lag: lag,
      replicas: Array.from(replicas.values()),
      trend: trendData,
      tenant_id: this.tenantId || null,
    });

    // 更新最后告警时间
    await this.alertTimeRepo.upsertAlertTime(degradationLevel, timestamp, this.tenantId);

    const alert: FailoverAlert = {
      id: alertId,
      timestamp,
      severity: level as 'info' | 'warning' | 'critical' | 'severe',
      level: degradationLevel,
      message,
      maxLag: lag,
      replicas: Array.from(replicas.values()),
      trend: trendData as LagTrendAnalysis,
    };

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
  private async performRecoveryCheck(): Promise<void> {
    // 只有在降级状态才检查恢复
    if (this.currentLevel === DegradationLevel.LEVEL_0) {
      return;
    }

    const maxLag = await this.lagMonitor.getMaxLag();
    const currentLevel = this.currentLevel;

    // 检查是否可以恢复
    if (await this.trafficManager.canRecoverFromDegradation(currentLevel, maxLag)) {
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
  private async applyDegradationLevel(
    level: DegradationLevel,
    trigger: DegradationEvent['trigger'],
    reason: string
  ): Promise<void> {
    const previousLevel = this.currentLevel;
    const maxLag = await this.lagMonitor.getMaxLag();
    const averageLag = await this.lagMonitor.getAverageLag();
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
      const affectedReplicas = await this.getUnhealthyReplicas();
      await this.degradationEventRepo.create({
        id: `deg-${Date.now()}-${randomUUID().slice(0, 8)}`,
        event_time: timestamp,
        previous_level: previousLevel,
        new_level: level,
        trigger_type: trigger,
        max_lag: maxLag,
        average_lag: averageLag,
        affected_replicas: affectedReplicas,
        message: reason,
        tenant_id: this.tenantId || null,
      });
      const event: DegradationEvent = {
        timestamp,
        previousLevel,
        newLevel: level,
        trigger,
        maxLag,
        averageLag,
        affectedReplicas,
        message: reason,
      };
      this.emit('degradation', event);
    } else if (level < previousLevel) {
      const recoveryTime = this.lastDegradationTime
        ? timestamp.getTime() - this.lastDegradationTime.getTime()
        : 0;

      await this.recoveryEventRepo.create({
        id: `rec-${Date.now()}-${randomUUID().slice(0, 8)}`,
        event_time: timestamp,
        previous_level: previousLevel,
        new_level: level,
        recovery_time_ms: recoveryTime,
        max_lag: maxLag,
        checks_passed: this.recoverySuccessCount,
        message: reason,
        tenant_id: this.tenantId || null,
      });
      const event: RecoveryEvent = {
        timestamp,
        previousLevel,
        newLevel: level,
        recoveryTime,
        maxLag,
        checksPassed: this.recoverySuccessCount,
        message: reason,
      };
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
  private async getUnhealthyReplicas(): Promise<string[]> {
    const unhealthy: string[] = [];
    const statuses = await this.lagMonitor.getReplicaStatuses();
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
  async getStats(): Promise<{
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
  }> {
    const recoveryHistory = await this.recoveryEventRepo.findRecent(1000, this.tenantId);
    const degradationHistory = await this.degradationEventRepo.findRecent(1, this.tenantId);
    const alertHistory = await this.failoverAlertRepo.findRecent(1000, this.tenantId);
    const totalRecoveryTime = recoveryHistory.reduce(
      (sum, event) => sum + event.recoveryTimeMs,
      0
    );
    const statuses = await this.lagMonitor.getReplicaStatuses();
    let healthyCount = 0;
    for (const status of statuses.values()) {
      if (status.ioRunning && status.sqlRunning && status.secondsBehindMaster < 10) {
        healthyCount++;
      }
    }

    return {
      uptime: Date.now() - (degradationHistory[0]?.eventTime?.getTime() || Date.now()),
      currentState: this.currentState,
      currentLevel: this.currentLevel,
      totalDegradations: degradationHistory.length,
      totalRecoveries: recoveryHistory.length,
      totalAlerts: alertHistory.length,
      averageRecoveryTime: recoveryHistory.length > 0
        ? totalRecoveryTime / recoveryHistory.length
        : 0,
      currentLag: {
        max: await this.lagMonitor.getMaxLag(),
        average: await this.lagMonitor.getAverageLag(),
      },
      healthyReplicas: healthyCount,
      totalReplicas: statuses.size,
    };
  }
}