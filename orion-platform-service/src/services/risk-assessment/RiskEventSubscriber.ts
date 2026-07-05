/**
 * 风险事件订阅器
 *
 * 职责：
 * - 订阅 pipeline.run.completed 事件
 * - 订阅 code.pr.merged 事件
 * - 实时风险评估
 * - 自动触发风险评估
 */

import { CloudEvent, EventContext, Subscription } from '@orion/event-bus';
import {
  RiskAssessmentService,
} from './RiskAssessmentService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('risk-event-subscriber');
import {
  PipelineCompletedForRiskData,
  CodePRMergedData,
  RiskAssessmentEventData,
} from './types';

/**
 * 风险事件订阅器配置
 */
export interface RiskEventSubscriberConfig {
  /** EventBus 实例 */
  eventBus: any;
  /** 风险评估服务 */
  riskAssessmentService: RiskAssessmentService;
  /** 流名称 */
  streamName?: string;
  /** 订阅组名称 */
  consumerGroup?: string;
  /** 是否启用自动评估 */
  autoAssessEnabled?: boolean;
}

/**
 * 风险事件订阅器
 */
export class RiskEventSubscriber {
  private eventBus: any;
  private riskAssessmentService: RiskAssessmentService;
  private streamName: string;
  private consumerGroup: string;
  private autoAssessEnabled: boolean;
  private subscriptions: Subscription[] = [];
  private isRunning: boolean = false;

  constructor(config: RiskEventSubscriberConfig) {
    this.eventBus = config.eventBus;
    this.riskAssessmentService = config.riskAssessmentService;
    this.streamName = config.streamName || 'orion-pipeline-stream';
    this.consumerGroup = config.consumerGroup || 'risk-assessment-consumers';
    this.autoAssessEnabled = config.autoAssessEnabled !== false;
  }

  /**
   * 启动事件订阅
   */
  async subscribeToEvents(): Promise<void> {
    if (!this.eventBus) {
      logger.warn('[RiskEventSubscriber] EventBus not configured, skipping subscription');
      return;
    }

    logger.info('[RiskEventSubscriber] Subscribing to risk-related events...');

    // 订阅 pipeline.run.completed 事件
    await this.subscribe('pipeline.run.completed', this.handlePipelineEvent.bind(this));

    // 订阅 pipeline.run.failed 事件
    await this.subscribe('pipeline.run.failed', this.handlePipelineFailedEvent.bind(this));

    // 订阅 code.pr.merged 事件
    await this.subscribe('code.pr.merged', this.handleCodePRMergedEvent.bind(this));

    // 订阅 deployment.started 事件
    await this.subscribe('deployment.started', this.handleDeploymentEvent.bind(this));

    this.isRunning = true;
    logger.info('[RiskEventSubscriber] Event subscriptions active');
  }

  /**
   * 停止事件订阅
   */
  async unsubscribeFromEvents(): Promise<void> {
    for (const subscription of this.subscriptions) {
      try {
        await subscription.unsubscribe();
      } catch (error) {
        logger.error('[RiskEventSubscriber] Error unsubscribing:', error);
      }
    }
    this.subscriptions = [];
    this.isRunning = false;
    logger.info('[RiskEventSubscriber] Event subscriptions removed');
  }

  /**
   * 处理 Pipeline 完成事件
   */
  async handlePipelineEvent(
    event: CloudEvent<PipelineCompletedForRiskData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[RiskEventSubscriber] Processing pipeline.run.completed:', event.data.runId);

    if (!this.autoAssessEnabled) {
      logger.info('[RiskEventSubscriber] Auto-assessment disabled, skipping');
      return;
    }

    try {
      // 构建部署风险评估数据
      const deploymentRisk = {
        changeScope: [],
        changeSize: {
          filesChanged: 0,
          linesChanged: 0,
        },
        timeRisk: {
          isWeekend: this.isWeekend(new Date(event.data.timestamp)),
          isAfterHours: this.isAfterHours(new Date(event.data.timestamp)),
          isHoliday: false,
          isFriday: this.isFriday(new Date(event.data.timestamp)),
        },
        dependencyRisk: {
          totalDependencies: 0,
          unhealthyDependencies: 0,
          criticalDependencies: [],
        },
        historicalRisk: {
          recentFailureRate: event.data.status === 'failed' ? 1.0 : 0.0,
          recentIncidents: 0,
          averageMTTR: 0,
        },
      };

      // 执行风险评估
      const assessment = await this.riskAssessmentService.assessDeploymentRisk({
        deploymentId: event.data.runId,
        deploymentRisk,
        tenantId: event.tenantId,
        runHealthChecks: true,
        healthCheckParams: {
          pipelineStatus: event.data.status,
        },
      });

      logger.info(
        `[RiskEventSubscriber] Risk assessment completed for ${event.data.runId}: ` +
        `Score=${assessment.riskScore}, Level=${assessment.riskLevel}`
      );
    } catch (error) {
      logger.error('[RiskEventSubscriber] Failed to process pipeline event:', error);
    }
  }

