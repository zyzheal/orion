/**
 * ApprovalTimeoutScheduler - 审批超时自动处理调度器
 *
 * 功能：
 * - 扫描超时审批
 * - 根据超时策略自动处理（提醒 -> 批准 -> 拒绝）
 * - 集成 CronSchedulerService
 *
 * 超时策略：
 * 1. 首次超时 - 发送提醒通知给审批人
 * 2. 二次超时（超过 reminderInterval * 2）- 自动批准或拒绝
 */

import pino from 'pino';
import { ApprovalRepository, ApprovalEntity, ApprovalStepEntity } from '../../repositories/ApprovalRepository';
import { CronSchedulerService } from '../scheduler/CronSchedulerService';

/** 最小通知服务接口，避免强依赖 NotificationService */
interface NotificationSender {
  send(input: { tenant_id: string; user_id: string; type: string; title: string; message: string }): Promise<unknown>;
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// 超时配置
export interface ApprovalTimeoutConfig {
  // 首次提醒超时时间（毫秒），默认 24 小时
  reminderTimeoutMs: number;
  // 自动处理超时时间（毫秒），默认 48 小时
  autoActionTimeoutMs: number;
  // 默认自动操作：'approve' | 'reject'
  defaultAutoAction: 'approve' | 'reject';
  // 启用自动批准
  autoApproveEnabled: boolean;
  // 启用自动拒绝
  autoRejectEnabled: boolean;
}

export const DEFAULT_TIMEOUT_CONFIG: ApprovalTimeoutConfig = {
  reminderTimeoutMs: 24 * 60 * 60 * 1000, // 24 小时
  autoActionTimeoutMs: 48 * 60 * 60 * 1000, // 48 小时
  defaultAutoAction: 'approve',
  autoApproveEnabled: true,
  autoRejectEnabled: false,
};

// 超时处理结果
export interface TimeoutHandlingResult {
  approvalId: string;
  action: 'reminded' | 'approved' | 'rejected' | 'none';
  timestamp: Date;
  reason?: string;
}

// 审批超时信息
export interface ApprovalTimeoutInfo {
  entity: ApprovalEntity;
  steps: ApprovalStepEntity[];
  overdueMs: number;
  currentPhase: 'normal' | 'reminder' | 'auto_action';
}

export class ApprovalTimeoutScheduler {
  private repository: ApprovalRepository;
  private config: ApprovalTimeoutConfig;
  private cronScheduler?: CronSchedulerService;
  private notificationService?: NotificationSender;
  private jobId = 'approval-timeout-scheduler';

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    config?: Partial<ApprovalTimeoutConfig>,
    cronScheduler?: CronSchedulerService,
    notificationService?: NotificationSender,
  ) {
    this.repository = new ApprovalRepository(db);
    this.config = { ...DEFAULT_TIMEOUT_CONFIG, ...config };
    this.cronScheduler = cronScheduler;
    this.notificationService = notificationService;
  }

