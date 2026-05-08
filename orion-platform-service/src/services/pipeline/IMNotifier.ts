/**
 * IMNotifier - 即时通讯通知器
 *
 * 负责向钉钉、企业微信、飞书等 IM 平台发送 Pipeline 状态通知。
 * 使用适配器模式支持多种 IM 平台，每个平台通过独立的 Adapter 实现。
 *
 * 设计原则：
 * - 通知发送失败不应影响 Pipeline 的正常执行状态
 * - 支持动态注册新的 IM 适配器
 * - 所有错误被捕获并记录日志，不会向上抛出
 */

import { PipelineRun } from '../../models/PipelineRun';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// 接口定义
// ============================================================================

export type IMPlatformType = 'dingtalk' | 'wecom' | 'feishu';

export interface IMNotificationConfig {
  type: IMPlatformType;
  webhookUrl: string; // 包含 access_token 的完整 webhook URL
  name: string;       // 通知渠道名称，用于日志标识
}

export interface IMNotificationPayload {
  title: string;
  content: string;
  pipelineName: string;
  runId: string;
  status: 'success' | 'failed' | 'cancelled';
  duration?: string;
  triggerBy?: string;
}

export interface IMAdapter {
  readonly platformType: IMPlatformType;
  send(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void>;
}

// ============================================================================
// IMNotifier 主类
// ============================================================================

export class IMNotifier {
  private adapters: Map<IMPlatformType, IMAdapter>;

  constructor() {
    this.adapters = new Map();
  }

  /**
   * 注册 IM 适配器
   */
  registerAdapter(adapter: IMAdapter): void {
    this.adapters.set(adapter.platformType, adapter);
    logger.info({ platform: adapter.platformType }, 'IM adapter registered');
  }

  /**
   * 获取已注册的适配器数量
   */
  getAdapterCount(): number {
    return this.adapters.size;
  }

  /**
   * 发送 IM 通知（通用方法）
   * 如果适配器不存在或发送失败，记录日志但不抛出异常
   */
  async sendNotification(config: IMNotificationConfig, payload: IMNotificationPayload): Promise<void> {
    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      logger.warn({ platform: config.type }, 'IM adapter not found, skipping notification');
      return;
    }

    try {
      await adapter.send(config, payload);
      logger.info(
        { platform: config.type, runId: payload.runId, status: payload.status },
        'IM notification sent successfully'
      );
    } catch (error) {
      // 通知发送失败不应影响 pipeline 状态
      logger.error(
        { platform: config.type, runId: payload.runId, error: error instanceof Error ? error.message : String(error) },
        'Failed to send IM notification'
      );
    }
  }

  /**
   * Pipeline 完成时发送通知
   */
  async notifyOnPipelineComplete(run: PipelineRun, config: IMNotificationConfig, pipelineName?: string): Promise<void> {
    const duration = this.formatDuration(run.durationMs);
    const payload: IMNotificationPayload = {
      title: `Pipeline 完成: ${pipelineName || run.pipelineId}`,
      content: this.buildCompleteMessage(pipelineName || run.pipelineId, run, duration),
      pipelineName: pipelineName || run.pipelineId,
      runId: run.id,
      status: 'success',
      duration,
      triggerBy: run.triggerBy,
    };

    await this.sendNotification(config, payload);
  }

  /**
   * Pipeline 失败时发送通知
   */
  async notifyOnPipelineFailure(run: PipelineRun, config: IMNotificationConfig, pipelineName?: string): Promise<void> {
    const duration = this.formatDuration(run.durationMs);
    const payload: IMNotificationPayload = {
      title: `Pipeline 失败: ${pipelineName || run.pipelineId}`,
      content: this.buildFailedMessage(pipelineName || run.pipelineId, run, duration),
      pipelineName: pipelineName || run.pipelineId,
      runId: run.id,
      status: 'failed',
      duration,
      triggerBy: run.triggerBy,
    };

    await this.sendNotification(config, payload);
  }

  /**
   * Pipeline 取消时发送通知
   */
  async notifyOnPipelineCancelled(run: PipelineRun, config: IMNotificationConfig, pipelineName?: string): Promise<void> {
    const duration = this.formatDuration(run.durationMs);
    const payload: IMNotificationPayload = {
      title: `Pipeline 取消: ${pipelineName || run.pipelineId}`,
      content: this.buildCancelledMessage(pipelineName || run.pipelineId, run, duration),
      pipelineName: pipelineName || run.pipelineId,
      runId: run.id,
      status: 'cancelled',
      duration,
      triggerBy: run.triggerBy,
    };

    await this.sendNotification(config, payload);
  }

  /**
   * 批量发送通知（多个 IM 渠道）
   * 所有通知并行发送，互不影响
   */
  async sendBatch(configs: IMNotificationConfig[], payload: IMNotificationPayload): Promise<void> {
    const promises = configs.map(config => this.sendNotification(config, payload));
    await Promise.allSettled(promises);
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private formatDuration(durationMs?: number): string {
    if (durationMs === undefined || durationMs === null) {
      return '未知';
    }
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private buildCompleteMessage(pipelineName: string, run: PipelineRun, duration: string): string {
    const lines = [
      `### Pipeline 执行成功`,
      ``,
      `**Pipeline**: ${pipelineName}`,
      `**Run ID**: ${run.id}`,
      `**耗时**: ${duration}`,
    ];
    if (run.triggerBy) {
      lines.push(`**触发人**: ${run.triggerBy}`);
    }
    lines.push(``, `[查看详情](#/pipelines/${run.id})`);
    return lines.join('\n');
  }

  private buildFailedMessage(pipelineName: string, run: PipelineRun, duration: string): string {
    const lines = [
      `### Pipeline 执行失败`,
      ``,
      `**Pipeline**: ${pipelineName}`,
      `**Run ID**: ${run.id}`,
      `**耗时**: ${duration}`,
    ];
    if (run.triggerBy) {
      lines.push(`**触发人**: ${run.triggerBy}`);
    }
    lines.push(``, `[查看详情](#/pipelines/${run.id})`);
    return lines.join('\n');
  }

  private buildCancelledMessage(pipelineName: string, run: PipelineRun, duration: string): string {
    const lines = [
      `### Pipeline 已取消`,
      ``,
      `**Pipeline**: ${pipelineName}`,
      `**Run ID**: ${run.id}`,
      `**耗时**: ${duration}`,
    ];
    if (run.triggerBy) {
      lines.push(`**触发人**: ${run.triggerBy}`);
    }
    lines.push(``, `[查看详情](#/pipelines/${run.id})`);
    return lines.join('\n');
  }
}
