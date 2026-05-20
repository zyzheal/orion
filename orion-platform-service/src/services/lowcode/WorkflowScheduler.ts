/**
 * WorkflowScheduler - 工作流定时调度器
 *
 * 管理工作流的 Cron 定时触发：
 * - 启动时加载所有启用的 'cron' 类型触发器
 * - 为每个触发器创建 CronJob
 * - 执行时创建工作流实例并触发
 * - 支持 start/stop/reload 生命周期管理
 */

import type { WorkflowTrigger, WorkflowTriggerRepository } from '../../repositories/WorkflowTriggerRepository';
import { WorkflowEngine } from './WorkflowEngine';
import { WorkflowInstanceManager } from './WorkflowInstance';
import { WorkflowDefinitionRepository } from './WorkflowRepository';

const logger = require('pino')({ name: 'WorkflowScheduler' });

/**
 * CronJob 包装器
 */
interface CronJobWrapper {
  job: any; // ScheduledTask from node-cron
  triggerId: string;
  trigger: WorkflowTrigger;
}

const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/**
 * 工作流定时调度器
 */
export class WorkflowScheduler {
  private triggerRepo: WorkflowTriggerRepository;
  private instanceManager: WorkflowInstanceManager;
  private workflowEngine: WorkflowEngine;
  private cronJobs: Map<string, CronJobWrapper> = new Map();
  private isRunning: boolean = false;

  constructor(
    triggerRepo: WorkflowTriggerRepository,
    instanceManager?: WorkflowInstanceManager
  ) {
    this.triggerRepo = triggerRepo;
    this.instanceManager = instanceManager || new WorkflowInstanceManager();

    // 创建工作流引擎用于执行工作流
    const definitionRepo = new WorkflowDefinitionRepository();
    this.workflowEngine = new WorkflowEngine(undefined, undefined);
  }

  /**
   * 启动调度器
   * 加载所有启用的 Cron 触发器并启动定时任务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('WorkflowScheduler is already running');
      return;
    }

    logger.info('Starting WorkflowScheduler...');

    // 加载所有启用的 Cron 触发器
    const triggers = await this.triggerRepo.findEnabledCronTriggers();
    logger.info({ count: triggers.length }, 'Loaded enabled cron triggers');

    // 为每个触发器创建定时任务
    for (const trigger of triggers) {
      try {
        await this.registerCronTrigger(trigger);
      } catch (error) {
        logger.error(
          { error, triggerId: trigger.id, triggerName: trigger.name },
          'Failed to register cron trigger'
        );
      }
    }

    this.isRunning = true;
    logger.info({ triggerCount: this.cronJobs.size }, 'WorkflowScheduler started');
  }

  /**
   * 停止调度器
   * 停止所有定时任务
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('WorkflowScheduler is not running');
      return;
    }

    logger.info('Stopping WorkflowScheduler...');

    // 停止所有定时任务
    const entries = Array.from(this.cronJobs.entries());
    for (const [triggerId, wrapper] of entries) {
      try {
        wrapper.job.stop();
        logger.debug({ triggerId }, 'Cron job stopped');
      } catch (error) {
        logger.error({ error, triggerId }, 'Failed to stop cron job');
      }
    }

    this.cronJobs.clear();
    this.isRunning = false;
    logger.info('WorkflowScheduler stopped');
  }

  /**
   * 注册 Cron 触发器
   * 为指定的触发器创建或更新定时任务
   */
  async registerCronTrigger(trigger: WorkflowTrigger): Promise<void> {
    if (!trigger.enabled) {
      logger.debug({ triggerId: trigger.id }, 'Trigger is disabled, skipping');
      return;
    }

    if (!trigger.cronExpression) {
      logger.warn({ triggerId: trigger.id }, 'Trigger has no cron expression');
      return;
    }

    // 如果已存在，先停止旧的任务
    if (this.cronJobs.has(trigger.id)) {
      const existing = this.cronJobs.get(trigger.id);
      if (existing) {
        existing.job.stop();
        this.cronJobs.delete(trigger.id);
        logger.debug({ triggerId: trigger.id }, 'Removed existing cron job');
      }
    }

    try {
      // 动态导入 node-cron 模块
      const cronModule = await this.importCronModule();
      const timezone = trigger.timezone || DEFAULT_TIMEZONE;

      // 创建定时任务
      const job = cronModule.schedule(
        trigger.cronExpression,
        async () => {
          await this.executeTrigger(trigger);
        },
        {
          timezone,
        }
      );

      // 存储任务包装器
      const wrapper: CronJobWrapper = {
        job,
        triggerId: trigger.id,
        trigger,
      };

      this.cronJobs.set(trigger.id, wrapper);
      logger.info(
        { triggerId: trigger.id, triggerName: trigger.name, cron: trigger.cronExpression, timezone },
        'Cron trigger registered'
      );
    } catch (error) {
      logger.error(
        { error, triggerId: trigger.id, cron: trigger.cronExpression },
        'Failed to register cron trigger'
      );
      throw error;
    }
  }