  /**
   * 启动调度器
   * 注册到 CronSchedulerService，每 5 分钟扫描一次超时审批
   */
  async start(): Promise<void> {
    if (this.cronScheduler) {
      // 注册 cron 任务：每 5 分钟执行一次
      this.cronScheduler.addJob({
        id: this.jobId,
        name: 'Approval Timeout Scanner',
        schedule: '*/5 * * * *', // 每 5 分钟
        task: 'approval-timeout-scan',
      });
      logger.info('ApprovalTimeoutScheduler registered with CronSchedulerService');
    } else {
      // 如果没有 CronSchedulerService，使用 setInterval
      logger.warn('No CronSchedulerService provided, using setInterval fallback');
    }
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.cronScheduler) {
      this.cronScheduler.removeJob(this.jobId);
    }
    logger.info('ApprovalTimeoutScheduler stopped');
  }

  /**
   * 扫描所有超时审批
   * 返回需要处理的超时审批列表
   */
  async scanTimeoutApprovals(): Promise<ApprovalTimeoutInfo[]> {
    const now = new Date();
    const result: ApprovalTimeoutInfo[] = [];

    try {
      // 获取所有待审批
      const approvals = await this.repository.findAll({ limit: 1000 });
      const pendingApprovals = approvals.entities.filter(a => a.status === 'pending');

      for (const entity of pendingApprovals) {
        const steps = await this.repository.findStepsByApproval(entity.id);
        const overdueMs = now.getTime() - entity.createdAt.getTime();

        // 判断当前处于哪个阶段
        let currentPhase: 'normal' | 'reminder' | 'auto_action' = 'normal';

        if (overdueMs >= this.config.autoActionTimeoutMs) {
          currentPhase = 'auto_action';
        } else if (overdueMs >= this.config.reminderTimeoutMs) {
          currentPhase = 'reminder';
        }

        // 只返回需要处理的（超过提醒时间或自动处理时间）
        if (currentPhase !== 'normal') {
          result.push({
            entity,
            steps,
            overdueMs,
            currentPhase,
          });
        }
      }

      logger.info({ count: result.length }, 'Scanned timeout approvals');
    } catch (error) {
      logger.error({ error }, 'Error scanning timeout approvals');
    }

    return result;
  }

  /**
   * 处理单个审批的超时
   */
  async handleTimeout(timeoutInfo: ApprovalTimeoutInfo): Promise<TimeoutHandlingResult> {
    const { entity, currentPhase } = timeoutInfo;

    try {
      // 阶段1: 发送提醒
      if (currentPhase === 'reminder') {
        await this.sendReminder(timeoutInfo);
        return {
          approvalId: entity.id,
          action: 'reminded',
          timestamp: new Date(),
          reason: `Approval overdue for ${Math.round(timeoutInfo.overdueMs / (1000 * 60 * 60))} hours`,
        };
      }

      // 阶段2: 自动处理
      if (currentPhase === 'auto_action') {
        if (this.config.defaultAutoAction === 'approve' && this.config.autoApproveEnabled) {
          await this.autoApprove(timeoutInfo);
          return {
            approvalId: entity.id,
            action: 'approved',
            timestamp: new Date(),
            reason: `Auto-approved after ${Math.round(timeoutInfo.overdueMs / (1000 * 60 * 60))} hours timeout`,
          };
        } else if (this.config.defaultAutoAction === 'reject' && this.config.autoRejectEnabled) {
          await this.autoReject(timeoutInfo);
          return {
            approvalId: entity.id,
            action: 'rejected',
            timestamp: new Date(),
            reason: `Auto-rejected after ${Math.round(timeoutInfo.overdueMs / (1000 * 60 * 60))} hours timeout`,
          };
        }
      }

      return {
        approvalId: entity.id,
        action: 'none',
        timestamp: new Date(),
        reason: 'No action configured for this timeout phase',
      };
    } catch (error) {
      logger.error({ error, approvalId: entity.id }, 'Error handling approval timeout');
      throw error;
    }
  }

  /**
   * 批量处理所有超时审批
   */
  async processAllTimeouts(): Promise<TimeoutHandlingResult[]> {
    const results: TimeoutHandlingResult[] = [];
    const timeoutApprovals = await this.scanTimeoutApprovals();

    for (const timeoutInfo of timeoutApprovals) {
      try {
        const result = await this.handleTimeout(timeoutInfo);
        results.push(result);
      } catch (error) {
        logger.error({ error, approvalId: timeoutInfo.entity.id }, 'Failed to handle timeout');
      }
    }

    logger.info({ processed: results.length }, 'Processed all timeout approvals');
    return results;
  }

  /**
   * 发送审批超时提醒
   * 通过 NotificationService 发送应用内通知
   */
  private async sendReminder(timeoutInfo: ApprovalTimeoutInfo): Promise<void> {
    const { entity, steps } = timeoutInfo;

    // 获取待审批的审批人
    const pendingApprovers = steps
      .filter(s => s.status === 'pending')
      .map(s => s.approverId)
      .filter((id): id is string => !!id);

    const overdueHours = Math.round(timeoutInfo.overdueMs / (1000 * 60 * 60));

    logger.info({
      approvalId: entity.id,
      pendingApprovers,
      overdueHours,
    }, 'Sending approval reminder notification');

    if (!this.notificationService) {
      logger.warn({ approvalId: entity.id }, 'NotificationService not configured, skipping reminder');
      return;
    }

    // 向所有待审批人发送提醒通知
    for (const approverId of pendingApprovers) {
      try {
        await this.notificationService.send({
          tenant_id: entity.tenantId,
          user_id: approverId,
          type: 'approval_reminder',
          title: '审批提醒',
          message: `您有待审批的单据 "${entity.title}" 已超时 ${overdueHours} 小时，请尽快处理。`,
        });
      } catch (error) {
        logger.error({ error, approverId, approvalId: entity.id }, 'Failed to send reminder notification');
      }
    }
  }

  /**
   * 自动批准超时审批
   */
  private async autoApprove(timeoutInfo: ApprovalTimeoutInfo): Promise<void> {
    const { entity, steps } = timeoutInfo;

    logger.info({ approvalId: entity.id }, 'Auto-approving timeout approval');

    // 批准所有待审批的步骤
    for (const step of steps) {
      if (step.status === 'pending') {
        await this.repository.updateStepStatus(
          step.id,
          'approved',
          '自动批准：审批超时',
          new Date(),
        );
      }
    }

    // 更新审批状态为已批准
    await this.repository.updateStatus(entity.id, 'approved', new Date());

    logger.info({ approvalId: entity.id }, 'Approval auto-approved');
  }

  /**
   * 自动拒绝超时审批
   */
  private async autoReject(timeoutInfo: ApprovalTimeoutInfo): Promise<void> {
    const { entity, steps } = timeoutInfo;

    logger.info({ approvalId: entity.id }, 'Auto-rejecting timeout approval');

    // 拒绝所有待审批的步骤
    for (const step of steps) {
      if (step.status === 'pending') {
        await this.repository.updateStepStatus(
          step.id,
          'rejected',
          '自动拒绝：审批超时',
          new Date(),
        );
      }
    }

    // 更新审批状态为已拒绝
    await this.repository.updateStatus(entity.id, 'rejected', new Date());

    logger.info({ approvalId: entity.id }, 'Approval auto-rejected');
  }

  /**
   * 获取调度器配置
   */
  getConfig(): ApprovalTimeoutConfig {
    return { ...this.config };
  }

  /**
   * 更新调度器配置
   */
  updateConfig(config: Partial<ApprovalTimeoutConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Updated ApprovalTimeoutScheduler config');
  }
}

export default ApprovalTimeoutScheduler;