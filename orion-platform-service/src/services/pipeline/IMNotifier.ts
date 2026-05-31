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
 * - 通知渠道配置持久化到 PostgreSQL（IMNotificationChannelRepository）
 *
 * 迁移说明：
 * - adapters Map 保留为运行时适配器注册表（包含 send 方法的对象无法序列化到 DB）
 * - 通知渠道配置（webhookUrl、平台类型、名称）迁移到 PostgreSQL
 */

import { PipelineRun } from '../../models/PipelineRun';
import { IMNotificationChannelRepository } from '../../repositories/IMNotificationChannelRepository';
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
  /** 运行时适配器注册表（包含 send 方法，无法持久化到 DB） */
  private adapters: Map<IMPlatformType, IMAdapter>;
  /** 通知渠道配置持久化仓库 */
  private channelRepository: IMNotificationChannelRepository | null = null;
  private tenantId: string;

  constructor(options?: {
    db?: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> };
    tenantId?: string;
  }) {
    this.adapters = new Map();
    this.tenantId = options?.tenantId || 'default';
    if (options?.db) {
      this.channelRepository = new IMNotificationChannelRepository(options.db);
    }
  }

  /**
   * 注册 IM 适配器（运行时注册，不持久化）
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
   * 注册通知渠道到 PostgreSQL
   */
  async registerChannel(config: IMNotificationConfig): Promise<void> {
    if (!this.channelRepository) {
      logger.warn('No channel repository configured, skipping channel persistence');
      return;
    }

    try {
      await this.channelRepository.createChannel({
        id: `${this.tenantId}:${config.type}:${config.name}`,
        tenantId: this.tenantId,
        platform: config.type,
        name: config.name,
        webhookUrl: config.webhookUrl,
        enabled: true,
      });
      logger.info({ platform: config.type, name: config.name }, 'IM notification channel registered');
    } catch (err) {
      logger.error(
        { err, platform: config.type, name: config.name },
        'Failed to register IM notification channel'
      );
    }
  }

  /**
   * 从 PostgreSQL 获取所有通知渠道
   */
  async getChannels(options?: { enabledOnly?: boolean }): Promise<IMNotificationConfig[]> {
    if (!this.channelRepository) {
      return [];
    }

    try {
      const entities = await this.channelRepository.findByTenant(this.tenantId, options);
      return entities.map(e => ({
        type: e.platform as IMPlatformType,
        webhookUrl: e.webhookUrl,
        name: e.name,
      }));
    } catch (err) {
      logger.error({ err }, 'Failed to load IM notification channels from PostgreSQL');
      return [];
    }
  }

  /**
   * 按平台类型获取通知渠道
   */
  async getChannelsByPlatform(platform: IMPlatformType): Promise<IMNotificationConfig[]> {
    if (!this.channelRepository) {
      return [];
    }

    try {
      const entities = await this.channelRepository.findEnabledByPlatform(this.tenantId, platform);
      return entities.map(e => ({
        type: e.platform as IMPlatformType,
        webhookUrl: e.webhookUrl,
        name: e.name,
      }));
    } catch (err) {
      logger.error({ err, platform }, 'Failed to load IM channels by platform from PostgreSQL');
      return [];
    }
  }

  /**
   * 删除通知渠道
   */
  async removeChannel(channelId: string): Promise<void> {
    if (!this.channelRepository) {
      logger.warn('No channel repository configured');
      return;
    }

    try {
      await this.channelRepository.delete(channelId);
      logger.info({ channelId }, 'IM notification channel removed');
    } catch (err) {
      logger.error({ err, channelId }, 'Failed to remove IM notification channel');
    }
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
   * 发送通知到所有已注册的渠道（从 PostgreSQL 加载）
   */
  async sendToAllChannels(payload: IMNotificationPayload): Promise<void> {
    const channels = await this.getChannels({ enabledOnly: true });
    if (channels.length === 0) {
      logger.info('No enabled IM notification channels found');
      return;
    }

    const promises = channels.map(config => this.sendNotification(config, payload));
    await Promise.allSettled(promises);
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
