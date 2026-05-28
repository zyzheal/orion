/**
 * 效能事件处理器
 *
 * 职责：
 * - 处理 pipeline.run.completed 事件
 * - 处理 deployment.completed/failed 事件
 * - 记录事件到本地存储
 * - 触发 ClickHouse 同步
 */

import { CloudEvent, EventContext, EventBus, EventHandler } from '@orion/event-bus';
import { v4 as uuidv4 } from 'uuid';
import { DoraMetricsService } from './DoraMetricsService';
import { ClickHouseSync } from './ClickHouseSync';
import {
  PipelineCompletionRecord,
  DeploymentRecord,
  EfficiencyMetricsRow,
  TimeWindow,
} from './types';
import { PipelineRunEventData } from '../../events/types';
import {
import pino from 'pino';

const logger = pino({ name: 'LEvent-LHandler' });
  DeploymentCompletedEventData,
  DeploymentFailedEventData,
} from '../../events/types/deployment';

/**
 * 效能事件处理器配置
 */
export interface EfficiencyEventHandlerConfig {
  /** 事件总线实例 */
  eventBus?: EventBus;
  /** DORA 指标计算服务 */
  doraMetricsService: DoraMetricsService;
  /** ClickHouse 同步服务 */
  clickHouseSync?: ClickHouseSync;
  /** 流名称 */
  streamName?: string;
  /** 订阅组名称 */
  consumerGroup?: string;
  /** 自动同步间隔（毫秒，0 表示手动同步） */
  autoSyncInterval?: number;
}

/**
 * 本地存储接口（可扩展为 Redis 或 DB）
 */
export interface LocalStorage {
  /** 保存 Pipeline 完成记录 */
  savePipelineRecord(record: PipelineCompletionRecord): Promise<void>;
  /** 获取 Pipeline 完成记录 */
  getPipelineRecords(filter?: { tenantId?: string; since?: Date }): Promise<PipelineCompletionRecord[]>;
  /** 保存部署记录 */
  saveDeploymentRecord(record: DeploymentRecord): Promise<void>;
  /** 获取部署记录 */
  getDeploymentRecords(filter?: { tenantId?: string; since?: Date }): Promise<DeploymentRecord[]>;
  /** 获取待同步的 Pipeline 记录 */
  getUnsyncedPipelineRecords(limit?: number): Promise<PipelineCompletionRecord[]>;
  /** 获取待同步的部署记录 */
  getUnsyncedDeploymentRecords(limit?: number): Promise<DeploymentRecord[]>;
  /** 标记 Pipeline 记录为已同步 */
  markPipelineSynced(id: string): Promise<void>;
  /** 标记部署记录为已同步 */
  markDeploymentSynced(id: string): Promise<void>;
}

/**
 * 内存本地存储实现
 */
export class InMemoryLocalStorage implements LocalStorage {
  private pipelineRecords: Map<string, PipelineCompletionRecord> = new Map();
  private deploymentRecords: Map<string, DeploymentRecord> = new Map();

  async savePipelineRecord(record: PipelineCompletionRecord): Promise<void> {
    this.pipelineRecords.set(record.id, record);
  }

  async getPipelineRecords(filter?: { tenantId?: string; since?: Date }): Promise<PipelineCompletionRecord[]> {
    let records = Array.from(this.pipelineRecords.values());
    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.since) {
      records = records.filter((r) => r.completedAt >= filter.since!);
    }
    return records;
  }

  async getUnsyncedPipelineRecords(limit: number = 100): Promise<PipelineCompletionRecord[]> {
    return Array.from(this.pipelineRecords.values())
      .filter((r) => !r.syncedToClickHouse)
      .slice(0, limit);
  }

  async saveDeploymentRecord(record: DeploymentRecord): Promise<void> {
    this.deploymentRecords.set(record.id, record);
  }

  async getDeploymentRecords(filter?: { tenantId?: string; since?: Date }): Promise<DeploymentRecord[]> {
    let records = Array.from(this.deploymentRecords.values());
    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.since) {
      records = records.filter((r) => r.deployedAt >= filter.since!);
    }
    return records;
  }

  async getUnsyncedDeploymentRecords(limit: number = 100): Promise<DeploymentRecord[]> {
    return Array.from(this.deploymentRecords.values())
      .filter((r) => !r.syncedToClickHouse)
      .slice(0, limit);
  }

  async markPipelineSynced(id: string): Promise<void> {
    const record = this.pipelineRecords.get(id);
    if (record) {
      record.syncedToClickHouse = true;
      record.syncedAt = new Date();
    }
  }

  async markDeploymentSynced(id: string): Promise<void> {
    const record = this.deploymentRecords.get(id);
    if (record) {
      record.syncedToClickHouse = true;
      record.syncedAt = new Date();
    }
  }
}

