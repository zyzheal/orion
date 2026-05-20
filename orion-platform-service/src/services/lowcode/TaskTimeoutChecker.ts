/**
 * TaskTimeoutChecker - 工作流任务超时检查器
 *
 * 定期检查 workflow_tasks 表中超时的任务：
 * - 扫描超过 due_date 且未完成的任务
 * - 根据配置的超时策略自动处理（提醒、升级、自动完成）
 * - 发布超时事件供其他系统消费
 */

import { WorkflowTaskRepository } from '../../repositories/WorkflowTaskRepository';
import { WorkflowInstanceManager } from './WorkflowInstance';
import { WorkflowEngine } from './WorkflowEngine';
import type { WorkflowTask } from '../../repositories/WorkflowTaskRepository';

const logger = require('pino')({ name: 'TaskTimeoutChecker' });

/**
 * 超时处理动作
 */
export enum TimeoutAction {
  REMIND = 'remind',       // 发送提醒通知
  ESCALATE = 'escalate',   // 升级到上级
  AUTO_COMPLETE = 'auto_complete', // 自动完成任务
  CANCEL = 'cancel',       // 取消任务并跳过
}

/**
 * 超时任务信息
 */
export interface TimedOutTask {
  task: WorkflowTask;
  overdueHours: number;
  timeoutAction: TimeoutAction;
}

/**
 * 任务超时检查器配置
 */
export interface TaskTimeoutConfig {
  /** 检查间隔（毫秒），默认 60 秒 */
  checkIntervalMs?: number;
  /** 超时后首次提醒时间（小时），默认 1 */
  firstRemindHours?: number;
  /** 升级间隔（小时），默认 4 */
  escalateHours?: number;
  /** 自动完成时间（小时），默认 24 */
  autoCompleteHours?: number;
  /** 超时后自动完成的动作 */
  defaultTimeoutAction?: TimeoutAction;
}

const DEFAULT_CONFIG: Required<TaskTimeoutConfig> = {
  checkIntervalMs: 60 * 1000,
  firstRemindHours: 1,
  escalateHours: 4,
  autoCompleteHours: 24,
  defaultTimeoutAction: TimeoutAction.REMIND,
};

/**
 * 超时事件记录
 */
interface TimeoutEvent {
  taskId: string;
  instanceId: string;
  action: TimeoutAction;
  previousAction?: TimeoutAction;
  triggeredAt: Date;
}

/**
 * 任务超时检查器
 */
export class TaskTimeoutChecker {
  private taskRepo: WorkflowTaskRepository;
  private instanceManager: WorkflowInstanceManager;
  private config: Required<TaskTimeoutConfig>;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  /** 记录已处理的超时事件，避免重复处理 */
  private processedEvents: Map<string, TimeoutEvent> = new Map();

  constructor(
    taskRepo: WorkflowTaskRepository,
    instanceManager?: WorkflowInstanceManager,
    config?: TaskTimeoutConfig,
  ) {
    this.taskRepo = taskRepo;
    this.instanceManager = instanceManager || new WorkflowInstanceManager();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动超时检查器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('TaskTimeoutChecker is already running');
      return;
    }

    logger.info('Starting TaskTimeoutChecker...');
    this.isRunning = true;

