/**
 * TriggerManager - 工作流事件触发器管理器
 *
 * 负责工作流事件触发器的订阅、事件处理和工作流实例的创建执行
 */

import { EventBusService } from '../event-bus-service';
import { TypedEnvelope } from '../types/event-types';
import {
  WorkflowTriggerRepository,
  WorkflowTrigger,
  CreateWorkflowTriggerInput,
  UpdateWorkflowTriggerInput,
} from '../../repositories/WorkflowTriggerRepository';
import { WorkflowInstanceManager } from './WorkflowInstance';
import { WorkflowDefinition } from './types';
import { WorkflowDefinitionRepository } from './WorkflowRepository';

const logger = require('pino')({ name: 'TriggerManager' });

/**
 * 事件过滤匹配结果
 */
interface FilterMatchResult {
  matched: boolean;
  matchedFields?: Record<string, any>;
  reason?: string;
}

/**
 * 触发器订阅记录
 */
interface TriggerSubscription {
  triggerId: string;
  eventType: string;
  unsubscribe: () => Promise<void>;
}

/**
 * 触发器管理器
 *
 * 管理工作流的事件触发器订阅和执行
 */
export class TriggerManager {
  private triggerRepo: WorkflowTriggerRepository;
  private eventBus?: EventBusService;
  private instanceManager: WorkflowInstanceManager;
  private workflowRepo: WorkflowDefinitionRepository;
  private subscriptions: Map<string, TriggerSubscription> = new Map();
  private initialized: boolean = false;

  constructor(
    triggerRepo: WorkflowTriggerRepository,
    eventBus?: EventBusService,
    instanceManager?: WorkflowInstanceManager
  ) {
    this.triggerRepo = triggerRepo;
    this.eventBus = eventBus;
    this.instanceManager = instanceManager || new WorkflowInstanceManager();
    this.workflowRepo = new WorkflowDefinitionRepository();
  }

  /**
   * 初始化：加载并订阅所有事件触发器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('TriggerManager already initialized');
      return;
    }

    logger.info('Initializing TriggerManager...');

    try {
      // 加载所有启用的 'event' 类型触发器
      const triggers = await this.triggerRepo.findByType('event');

      const enabledTriggers = triggers.filter(t => t.enabled && t.eventType);

      logger.info({ count: enabledTriggers.length }, 'Found enabled event triggers');

      // 订阅每个触发器
      for (const trigger of enabledTriggers) {
        try {
          await this.subscribeTrigger(trigger);
        } catch (error) {
          logger.error(
            { triggerId: trigger.id, error: String(error) },
            'Failed to subscribe trigger'
          );
        }
      }

      this.initialized = true;
      logger.info('TriggerManager initialized successfully');
    } catch (error) {
      logger.error({ error: String(error) }, 'Failed to initialize TriggerManager');
      throw error;
    }
  }

  /**
   * 订阅单个触发器
   */
  private async subscribeTrigger(trigger: WorkflowTrigger): Promise<void> {
    if (!trigger.eventType || !this.eventBus) {
      return;
    }

    const key = `${trigger.id}:${trigger.eventType}`;

    // 如果已经订阅，先取消
    if (this.subscriptions.has(key)) {
      await this.unsubscribeTrigger(trigger.id);
    }

    const unsubscribe = await this.eventBus.subscribe(
      trigger.eventType,
      async (event: TypedEnvelope<any>) => {
        await this.handleEvent(trigger.id, event);
      }
    );

    this.subscriptions.set(key, {
      triggerId: trigger.id,
      eventType: trigger.eventType,
      unsubscribe,
    });

    logger.info(
      { triggerId: trigger.id, eventType: trigger.eventType },
      'Subscribed to trigger event'
    );
  }

  /**
   * 取消订阅触发器
   */
  private async unsubscribeTrigger(triggerId: string): Promise<void> {
    for (const [key, sub] of this.subscriptions.entries()) {
      if (sub.triggerId === triggerId) {
        try {
          await sub.unsubscribe();
          this.subscriptions.delete(key);
          logger.info({ triggerId }, 'Unsubscribed trigger');
        } catch (error) {
          logger.error(
            { triggerId, error: String(error) },
            'Failed to unsubscribe trigger'
          );
        }
        break;
      }
    }
  }

