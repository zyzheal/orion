/**
 * NotificationDispatcher - 通知分发器
 *
 * 负责：
 * - IM 通知（飞书/钉钉/Slack 等）
 * - Webhook 通知（外部系统推送）
 * - 构建 Stages 摘要信息
 */

import { PipelineRun, PipelineRunStatus } from '../models/PipelineRun';
import { Stage } from '../models/Stage';
import { PipelineService } from '../services/pipeline/PipelineService';
import { PipelineRunService } from '../services/pipeline/PipelineRunService';
import { IMNotifier, IMNotificationConfig } from '../services/pipeline/IMNotifier';
import { WebhookNotifier, WebhookConfig as WebhookNotifierConfig, WebhookPayload, WebhookEventType, StageSummary } from '../services/pipeline/WebhookNotifier';
import { WebhookConfigRepository } from '../repositories/WebhookConfigRepository';
import { PipelineExecution } from './PipelineEngine';
import { createLogger } from '../utils/logger';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface NotificationDispatcherDeps {
  pipelineService: PipelineService;
  runService: PipelineRunService;
  imNotifier: IMNotifier | null;
  imNotificationConfigs: IMNotificationConfig[];
  webhookNotifier: WebhookNotifier | null;
  webhookConfigRepo: WebhookConfigRepository | null;
}

export class NotificationDispatcher {
  private pipelineService: PipelineService;
  private runService: PipelineRunService;
  private imNotifier: IMNotifier | null;
  private imNotificationConfigs: IMNotificationConfig[];
  private webhookNotifier: WebhookNotifier | null;
  private webhookConfigRepo: WebhookConfigRepository | null;

  constructor(deps: NotificationDispatcherDeps) {
    this.pipelineService = deps.pipelineService;
    this.runService = deps.runService;
    this.imNotifier = deps.imNotifier;
    this.imNotificationConfigs = deps.imNotificationConfigs;
    this.webhookNotifier = deps.webhookNotifier;
    this.webhookConfigRepo = deps.webhookConfigRepo;
  }

  /**
   * 发送 IM 通知（根据 Pipeline 最终状态分发到不同 IM 渠道）
   * 此方法异步执行，失败不影响 Pipeline 状态
   */
  async sendIMNotifications(run: PipelineRun): Promise<void> {
    if (!this.imNotifier) return;

    // 从 PipelineService 获取 Pipeline 名称
    const pipeline = await this.pipelineService.getById(run.pipelineId);
    const pipelineName = pipeline?.name || run.pipelineId;

    try {
      if (run.status === PipelineRunStatus.SUCCESS) {
        for (const config of this.imNotificationConfigs) {
          await this.imNotifier.notifyOnPipelineComplete(run, config, pipelineName);
        }
      } else if (run.status === PipelineRunStatus.FAILED) {
        for (const config of this.imNotificationConfigs) {
          await this.imNotifier.notifyOnPipelineFailure(run, config, pipelineName);
        }
      } else if (run.status === PipelineRunStatus.CANCELLED) {
        for (const config of this.imNotificationConfigs) {
          await this.imNotifier.notifyOnPipelineCancelled(run, config, pipelineName);
        }
      }
    } catch (error) {
      // IM 通知失败不应影响 pipeline 状态，仅记录日志
      logger.warn(
        { runId: run.id, error: error instanceof Error ? error.message : String(error) },
        'IM notification sending failed (non-fatal)'
      );
    }
  }

  /**
   * 发送 Webhook 通知（根据 Pipeline 最终状态向外部系统推送事件）
   * 此方法异步执行，失败不影响 Pipeline 状态
   */
  async sendWebhookNotifications(run: PipelineRun, executions: Map<string, PipelineExecution>): Promise<void> {
    if (!this.webhookNotifier) return;

    // 从 PipelineService 获取 Pipeline 名称
    const pipeline = await this.pipelineService.getById(run.pipelineId);
    const pipelineName = pipeline?.name || run.pipelineId;

    // 确定事件类型
    const eventType: WebhookEventType | undefined =
      run.status === PipelineRunStatus.SUCCESS ? 'pipeline.complete' :
      run.status === PipelineRunStatus.FAILED ? 'pipeline.failed' :
      run.status === PipelineRunStatus.CANCELLED ? 'pipeline.cancelled' :
      undefined;

    if (!eventType) {
      logger.debug({ runId: run.id, status: run.status }, 'No webhook event type for pipeline status, skipping');
      return;
    }

    // 从仓库获取该 Pipeline 的 Webhook 配置
    const webhookConfigs = this.webhookConfigRepo
      ? await this.webhookConfigRepo.findByEvent(run.pipelineId, eventType)
      : [];

    if (webhookConfigs.length === 0) {
      logger.debug({ pipelineId: run.pipelineId, eventType }, 'No matching webhook configs, skipping');
      return;
    }

    // 构建 stages summary（从执行上下文或数据库获取）
    const stagesSummary: StageSummary[] = await this.buildStagesSummary(run.id, executions);

    // 构建 Webhook payload
    const payload: WebhookPayload = {
      eventType,
      runId: run.id,
      pipelineId: run.pipelineId,
      status: run.status === PipelineRunStatus.SUCCESS ? 'success' :
              run.status === PipelineRunStatus.FAILED ? 'failed' : 'cancelled',
      timestamp: new Date(),
      durationMs: run.durationMs,
      stagesSummary,
      triggerBy: run.triggerBy,
      metadata: {
        pipelineName,
        pipelineVersion: run.pipelineVersion,
        triggerType: run.triggerType,
        context: run.context,
      },
    };

    // 将 WebhookConfigEntity 转换为 WebhookNotifierConfig
    const notifierConfigs: WebhookNotifierConfig[] = webhookConfigs.map(config => ({
      url: config.url,
      method: config.method,
      headers: config.headers,
      secret: config.secret || undefined,
      events: config.events,
      retries: config.retries,
    }));

    // 并行发送所有匹配的 Webhook
    logger.info(
      { runId: run.id, pipelineId: run.pipelineId, eventType, webhookCount: notifierConfigs.length },
      'Sending webhook notifications'
    );

    await this.webhookNotifier.sendAll(notifierConfigs, payload);
  }

  /**
   * 构建 Stages 摘要信息
   */
  async buildStagesSummary(runId: string, executions: Map<string, PipelineExecution>): Promise<StageSummary[]> {
    // 先从内存执行上下文查找（如果还在内存中）
    const execution = executions.get(runId);
    if (execution) {
      return Array.from(execution.stages.values()).map(stage => ({
        name: stage.name,
        status: stage.status,
        durationMs: stage.durationMs || 0,
      }));
    }

    // 回退到从数据库查询
    try {
      const stages = await this.runService.getStages(runId);
      return stages.map(stage => ({
        name: stage.name,
        status: stage.status,
        durationMs: stage.durationMs || 0,
      }));
    } catch (error) {
      logger.warn({ runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to build stages summary for webhook');
      return [];
    }
  }
}