    // 定期执行检查
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkTimedOutTasks();
      } catch (error) {
        logger.error({ error }, 'Task timeout check failed');
      }
    }, this.config.checkIntervalMs);

    logger.info({ intervalMs: this.config.checkIntervalMs }, 'TaskTimeoutChecker started');
  }

  /**
   * 停止超时检查器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping TaskTimeoutChecker...');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
    logger.info('TaskTimeoutChecker stopped');
  }

  /**
   * 检查并处理超时任务
   */
  async checkTimedOutTasks(): Promise<void> {
    const timedOutTasks = await this.getTimedOutTasks();
    if (timedOutTasks.length === 0) return;

    logger.info({ count: timedOutTasks.length }, 'Found timed out tasks');

    for (const timedOut of timedOutTasks) {
      await this.handleTimedOutTask(timedOut);
    }
  }

  /**
   * 获取所有超时任务
   */
  async getTimedOutTasks(): Promise<TimedOutTask[]> {
    const now = new Date();
    const allTasks = await this.taskRepo.findAll();

    const timedOutTasks: TimedOutTask[] = [];

    for (const task of allTasks) {
      // 只检查有待处理或已认领状态且有截止日期的任务
      if ((task.status !== 'pending' && task.status !== 'assigned') || !task.due_date) {
        continue;
      }

      const dueDate = new Date(task.due_date);
      if (dueDate >= now) {
        continue;
      }

      const overdueHours = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);
      const timeoutAction = this.determineTimeoutAction(overdueHours);

      // 检查是否已经处理过此超时事件
      const eventKey = `${task.id}:${timeoutAction}`;
      if (this.processedEvents.has(eventKey)) {
        continue;
      }

      timedOutTasks.push({ task, overdueHours, timeoutAction });
    }

    return timedOutTasks;
  }

  /**
   * 根据超时时间确定处理动作
   */
  private determineTimeoutAction(overdueHours: number): TimeoutAction {
    if (overdueHours >= this.config.autoCompleteHours) {
      return this.config.defaultTimeoutAction === TimeoutAction.AUTO_COMPLETE
        ? TimeoutAction.AUTO_COMPLETE
        : TimeoutAction.ESCALATE;
    }

    if (overdueHours >= this.config.escalateHours) {
      return TimeoutAction.ESCALATE;
    }

    if (overdueHours >= this.config.firstRemindHours) {
      return TimeoutAction.REMIND;
    }

    return TimeoutAction.REMIND;
  }

  /**
   * 处理单个超时任务
   */
  private async handleTimedOutTask(timedOut: TimedOutTask): Promise<void> {
    const { task, timeoutAction } = timedOut;
    const eventKey = `${task.id}:${timeoutAction}`;

    try {
      switch (timeoutAction) {
        case TimeoutAction.REMIND:
          await this.sendReminder(task);
          this.recordProcessedEvent(task.id, task.instance_id, timeoutAction);
          break;

        case TimeoutAction.ESCALATE:
          await this.escalateTask(task);
          this.recordProcessedEvent(task.id, task.instance_id, timeoutAction);
          break;

        case TimeoutAction.AUTO_COMPLETE:
          await this.autoCompleteTask(task);
          this.recordProcessedEvent(task.id, task.instance_id, timeoutAction);
          break;

        case TimeoutAction.CANCEL:
          await this.cancelTask(task);
          this.recordProcessedEvent(task.id, task.instance_id, timeoutAction);
          break;
      }
    } catch (error) {
      logger.error(
        { error, taskId: task.id, action: timeoutAction },
        'Failed to handle timed out task'
      );
    }
  }

  /**
   * 发送超时提醒
   */
  private async sendReminder(task: WorkflowTask): Promise<void> {
    logger.info(
      { taskId: task.id, title: task.title, assigneeId: task.assignee_id },
      'Sending task timeout reminder'
    );

    // 更新任务的超时提醒次数
    // 实际生产中应该通过 NotificationService 发送提醒
    // 这里将提醒信息记录到 form_data 中

    const currentFormData = task.form_data || {};
    const reminderCount = (currentFormData.reminderCount || 0) + 1;

    // 更新 form_data 记录提醒
    await this.taskRepo.update(task.id, {
      form_data: {
        ...currentFormData,
        reminderCount,
        lastReminderAt: new Date().toISOString(),
        timeoutAction: 'reminded',
      },
    });
  }

  /**
   * 升级任务
   */
  private async escalateTask(task: WorkflowTask): Promise<void> {
    logger.info(
      { taskId: task.id, title: task.title, originalAssignee: task.assignee_id },
      'Escalating timed out task'
    );

    // 实际生产中应该：
    // 1. 通知上级管理者
    // 2. 可能重新分配给其他人
    // 这里标记为已升级

    const currentFormData = task.form_data || {};

    await this.taskRepo.update(task.id, {
      form_data: {
        ...currentFormData,
        escalated: true,
        escalatedAt: new Date().toISOString(),
        timeoutAction: 'escalated',
      },
    });
  }

  /**
   * 自动完成任务
   */
  private async autoCompleteTask(task: WorkflowTask): Promise<void> {
    logger.info(
      { taskId: task.id, title: task.title, instanceId: task.instance_id },
      'Auto-completing timed out task'
    );

    const result = await this.taskRepo.completeWithResult(
      task.id,
      'system:timeout',
      'Task auto-completed due to timeout',
    );

    if (result) {
      // 唤醒挂起的工作流实例
      try {
        const engine = new WorkflowEngine();
        await engine.resumeFromEvent(result.instanceId, {
          taskId: task.id,
          completedBy: 'system:timeout',
          comment: 'Task auto-completed due to timeout',
          autoCompleted: true,
          completedAt: new Date().toISOString(),
        });

        logger.info(
          { taskId: task.id, instanceId: result.instanceId },
          'Workflow resumed after auto-completing task'
        );
      } catch (resumeError) {
        const resumeMessage = resumeError instanceof Error ? resumeError.message : String(resumeError);
        logger.error(
          { taskId: task.id, error: resumeMessage },
          'Failed to resume workflow after auto-completing task'
        );
      }
    }
  }

  /**
   * 取消任务
   */
  private async cancelTask(task: WorkflowTask): Promise<void> {
    logger.info(
      { taskId: task.id, title: task.title },
      'Cancelling timed out task'
    );

    await this.taskRepo.updateStatus(task.id, 'cancelled', 'system:timeout', 'Task cancelled due to timeout');

    // 如果工作流实例仍然挂起，尝试恢复它
    try {
      const engine = new WorkflowEngine();
      await engine.resumeFromEvent(task.instance_id, {
        taskId: task.id,
        cancelled: true,
        reason: 'Task cancelled due to timeout',
      });
    } catch (resumeError) {
      logger.error(
        { taskId: task.id, error: resumeError },
        'Failed to resume workflow after cancelling task'
      );
    }
  }

  /**
   * 记录已处理的超时事件
   */
  private recordProcessedEvent(taskId: string, instanceId: string, action: TimeoutAction): void {
    const eventKey = `${taskId}:${action}`;
    this.processedEvents.set(eventKey, {
      taskId,
      instanceId,
      action,
      triggeredAt: new Date(),
    });

    // 清理旧的事件记录（保留最近 1000 条）
    if (this.processedEvents.size > 1000) {
      const firstKey = this.processedEvents.keys().next().value;
      if (firstKey) {
        this.processedEvents.delete(firstKey);
      }
    }
  }

  /**
   * 获取检查器状态
   */
  getStatus(): { isRunning: boolean; processedEventsCount: number } {
    return {
      isRunning: this.isRunning,
      processedEventsCount: this.processedEvents.size,
    };
  }

  /**
   * 手动触发超时检查
   */
  async checkNow(): Promise<TimedOutTask[]> {
    const timedOutTasks = await this.getTimedOutTasks();
    for (const timedOut of timedOutTasks) {
      await this.handleTimedOutTask(timedOut);
    }
    return timedOutTasks;
  }
}