  /**
   * 事件触发处理
   */
  private async handleEvent(
    triggerId: string,
    event: TypedEnvelope<any>
  ): Promise<void> {
    try {
      // 获取触发器配置
      const trigger = await this.triggerRepo.findById(triggerId);
      if (!trigger) {
        logger.warn({ triggerId }, 'Trigger not found');
        return;
      }

      if (!trigger.enabled) {
        logger.debug({ triggerId }, 'Trigger is disabled, skipping');
        return;
      }

      // 检查事件过滤条件
      const filterResult = this.matchEventFilter(trigger.eventFilter, event);
      if (!filterResult.matched) {
        logger.debug(
          { triggerId, eventType: event.type, reason: filterResult.reason },
          'Event did not match filter'
        );
        return;
      }

      // 获取工作流定义
      const workflowDef = await this.workflowRepo.findById(trigger.workflowId);
      if (!workflowDef) {
        logger.error({ triggerId, workflowId: trigger.workflowId }, 'Workflow definition not found');
        return;
      }

      if (!workflowDef.enabled) {
        logger.warn({ triggerId, workflowId: trigger.workflowId }, 'Workflow is disabled');
        return;
      }

      // 合并事件数据和过滤匹配的数据
      const input = {
        ...(event.data as Record<string, any>),
        ...filterResult.matchedFields,
        _triggerId: triggerId,
        _eventType: event.type,
        _eventId: event.id,
      };

      // 创建工作流实例
      const instance = await this.instanceManager.create(
        workflowDef as unknown as WorkflowDefinition,
        input,
        'trigger:event'
      );

      logger.info(
        { triggerId, workflowId: trigger.workflowId, instanceId: instance.id },
        'Created workflow instance from event trigger'
      );

      // 启动工作流实例
      await this.instanceManager.start(instance.id);

      logger.info(
        { triggerId, instanceId: instance.id },
        'Started workflow instance from event trigger'
      );
    } catch (error) {
      logger.error(
        { triggerId, error: String(error) },
        'Error handling event trigger'
      );
    }
  }

  /**
   * 事件过滤匹配
   *
   * 支持以下过滤规则：
   * - 字段精确匹配: { "field": "value" }
   * - 字段包含: { "field": { "$contains": "value" } }
   * - 数值比较: { "field": { "$gt": 100 } }
   * - 正则匹配: { "field": { "$regex": "^abc.*" } }
   */
  private matchEventFilter(
    filter: Record<string, any> | undefined,
    event: TypedEnvelope<any>
  ): FilterMatchResult {
    if (!filter || Object.keys(filter).length === 0) {
      // 无过滤条件，匹配所有事件
      return { matched: true };
    }

    const payload = (event.data as Record<string, any>) || {};
    const matchedFields: Record<string, any> = {};

    for (const [key, expectedValue] of Object.entries(filter)) {
      const actualValue = this.getNestedValue(payload, key);

      if (actualValue === undefined) {
        return {
          matched: false,
          reason: `Field "${key}" not found in event payload`,
        };
      }

      // 处理复杂的过滤条件
      if (typeof expectedValue === 'object' && expectedValue !== null) {
        const opResult = this.matchOperator(expectedValue, actualValue);
        if (!opResult.matched) {
          return opResult;
        }
      } else {
        // 精确匹配
        if (actualValue !== expectedValue) {
          return {
            matched: false,
            reason: `Field "${key}" value mismatch: expected "${expectedValue}", got "${actualValue}"`,
          };
        }
      }

      matchedFields[key] = actualValue;
    }

    return { matched: true, matchedFields };
  }

  /**
   * 操作符匹配
   */
  private matchOperator(
    condition: Record<string, any>,
    actualValue: any
  ): FilterMatchResult {
    for (const [operator, expectedValue] of Object.entries(condition)) {
      switch (operator) {
        case '$eq':
          if (actualValue !== expectedValue) {
            return { matched: false, reason: `Value not equal: ${expectedValue}` };
          }
          break;

        case '$ne':
          if (actualValue === expectedValue) {
            return { matched: false, reason: `Value should not equal: ${expectedValue}` };
          }
          break;

        case '$gt':
          if (!(actualValue > expectedValue)) {
            return { matched: false, reason: `Value not greater than: ${expectedValue}` };
          }
          break;

        case '$gte':
          if (!(actualValue >= expectedValue)) {
            return { matched: false, reason: `Value not greater or equal: ${expectedValue}` };
          }
          break;

        case '$lt':
          if (!(actualValue < expectedValue)) {
            return { matched: false, reason: `Value not less than: ${expectedValue}` };
          }
          break;

        case '$lte':
          if (!(actualValue <= expectedValue)) {
            return { matched: false, reason: `Value not less or equal: ${expectedValue}` };
          }
          break;

        case '$contains':
          if (typeof actualValue === 'string') {
            if (!actualValue.includes(expectedValue)) {
              return { matched: false, reason: `String does not contain: ${expectedValue}` };
            }
          } else if (Array.isArray(actualValue)) {
            if (!actualValue.includes(expectedValue)) {
              return { matched: false, reason: `Array does not contain: ${expectedValue}` };
            }
          } else {
            return { matched: false, reason: `$contains only works with string or array` };
          }
          break;

        case '$in':
          if (!Array.isArray(expectedValue)) {
            return { matched: false, reason: `$in requires an array` };
          }
          if (!expectedValue.includes(actualValue)) {
            return { matched: false, reason: `Value not in: [${expectedValue.join(', ')}]` };
          }
          break;

        case '$regex':
          try {
            const regex = new RegExp(expectedValue);
            if (!regex.test(actualValue)) {
              return { matched: false, reason: `Value does not match regex: ${expectedValue}` };
            }
          } catch (e) {
            return { matched: false, reason: `Invalid regex: ${expectedValue}` };
          }
          break;

        default:
          logger.warn({ operator }, 'Unknown filter operator');
          return { matched: false, reason: `Unknown operator: ${operator}` };
      }
    }

    return { matched: true };
  }