/**
 * 效能事件处理器
 */
export class EfficiencyEventHandler {
  private eventBus?: EventBus;
  private doraMetricsService: DoraMetricsService;
  private clickHouseSync?: ClickHouseSync;
  private localStorage: LocalStorage;
  private streamName: string;
  private consumerGroup: string;
  private subscriptions: Array<() => Promise<void>> = [];
  private autoSyncInterval?: number;
  private syncTimer?: ReturnType<typeof setInterval>;

  constructor(config: EfficiencyEventHandlerConfig) {
    this.eventBus = config.eventBus;
    this.doraMetricsService = config.doraMetricsService;
    this.clickHouseSync = config.clickHouseSync;
    this.localStorage = new InMemoryLocalStorage();
    this.streamName = config.streamName || 'orion-platform-stream';
    this.consumerGroup = config.consumerGroup || 'efficiency-consumers';
    this.autoSyncInterval = config.autoSyncInterval;
  }

  /**
   * 设置本地存储（可用于测试或替换为持久化存储）
   */
  setLocalStorage(storage: LocalStorage): void {
    this.localStorage = storage;
  }

  /**
   * 获取本地存储
   */
  getLocalStorage(): LocalStorage {
    return this.localStorage;
  }

  /**
   * 启动事件监听
   */
  async start(): Promise<void> {
    // 订阅 Pipeline 完成事件
    await this.subscribeToPipelineEvents();

    // 订阅部署事件
    await this.subscribeToDeploymentEvents();

    // 启动自动同步定时器
    if (this.autoSyncInterval && this.autoSyncInterval > 0) {
      this.syncTimer = setInterval(() => {
        this.flushToClickHouse().catch((err) => {
          logger.error('[EfficiencyEventHandler] Auto sync failed:', err);
        });
      }, this.autoSyncInterval);
    }

    logger.info('[EfficiencyEventHandler] Event listeners started');
  }

  /**
   * 停止事件监听
   */
  async stop(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    for (const unsubscribe of this.subscriptions) {
      try {
        await unsubscribe();
      } catch (error) {
        logger.error('[EfficiencyEventHandler] Error unsubscribing:', error);
      }
    }

    this.subscriptions = [];
    logger.info('[EfficiencyEventHandler] Event listeners stopped');
  }

  /**
   * 处理 pipeline.run.completed 事件
   */
  async handlePipelineCompleted(
    event: CloudEvent<PipelineRunEventData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[EfficiencyEventHandler] Processing pipeline.run.completed:', event.data.runId);

    const record: PipelineCompletionRecord = {
      id: uuidv4(),
      runId: event.data.runId,
      pipelineId: event.data.pipelineId,
      status: event.data.status === 'success' || event.data.status === 'completed' ? 'success' : 'failed',
      triggerType: event.data.triggerType,
      gitRef: event.data.gitRef,
      gitSha: event.data.gitSha,
      durationMs: event.data.durationMs || 0,
      completedAt: new Date(event.data.timestamp),
      tenantId: event.tenantId,
      syncedToClickHouse: false,
    };

    // 保存到本地存储
    await this.localStorage.savePipelineRecord(record);

    // 触发 ClickHouse 同步
    await this.syncToClickHouse();

    // 发布效能更新事件
    await this.publishEfficiencyUpdate(record.tenantId || 'default');
  }