  /**
   * 处理 Pipeline 失败事件
   */
  async handlePipelineFailedEvent(
    event: CloudEvent<PipelineCompletedForRiskData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[RiskEventSubscriber] Processing pipeline.run.failed:', event.data.runId);

    // Pipeline 失败时自动触发风险评估（标记为高风险）
    try {
      const deploymentRisk = {
        changeScope: [],
        changeSize: { filesChanged: 0, linesChanged: 0 },
        timeRisk: { isWeekend: false, isAfterHours: false, isHoliday: false, isFriday: false },
        dependencyRisk: { totalDependencies: 0, unhealthyDependencies: 0, criticalDependencies: [] },
        historicalRisk: {
          recentFailureRate: 1.0,
          recentIncidents: 1,
          averageMTTR: event.data.durationMs || 0,
        },
      };

      const assessment = await this.riskAssessmentService.assessDeploymentRisk({
        deploymentId: event.data.runId,
        deploymentRisk,
        tenantId: event.tenantId,
      });

      logger.info(
        `[RiskEventSubscriber] Risk assessment for failed pipeline ${event.data.runId}: ` +
        `Score=${assessment.riskScore}, Level=${assessment.riskLevel}`
      );
    } catch (error) {
      logger.error('[RiskEventSubscriber] Failed to process pipeline failed event:', error);
    }
  }

  /**
   * 处理代码合并事件
   */
  async handleCodePRMergedEvent(
    event: CloudEvent<CodePRMergedData>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[RiskEventSubscriber] Processing code.pr.merged:', event.data.prId);

    if (!this.autoAssessEnabled) {
      return;
    }

    try {
      // 代码合并后触发变更风险评估
      const deploymentRisk = {
        changeScope: [event.data.targetBranch],
        changeSize: { filesChanged: 0, linesChanged: 0 },
        timeRisk: {
          isWeekend: this.isWeekend(new Date(event.data.timestamp)),
          isAfterHours: this.isAfterHours(new Date(event.data.timestamp)),
          isHoliday: false,
          isFriday: this.isFriday(new Date(event.data.timestamp)),
        },
        dependencyRisk: {
          totalDependencies: 0,
          unhealthyDependencies: 0,
          criticalDependencies: [],
        },
        historicalRisk: {
          recentFailureRate: 0.05,
          recentIncidents: 0,
          averageMTTR: 0,
        },
      };

      const assessment = await this.riskAssessmentService.assessChangeRisk({
        changeId: event.data.prId,
        deploymentRisk,
        tenantId: event.tenantId,
      });

      logger.info(
        `[RiskEventSubscriber] Change risk assessment for PR ${event.data.prId}: ` +
        `Score=${assessment.riskScore}, Level=${assessment.riskLevel}`
      );
    } catch (error) {
      logger.error('[RiskEventSubscriber] Failed to process code.pr.merged event:', error);
    }
  }

  /**
   * 处理部署事件
   */
  async handleDeploymentEvent(
    event: CloudEvent<any>,
    _context: EventContext
  ): Promise<void> {
    logger.info('[RiskEventSubscriber] Processing deployment.started:', event.data.deploymentId);

    if (!this.autoAssessEnabled) {
      return;
    }

    try {
      // 部署开始时触发风险评估
      const deploymentRisk = {
        changeScope: event.data.services || [],
        changeSize: { filesChanged: 0, linesChanged: 0 },
        timeRisk: {
          isWeekend: this.isWeekend(new Date(event.data.timestamp)),
          isAfterHours: this.isAfterHours(new Date(event.data.timestamp)),
          isHoliday: false,
          isFriday: this.isFriday(new Date(event.data.timestamp)),
        },
        dependencyRisk: {
          totalDependencies: (event.data.services || []).length,
          unhealthyDependencies: 0,
          criticalDependencies: [],
        },
        historicalRisk: {
          recentFailureRate: 0.05,
          recentIncidents: 0,
          averageMTTR: 0,
        },
      };

      const assessment = await this.riskAssessmentService.assessDeploymentRisk({
        deploymentId: event.data.deploymentId,
        deploymentRisk,
        tenantId: event.tenantId,
      });

      logger.info(
        `[RiskEventSubscriber] Deployment risk assessment for ${event.data.deploymentId}: ` +
        `Score=${assessment.riskScore}, Level=${assessment.riskLevel}`
      );
    } catch (error) {
      logger.error('[RiskEventSubscriber] Failed to process deployment event:', error);
    }
  }

  /**
   * 检查是否运行中
   */
  isHealthy(): boolean {
    return this.isRunning;
  }

  /**
   * 获取活跃订阅数
   */
  getSubscriptionCount(): number {
    return this.subscriptions.length;
  }

  // ==================== 私有方法 ====================

  /**
   * 订阅事件
   */
  private async subscribe(
    eventType: string,
    handler: (event: CloudEvent<any>, context: EventContext) => Promise<void>
  ): Promise<void> {
    if (!this.eventBus) {
      logger.warn(`[RiskEventSubscriber] EventBus not configured, cannot subscribe to ${eventType}`);
      return;
    }

    try {
      const subscription = await this.eventBus.subscribe(
        eventType,
        handler,
        {
          streamName: this.streamName,
          durableName: `${this.consumerGroup}-${eventType.replace(/\./g, '-')}`,
          autoAck: false,
        }
      );
      this.subscriptions.push(subscription);
      logger.info(`[RiskEventSubscriber] Subscribed to ${eventType}`);
    } catch (error) {
      logger.error(`[RiskEventSubscriber] Failed to subscribe to ${eventType}:`, error);
    }
  }

  /**
   * 检查是否为周末
   */
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * 检查是否为非工作时间
   */
  private isAfterHours(date: Date): boolean {
    const hour = date.getHours();
    return hour < 9 || hour >= 18;
  }

  /**
   * 检查是否为周五
   */
  private isFriday(date: Date): boolean {
    return date.getDay() === 5;
  }
}