  /**
   * 获取嵌套属性值
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * 创建触发器
   */
  async createTrigger(data: CreateWorkflowTriggerInput): Promise<WorkflowTrigger> {
    const trigger = await this.triggerRepo.create(data);

    // 如果是事件类型触发器且已初始化，立即订阅
    if (trigger.type === 'event' && trigger.enabled && this.initialized) {
      try {
        await this.subscribeTrigger(trigger);
      } catch (error) {
        logger.error(
          { triggerId: trigger.id, error: String(error) },
          'Failed to subscribe new trigger'
        );
      }
    }

    logger.info({ triggerId: trigger.id, type: trigger.type }, 'Created trigger');
    return trigger;
  }

  /**
   * 更新触发器
   */
  async updateTrigger(
    id: string,
    data: UpdateWorkflowTriggerInput
  ): Promise<WorkflowTrigger | null> {
    const oldTrigger = await this.triggerRepo.findById(id);
    if (!oldTrigger) {
      return null;
    }

    const updatedTrigger = await this.triggerRepo.update(id, data);
    if (!updatedTrigger) {
      return null;
    }

    // 处理事件类型触发器的订阅变更
    if (oldTrigger.type === 'event' && this.initialized) {
      // 如果禁用或更改了事件类型，取消旧订阅
      if (!updatedTrigger.enabled || updatedTrigger.eventType !== oldTrigger.eventType) {
        await this.unsubscribeTrigger(id);
      }

      // 如果启用且有事件类型，建立新订阅
      if (updatedTrigger.enabled && updatedTrigger.eventType) {
        try {
          await this.subscribeTrigger(updatedTrigger);
        } catch (error) {
          logger.error(
            { triggerId: id, error: String(error) },
            'Failed to update trigger subscription'
          );
        }
      }
    }

    logger.info({ triggerId: id }, 'Updated trigger');
    return updatedTrigger;
  }

  /**
   * 删除触发器
   */
  async deleteTrigger(id: string): Promise<void> {
    // 取消订阅
    if (this.initialized) {
      await this.unsubscribeTrigger(id);
    }

    await this.triggerRepo.delete(id);
    logger.info({ triggerId: id }, 'Deleted trigger');
  }

  /**
   * 获取所有触发器
   */
  async getTriggers(): Promise<{ entities: WorkflowTrigger[]; total: number }> {
    return await this.triggerRepo.findAll();
  }

  /**
   * 根据ID获取触发器
   */
  async getTriggerById(id: string): Promise<WorkflowTrigger | undefined> {
    return await this.triggerRepo.findById(id);
  }

  /**
   * 根据工作流ID获取触发器
   */
  async getTriggersByWorkflow(workflowId: string): Promise<WorkflowTrigger[]> {
    return await this.triggerRepo.findByWorkflowId(workflowId);
  }

  /**
   * 获取订阅状态
   */
  getSubscriptionStatus(): Array<{ triggerId: string; eventType: string }> {
    const status: Array<{ triggerId: string; eventType: string }> = [];
    for (const [, sub] of this.subscriptions.entries()) {
      status.push({
        triggerId: sub.triggerId,
        eventType: sub.eventType,
      });
    }
    return status;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 关闭管理器，取消所有订阅
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down TriggerManager...');

    for (const [key, sub] of this.subscriptions.entries()) {
      try {
        await sub.unsubscribe();
        logger.debug({ triggerId: sub.triggerId }, 'Unsubscribed');
      } catch (error) {
        logger.error(
          { triggerId: sub.triggerId, error: String(error) },
          'Failed to unsubscribe'
        );
      }
    }

    this.subscriptions.clear();
    this.initialized = false;

    logger.info('TriggerManager shutdown complete');
  }
}