  /**
   * 处理 pipeline.run.failed 事件
   */
  async handlePipelineFailed(
    event: CloudEvent<PipelineRunEventData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[EfficiencyEventHandler] Processing pipeline.run.failed:', event.data.runId);

    const record: PipelineCompletionRecord = {
      id: uuidv4(),
      runId: event.data.runId,
      pipelineId: event.data.pipelineId,
      status: 'failed',
      triggerType: event.data.triggerType,
      gitRef: event.data.gitRef,
      gitSha: event.data.gitSha,
      durationMs: event.data.durationMs || 0,
      completedAt: new Date(event.data.timestamp),
      tenantId: event.tenantId,
      syncedToClickHouse: false,
    };

    await this.localStorage.savePipelineRecord(record);
    await this.syncToClickHouse();
  }

  /**
   * 处理 deployment.completed 事件
   */
  async handleDeploymentCompleted(
    event: CloudEvent<DeploymentCompletedEventData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[EfficiencyEventHandler] Processing deployment.completed:', event.data.deploymentId);

    const record: DeploymentRecord = {
      id: uuidv4(),
      deploymentId: event.data.deploymentId,
      service: event.data.service,
      environment: event.data.environment,
      status: 'success',
      version: event.data.version,
      durationMs: event.data.durationMs,
      deployedAt: new Date(event.data.timestamp),
      tenantId: event.tenantId,
      syncedToClickHouse: false,
    };

    await this.localStorage.saveDeploymentRecord(record);
    await this.syncToClickHouse();
    await this.publishEfficiencyUpdate(record.tenantId || 'default');
  }

  /**
   * 处理 deployment.failed 事件
   */
  async handleDeploymentFailed(
    event: CloudEvent<DeploymentFailedEventData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[EfficiencyEventHandler] Processing deployment.failed:', event.data.deploymentId);

    const record: DeploymentRecord = {
      id: uuidv4(),
      deploymentId: event.data.deploymentId,
      service: event.data.service,
      environment: event.data.environment,
      status: 'failed',
      deployedAt: new Date(event.data.timestamp),
      tenantId: event.tenantId,
      syncedToClickHouse: false,
    };

    await this.localStorage.saveDeploymentRecord(record);
    await this.syncToClickHouse();
  }

  /**
   * 处理 deployment.rolled_back 事件
   */
  async handleDeploymentRolledBack(
    event: CloudEvent<any>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[EfficiencyEventHandler] Processing deployment.rolled_back:', event.data.deploymentId);

    const record: DeploymentRecord = {
      id: uuidv4(),
      deploymentId: event.data.deploymentId,
      service: event.data.service,
      environment: event.data.environment,
      status: 'rolled_back',
      version: event.data.rollbackToVersion,
      deployedAt: new Date(event.data.timestamp),
      tenantId: event.tenantId,
      syncedToClickHouse: false,
      recoveryTimeMs: event.data.recoveryTimeMs,
    };

    await this.localStorage.saveDeploymentRecord(record);
    await this.syncToClickHouse();
  }

  /**
   * 获取 DORA 指标报告
   */
  async getDoraReport(
    tenantId: string,
    window: TimeWindow = 'week',
    size: number = 1,
    referenceDate?: Date
  ): Promise<any> {
    const windowConfig = this.doraMetricsService.buildTimeWindow(window, size, referenceDate);
    const pipelineRecords = await this.localStorage.getPipelineRecords({ tenantId, since: windowConfig.start });
    const deployments = await this.localStorage.getDeploymentRecords({ tenantId, since: windowConfig.start });

    return this.doraMetricsService.generateReport(tenantId, pipelineRecords, deployments, windowConfig);
  }