  /**
   * 重新加载所有触发器
   * 停止现有任务，从数据库重新加载并注册
   */
  async reload(): Promise<void> {
    logger.info('Reloading WorkflowScheduler...');

    // 停止所有现有任务
    const reloadEntries = Array.from(this.cronJobs.entries());
    for (const [triggerId, wrapper] of reloadEntries) {
      try {
        wrapper.job.stop();
      } catch (error) {
        logger.error({ error, triggerId }, 'Failed to stop cron job during reload');
      }
    }
    this.cronJobs.clear();

    // 重新加载所有启用的 Cron 触发器
    const triggers = await this.triggerRepo.findEnabledCronTriggers();
    logger.info({ count: triggers.length }, 'Reloaded enabled cron triggers');

    // 为每个触发器创建定时任务
    for (const trigger of triggers) {
      try {
        await this.registerCronTrigger(trigger);
      } catch (error) {
        logger.error(
          { error, triggerId: trigger.id, triggerName: trigger.name },
          'Failed to register cron trigger during reload'
        );
      }
    }

    logger.info({ triggerCount: this.cronJobs.size }, 'WorkflowScheduler reloaded');
  }

  /**
   * 获取下次执行时间
   * @param triggerId 触发器 ID
   * @returns 下次执行时间，如果不存在则返回 null
   */
  getNextExecutionTime(triggerId: string): Date | null {
    const wrapper = this.cronJobs.get(triggerId);
    if (!wrapper || !wrapper.job || typeof wrapper.job.getNextRun !== 'function') {
      return null;
    }

    try {
      return wrapper.job.getNextRun();
    } catch (error) {
      logger.error({ error, triggerId }, 'Failed to get next execution time');
      return null;
    }
  }

  /**
   * 获取所有活动触发器
   * @returns 活动触发器列表
   */
  getActiveTriggers(): WorkflowTrigger[] {
    return Array.from(this.cronJobs.values()).map(w => w.trigger);
  }

  /**
   * 检查调度器是否正在运行
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 动态导入 node-cron 模块
   */
  private async importCronModule(): Promise<{ schedule: any }> {
    try {
      const module = await import('node-cron');
      return module;
    } catch (error) {
      logger.error({ error }, 'Failed to import node-cron module');
      throw new Error(
        'node-cron module is not installed. Please run: npm install node-cron'
      );
    }
  }

  /**
   * 执行触发器
   * 当 Cron 表达式触发时调用此方法
   */
  private async executeTrigger(trigger: WorkflowTrigger): Promise<void> {
    const startTime = Date.now();
    logger.info(
      { triggerId: trigger.id, triggerName: trigger.name, workflowId: trigger.workflowId },
      'Cron trigger activated'
    );

    try {
      // 检查是否超过并发限制
      const concurrencyLimit = trigger.concurrencyLimit || 1;
      const activeCount = await this.getActiveInstanceCount(trigger.workflowId);

      if (activeCount >= concurrencyLimit) {
        logger.warn(
          { triggerId: trigger.id, activeCount, concurrencyLimit },
          'Concurrency limit reached, skipping this execution'
        );
        return;
      }

      // 准备触发数据
      const input = this.prepareTriggerInput(trigger);
      const createdBy = trigger.createdBy || 'system:cron';

      // 创建并执行工作流实例
      const instance = await this.workflowEngine.createInstance(
        trigger.workflowId,
        input,
        createdBy
      );

      // 异步执行工作流（不等待完成）
      this.workflowEngine.execute(instance.id).catch(error => {
        logger.error(
          { error, instanceId: instance.id, triggerId: trigger.id },
          'Workflow execution failed'
        );
      });

      const duration = Date.now() - startTime;
      logger.info(
        { triggerId: trigger.id, instanceId: instance.id, duration },
        'Workflow instance created from cron trigger'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        { error: errorMessage, triggerId: trigger.id, triggerName: trigger.name },
        'Failed to execute cron trigger'
      );
    }
  }

  /**
   * 准备触发输入数据
   * 合并触发器的 eventFilter 和运行时上下文
   */
  private prepareTriggerInput(trigger: WorkflowTrigger): Record<string, any> {
    const baseInput: Record<string, any> = {
      _triggerType: 'cron',
      _triggerId: trigger.id,
      _triggerName: trigger.name,
      _triggeredAt: new Date().toISOString(),
    };

    // 合并触发器的事件过滤器
    if (trigger.eventFilter) {
      return { ...baseInput, ...trigger.eventFilter };
    }

    return baseInput;
  }

  /**
   * 获取工作流的活跃实例数量
   */
  private async getActiveInstanceCount(workflowId: string): Promise<number> {
    try {
      const instances = await this.instanceManager.getInstancesByWorkflow(workflowId, {
        status: 'running',
        limit: 100,
        offset: 0,
      });
      return instances.length;
    } catch (error) {
      logger.error({ error, workflowId }, 'Failed to get active instance count');
      return 0;
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建工作流调度器实例
 */
export function createWorkflowScheduler(
  triggerRepo: WorkflowTriggerRepository,
  instanceManager?: WorkflowInstanceManager
): WorkflowScheduler {
  return new WorkflowScheduler(triggerRepo, instanceManager);
}

// ==================== 默认导出 ====================

export default WorkflowScheduler;