  /**
   * 同步到 ClickHouse
   */
  private async syncToClickHouse(): Promise<void> {
    if (!this.clickHouseSync) {
      return; // 没有配置 ClickHouse，降级到本地存储
    }

    try {
      // 获取待同步的记录
      const unsyncedPipeline = await this.localStorage.getUnsyncedPipelineRecords(50);
      const unsyncedDeployment = await this.localStorage.getUnsyncedDeploymentRecords(50);

      if (unsyncedPipeline.length > 0) {
        await this.clickHouseSync.syncPipelineRecords(unsyncedPipeline);
        for (const record of unsyncedPipeline) {
          await this.localStorage.markPipelineSynced(record.id);
        }
      }

      if (unsyncedDeployment.length > 0) {
        await this.clickHouseSync.syncDeploymentRecords(unsyncedDeployment);
        for (const record of unsyncedDeployment) {
          await this.localStorage.markDeploymentSynced(record.id);
        }
      }
    } catch (error) {
      logger.error('[EfficiencyEventHandler] Failed to sync to ClickHouse:', error);
      // 降级到本地存储，不抛出错误
    }
  }

  /**
   * 手动刷新待同步数据到 ClickHouse
   */
  async flushToClickHouse(): Promise<void> {
    if (!this.clickHouseSync) {
      return;
    }
    await this.clickHouseSync.flushPendingRecords();
  }

  /**
   * 发布效能更新事件
   */
  private async publishEfficiencyUpdate(tenantId: string): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    try {
      const event = new CloudEvent({
        type: 'efficiency.metrics.updated',
        source: 'orion-platform-service',
        data: {
          tenantId,
          updatedAt: new Date().toISOString(),
        },
        extensions: {
          tenantId,
        },
      });

      await this.eventBus.publish(event);
    } catch (error) {
      logger.error('[EfficiencyEventHandler] Failed to publish efficiency update:', error);
    }
  }

  /**
   * 订阅 Pipeline 事件
   */
  private async subscribeToPipelineEvents(): Promise<void> {
    if (!this.eventBus) {
      logger.warn('[EfficiencyEventHandler] EventBus not configured, skipping pipeline subscription');
      return;
    }

    const subCompleted = await this.eventBus.subscribe<PipelineRunEventData>(
      'pipeline.run.completed',
      this.handlePipelineCompleted.bind(this),
      {
        streamName: this.streamName,
        durableName: `${this.consumerGroup}-pipeline-completed`,
        autoAck: false,
      }
    );
    this.subscriptions.push(async () => { await subCompleted.unsubscribe(); });

    const subFailed = await this.eventBus.subscribe<PipelineRunEventData>(
      'pipeline.run.failed',
      this.handlePipelineFailed.bind(this),
      {
        streamName: this.streamName,
        durableName: `${this.consumerGroup}-pipeline-failed`,
        autoAck: false,
      }
    );
    this.subscriptions.push(async () => { await subFailed.unsubscribe(); });

    logger.info('[EfficiencyEventHandler] Subscribed to pipeline events');
  }

  /**
   * 订阅部署事件
   */
  private async subscribeToDeploymentEvents(): Promise<void> {
    if (!this.eventBus) {
      logger.warn('[EfficiencyEventHandler] EventBus not configured, skipping deployment subscription');
      return;
    }

    const subCompleted = await this.eventBus.subscribe<DeploymentCompletedEventData>(
      'deployment.completed',
      this.handleDeploymentCompleted.bind(this),
      {
        streamName: this.streamName,
        durableName: `${this.consumerGroup}-deployment-completed`,
        autoAck: false,
      }
    );
    this.subscriptions.push(async () => { await subCompleted.unsubscribe(); });

    const subFailed = await this.eventBus.subscribe<DeploymentFailedEventData>(
      'deployment.failed',
      this.handleDeploymentFailed.bind(this),
      {
        streamName: this.streamName,
        durableName: `${this.consumerGroup}-deployment-failed`,
        autoAck: false,
      }
    );
    this.subscriptions.push(async () => { await subFailed.unsubscribe(); });

    const subRolledBack = await this.eventBus.subscribe<any>(
      'deployment.rolled_back',
      this.handleDeploymentRolledBack.bind(this),
      {
        streamName: this.streamName,
        durableName: `${this.consumerGroup}-deployment-rolled-back`,
        autoAck: false,
      }
    );
    this.subscriptions.push(async () => { await subRolledBack.unsubscribe(); });

    logger.info('[EfficiencyEventHandler] Subscribed to deployment events');
  }
}
