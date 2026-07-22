// @ts-nocheck
/**
 * WorkflowEngine - 工作流引擎核心（门面）
 *
 * 基于设计文档：docs/superpowers/specs/2026-05-19-lowcode-platform-detailed-design.md
 * A.3.2 工作流引擎核心接口
 *
 * 职责：
 * - 工作流实例生命周期管理（创建、执行、暂停、恢复、终止）
 * - 委托 WorkflowNodeExecutor 执行节点逻辑
 * - 委托 WorkflowExpressionEvaluator 处理表达式求值
 * - 服务适配器创建（审批/通知/Webhook）
 *
 * Phase 1.3: 支持注入真实服务实例（ApprovalFlowEngine、NotificationService、WebhookService）
 * 替代 placeholder 实现，同时保持向后兼容。
 */

import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNodeType,
  WorkflowExecutionResult,
  WorkflowState,
  WorkflowServices,
  WorkflowExecutionContext,
  StartNodeConfig,
  ApprovalNodeConfig,
  ConditionNodeConfig,
  NotificationNodeConfig,
  WebhookNodeConfig,
  EndNodeConfig,
  ConditionEvalResult,
  TaskNodeConfig,
  SubWorkflowNodeConfig,
  DelayNodeConfig,
  TimerNodeConfig,
  VariableMapping,
} from './types';
import { WorkflowDefinitionRepository } from './WorkflowRepository';
import { WorkflowInstanceManager } from './WorkflowInstance';
import { WorkflowTimerRepository } from '../../repositories/WorkflowTimerRepository';
import { WorkflowTaskRepository } from '../../repositories/WorkflowTaskRepository';
import { DatabasePool } from '../../services/database';
import { ApprovalFlowEngine } from '../approval/ApprovalFlowEngine';
import type { ApprovalFlowConfig, FlowStartContext, ApprovalResult as ApprovalFlowResult } from '../approval/ApprovalFlowEngine';
import { NotificationService } from '../notification/NotificationService';
import { WebhookService } from '../webhook/WebhookService';
import { OrionError, ErrorCode } from '../../errors';
import { safeFetch } from '../../utils/safeFetch';
import { WorkflowExpressionEvaluator } from './WorkflowExpressionEvaluator';
import { WorkflowNodeExecutor, WorkflowNodeExecutorDependencies } from './WorkflowNodeExecutor';

const logger = createLogger('WorkflowEngine');

/**
 * 工作流引擎依赖注入接口
 *
 * 用于注入真实的服务实例，替代 placeholder 实现。
 * 所有字段均为可选：未注入时使用 placeholder 默认实现。
 */
export interface WorkflowEngineDependencies {
  /** 审批流程引擎 - 用于 approval 节点 */
  approvalEngine?: ApprovalFlowEngine;
  /** 通知服务 - 用于 notification 节点 */
  notificationService?: NotificationService;
  /** Webhook 服务 - 用于 webhook 节点（直接 HTTP 调用时使用 safeFetch） */
  webhookService?: WebhookService;
}

/**
 * 审批结果缓存（approvalId -> 审批结果）
 * 用于在 createApproval 和 waitForApproval 之间传递状态
 */
interface ApprovalCacheEntry {
  ticketId: string;
  status: 'pending' | 'approved' | 'rejected';
  approvalResult: ApprovalFlowResult;
  /** 缓存过期时间 */
  expiresAt: number;
}

/** 审批缓存最大条目数 */
const MAX_APPROVAL_CACHE_SIZE = 5000;
/** 审批缓存默认 TTL（24 小时） */
const APPROVAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 工作流引擎
 */
export class WorkflowEngine {
  private definitionRepository: WorkflowDefinitionRepository;
  private instanceManager: WorkflowInstanceManager;
  private timerRepository: WorkflowTimerRepository;
  private taskRepository: WorkflowTaskRepository;
  private services: WorkflowServices;
  private dependencies: WorkflowEngineDependencies;
  /** 审批结果缓存，用于跨方法调用传递状态 */
  private approvalCache: Map<string, ApprovalCacheEntry> = new Map();
  private expressionEvaluator: WorkflowExpressionEvaluator;
  private nodeExecutor: WorkflowNodeExecutor;

  constructor(
    services?: WorkflowServices,
    dependencies?: WorkflowEngineDependencies,
    databasePool?: DatabasePool,
  ) {
    this.definitionRepository = new WorkflowDefinitionRepository(null as any);
    this.instanceManager = new WorkflowInstanceManager(null as any);
    this.timerRepository = new WorkflowTimerRepository();
    this.taskRepository = new WorkflowTaskRepository(databasePool);
    this.dependencies = dependencies || {};
    this.expressionEvaluator = new WorkflowExpressionEvaluator();

    // 创建节点执行器
    const executorDependencies: WorkflowNodeExecutorDependencies = {
      services: services || this.createDefaultServices(),
      timerRepository: this.timerRepository,
      taskRepository: this.taskRepository,
      instanceManager: this.instanceManager,
      expressionEvaluator: this.expressionEvaluator,
      createInstance: this.createInstance.bind(this),
      execute: this.execute.bind(this),
    };
    this.nodeExecutor = new WorkflowNodeExecutor(executorDependencies);
    this.services = executorDependencies.services;
  }

  // ==================== 公开 API ====================

  /**
   * 创建工作流实例
   *
   * @param workflowId 工作流定义 ID
   * @param input 输入数据
   * @param createdBy 创建者
   */
  async createInstance(
    workflowId: string,
    input: Record<string, any>,
    createdBy: string
  ): Promise<WorkflowInstance> {
    // 获取工作流定义
    const definition = await this.definitionRepository.findById(workflowId);
    if (!definition) {
      throw new OrionError(`Workflow definition not found: ${workflowId}`, ErrorCode.NOT_FOUND);
    }

    if (!definition.enabled) {
      throw new OrionError(`Workflow is not enabled: ${workflowId}`, ErrorCode.NOT_FOUND);
    }

    // 创建实例
    const instance = await this.instanceManager.create(definition, input, createdBy);

    logger.info({ instanceId: instance.id, workflowId }, 'Workflow instance created');
    return instance;
  }

  /**
   * 执行工作流
   *
   * @param instanceId 实例 ID
   */
  async execute(instanceId: string): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const executedNodes: string[] = [];

    // 获取实例和定义
    const instance = await this.instanceManager.getInstance(instanceId);
    if (!instance) {
      throw new OrionError(`Workflow instance not found: ${instanceId}`, ErrorCode.NOT_FOUND);
    }

    const definition = await this.definitionRepository.findById(instance.workflowDefinitionId);
    if (!definition) {
      throw new OrionError(`Workflow definition not found: ${instance.workflowDefinitionId}`, ErrorCode.NOT_FOUND);
    }

    // 检查实例状态（允许 pending/suspended/running，running 用于 resume 场景）
    if (instance.status !== 'pending' && instance.status !== 'suspended' && instance.status !== 'running') {
      throw new OrionError(`Cannot execute workflow instance with status: ${instance.status}`, ErrorCode.NOT_FOUND);
    }

    // 启动实例
    await this.instanceManager.start(instanceId);

    const context: WorkflowExecutionContext = {
      instance,
      definition,
      services: this.services,
      startTime: new Date(),
    };

    try {
      // 执行流程直到完成
      let currentInstance = instance;
      let continueExecution = true;

      while (continueExecution) {
        // 获取当前节点
        const currentNode = definition.nodes.find(n => n.id === currentInstance.currentNodeId);
        if (!currentNode) {
          throw new OrionError(`Node not found: ${currentInstance.currentNodeId}`, ErrorCode.NOT_FOUND);
        }

        executedNodes.push(currentNode.id);

        // 记录节点进入
        await this.instanceManager.addHistory(currentInstance.id, {
          nodeId: currentNode.id,
          nodeName: currentNode.name,
          nodeType: currentNode.type,
          action: 'enter',
          data: { variables: currentInstance.variables },
        });

        // 执行节点
        const nodeResult = await this.nodeExecutor.executeNode(currentNode, currentInstance, context);

        // 记录节点执行完成
        await this.instanceManager.addHistory(currentInstance.id, {
          nodeId: currentNode.id,
          nodeName: currentNode.name,
          nodeType: currentNode.type,
          action: 'exit',
          data: nodeResult.outputVariables,
        });

        // 更新变量
        if (nodeResult.outputVariables) {
          currentInstance = await this.instanceManager.updateVariables(
            currentInstance.id,
            nodeResult.outputVariables
          );
        }

        // 判断是否继续执行
        if (nodeResult.terminated) {
          continueExecution = false;
          if (nodeResult.error) {
            await this.instanceManager.fail(currentInstance.id, nodeResult.error);
          } else {
            await this.instanceManager.complete(currentInstance.id, nodeResult.outputVariables);
          }
        } else if (nodeResult.nextNodeId) {
          currentInstance = await this.instanceManager.moveToNode(
            currentInstance.id,
            nodeResult.nextNodeId,
            nodeResult.outputVariables
          );
        } else {
          // 没有下一个节点，完成执行
          continueExecution = false;
          await this.instanceManager.complete(currentInstance.id, nodeResult.outputVariables);
        }

        // 检查是否被暂停
        const updatedInstance = await this.instanceManager.getInstance(currentInstance.id);
        if (updatedInstance?.status === 'suspended') {
          continueExecution = false;
        }
      }

      // 获取最终状态
      const finalInstance = await this.instanceManager.getInstance(instanceId);
      const executionTime = Date.now() - startTime;

      return {
        success: finalInstance?.status === 'completed',
        instanceId,
        output: finalInstance?.output,
        executedNodes,
        executionTime,
        trace: finalInstance?.history,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, instanceId }, 'Workflow execution failed');

      await this.instanceManager.fail(instanceId, errorMessage);

      return {
        success: false,
        instanceId,
        error: errorMessage,
        executedNodes,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 暂停工作流
   */
  async suspend(instanceId: string): Promise<void> {
    await this.instanceManager.suspend(instanceId);
  }

  /**
   * 恢复工作流
   * @param instanceId 实例 ID
   * @param extraVariables 可选，合并到实例变量中的额外数据
   */
  async resume(instanceId: string, extraVariables?: Record<string, any>): Promise<void> {
    if (extraVariables) {
      await this.instanceManager.updateVariables(instanceId, extraVariables);
    }
    // 注意：不调用 instanceManager.resume()，因为 execute() 会自动将 suspended 转为 running
    // 直接执行，execute() 内部会处理状态转换
    await this.execute(instanceId);
  }

  /**
   * 通过事件恢复工作流实例
   *
   * 用于人工任务完成后的事件驱动唤醒。
   * 外部系统（如任务服务）在任务完成后调用此方法。
   *
   * @param instanceId 工作流实例 ID
   * @param taskResult 任务完成结果
   * @param nextNodeId 可选，恢复后跳转的下一个节点 ID。如果不提供，从实例变量中读取
   */
  async resumeFromEvent(instanceId: string, taskResult: Record<string, any>, nextNodeId?: string): Promise<void> {
    logger.info({ instanceId, taskResult, nextNodeId }, 'Resuming workflow instance from event');

    // 更新实例变量，合并任务结果
    const instance = await this.instanceManager.getInstance(instanceId);
    if (!instance) {
      throw new OrionError(`Workflow instance not found: ${instanceId}`, ErrorCode.NOT_FOUND);
    }

    if (instance.status !== 'suspended') {
      throw new OrionError(`Cannot resume workflow instance with status: ${instance.status}. Expected 'suspended'.`, ErrorCode.NOT_FOUND);
    }

    // 合并任务结果到实例变量
    const updatedVariables = {
      ...instance.variables,
      _lastTaskResult: taskResult,
      _resumedAt: new Date().toISOString(),
    };

    await this.instanceManager.updateVariables(instanceId, updatedVariables);

    // 推进到下一个节点（避免重复执行 task 节点）
    const targetNodeId = nextNodeId || taskResult.nextNodeId || instance.currentNodeId;
    if (targetNodeId !== instance.currentNodeId) {
      await this.instanceManager.moveToNode(instanceId, targetNodeId);
      logger.info({ instanceId, from: instance.currentNodeId, to: targetNodeId }, 'Advanced to next node after task completion');
    }

    // 恢复实例并继续执行
    await this.resume(instanceId);
  }

  /**
   * 终止工作流
   */
  async terminate(instanceId: string, reason?: string): Promise<void> {
    await this.instanceManager.terminate(instanceId, reason);
  }

  /**
   * 获取工作流状态
   */
  async getState(instanceId: string): Promise<WorkflowState> {
    return await this.instanceManager.getState(instanceId);
  }

  // ==================== 服务适配器 ====================

  /**
   * 创建审批服务适配器 - 桥接 ApprovalFlowEngine
   *
   * 当注入 ApprovalFlowEngine 时，使用真实审批流程：
   * - createApproval: 调用 ApprovalFlowEngine.matchFlow + startFlow
   * - getApprovalStatus: 通过缓存或引擎查询审批状态
   * - waitForApproval: 轮询审批状态直到完成或超时
   *
   * 未注入时返回 placeholder 实现
   */
  private createApprovalAdapter(): WorkflowServices['approval'] {
    const engine = this.dependencies.approvalEngine;

    if (!engine) {
      logger.warn('ApprovalFlowEngine not injected, using placeholder approval service');
      return this.createPlaceholderApprovalService();
    }

    const self = this;

    const adapter: WorkflowServices['approval'] = {
      /**
       * 创建审批 - 调用 ApprovalFlowEngine
       * 返回 approvalId（实际是 ApprovalFlowEngine 返回的 ticketId）
       */
      async createApproval(
        config: ApprovalNodeConfig,
        context: Record<string, any>
      ): Promise<string> {
        try {
          // 构建 FlowStartContext
          const flowContext: FlowStartContext = {
            capabilityId: config.approvalFlowConfig?.flowId || 'workflow-approval',
            environment: context.variables?.environment || 'default',
            riskLevel: config.approverType === 'role' ? 2 : 1,
            resourceType: 'workflow',
            resourceId: context.workflowInstanceId || uuidv4(),
            requesterId: context.createdBy || 'system',
            title: `Workflow Approval: ${context.workflowName || 'Unknown'}`,
            description: `审批流程节点 - ${config.approverType} 审批`,
            metadata: {
              workflowInstanceId: context.workflowInstanceId,
              workflowName: context.workflowName,
              approvalNodeConfig: config,
            },
          };

          // 匹配审批流程配置
          let flowConfig: ApprovalFlowConfig | undefined = config.approvalFlowConfig;
          if (!flowConfig) {
            // 从引擎中自动匹配流程
            const matched = await engine.matchFlow(
              flowContext.capabilityId,
              flowContext.environment,
              flowContext.riskLevel,
              'default',
            );
            if (matched) {
              flowConfig = matched;
            }
          }

          if (!flowConfig) {
            // 没有匹配的流程，使用默认配置
            logger.warn({ capabilityId: flowContext.capabilityId }, 'No matching flow config, using default');
            // 将 approverType 映射为 ApprovalFlowNode 兼容类型
            const mappedApproverType = config.approverType === 'dynamic'
              ? 'role' as const
              : config.approverType as 'user' | 'role';

            flowConfig = {
              id: `flow_${uuidv4()}`,
              tenantId: 'default',
              flowId: 'default-workflow',
              name: 'Default Workflow Approval',
              enabled: true,
              nodes: [{
                id: 'default-node',
                name: 'Default Approver',
                nodeType: 'human' as const,
                approverType: mappedApproverType,
                approverValue: config.approverIds?.[0] || 'admin',
                timeoutMinutes: config.timeout * 60,
                timeoutAction: config.timeoutAction === 'approve' ? 'approve' as const :
                                config.timeoutAction === 'reject' ? 'reject' as const : 'remind' as const,
                onApprove: 'next' as const,
                onReject: 'reject' as const,
              }],
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }

          // 启动审批流程
          const result = await engine.startFlow(flowConfig, flowContext, 'default');

          if (!result.success) {
            logger.error({ error: result.message }, 'Failed to start approval flow');
            throw new OrionError(`Failed to start approval: ${result.message}`, 'OPERATION_FAILED')
          }

          const approvalId = `approval_${result.ticketId}`;

          // 缓存审批结果，供后续查询使用
          self.approvalCache.set(approvalId, {
            ticketId: result.ticketId,
            status: result.status,
            approvalResult: result,
            expiresAt: Date.now() + APPROVAL_CACHE_TTL_MS,
          });

          // 清理过期条目 + 防止无限增长
          self.cleanupApprovalCache();

          logger.info({ approvalId, ticketId: result.ticketId }, 'Approval flow started');
          return approvalId;
        } catch (error) {
          logger.error({ error }, 'createApproval failed');
          throw error;
        }
      },

      /**
       * 获取审批状态
       * 优先从缓存读取，其次通过引擎查询
       */
      async getApprovalStatus(
        approvalId: string
      ): Promise<'pending' | 'approved' | 'rejected'> {
        // 先从缓存查找（检查是否过期）
        const cached = self.approvalCache.get(approvalId);
        if (cached && cached.expiresAt > Date.now() && cached.status !== 'pending') {
          return cached.status;
        }

        // 通过引擎查询（如果审批还在进行中）
        if (cached && engine) {
          try {
            // 注意：ApprovalFlowEngine 当前没有直接的 getStatus 方法
            // 实际生产中需要添加此方法，这里暂时返回缓存状态
            logger.debug({ approvalId }, 'Approval status query - using cached status');
          } catch (error) {
            logger.error({ error, approvalId }, 'Failed to query approval status');
          }
        }

        const finalStatus: 'pending' | 'approved' | 'rejected' = cached?.status || 'pending';
        return finalStatus;
      },

      /**
       * 等待审批完成
       * 轮询审批状态直到完成或超时
       */
      async waitForApproval(
        approvalId: string,
        timeoutMs: number
      ): Promise<boolean> {
        const startTime = Date.now();
        const pollInterval = 5000; // 每 5 秒轮询一次

        while (Date.now() - startTime < timeoutMs) {
          const cached = self.approvalCache.get(approvalId);
          if (cached && cached.expiresAt > Date.now() && cached.status !== 'pending') {
            return cached.status === 'approved';
          }

          // 等待下一次轮询
          await self.sleep(pollInterval);
        }

        // 超时
        logger.warn({ approvalId, timeoutMs }, 'Approval wait timed out');
        return false;
      },
    };

    return adapter;
  }

  /**
   * 创建 placeholder 审批服务（向后兼容）
   */
  private createPlaceholderApprovalService() {
    return {
      createApproval: async (config: ApprovalNodeConfig, context: Record<string, any>) => {
        logger.warn('Using default approval service - should integrate ApprovalFlowEngine');
        return uuidv4();
      },
      getApprovalStatus: async (approvalId: string): Promise<'pending' | 'approved' | 'rejected'> => {
        return 'approved';
      },
      waitForApproval: async (approvalId: string, timeout: number) => {
        return true;
      },
    };
  }

  /**
   * 创建通知服务适配器 - 桥接 NotificationService
   *
   * 当注入 NotificationService 时，将工作流通知配置转换为
   * CreateNotificationInput 格式并发送。
   *
   * 未注入时返回 placeholder 实现
   */
  private createNotificationAdapter(): WorkflowServices['notification'] {
    const service = this.dependencies.notificationService;

    if (!service) {
      logger.warn('NotificationService not injected, using placeholder notification service');
      return this.createPlaceholderNotificationService();
    }

    const self = this;

    return {
      /**
       * 发送通知 - 调用 NotificationService
       *
       * 将 NotificationNodeConfig 转换为 CreateNotificationInput:
       * - channels -> channel (取第一个)
       * - receivers -> user_id (取第一个 user 类型的接收者)
       * - template -> title/message
       */
      async send(
        config: NotificationNodeConfig,
        variables: Record<string, any>
      ): Promise<void> {
        try {
          // 确定 channel
          const channelMap: Record<string, string> = {
            dingtalk: 'dingtalk',
            wecom: 'wecom',
            feishu: 'feishu',
            email: 'email',
          };
          const channel = config.channels.length > 0
            ? (channelMap[config.channels[0]] || 'in-app')
            : 'in-app';

          // 确定接收者（取第一个 user 类型）
          const userReceiver = config.receivers.find(r => r.type === 'user');
          const userId = userReceiver ? userReceiver.value : 'system';

          // 构建通知标题和消息
          const title = self.expressionEvaluator.renderString(config.template, variables);
          const message = Object.entries(variables)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n') || title;

          // 构造 NotificationService 输入
          const input = {
            tenant_id: variables.tenantId || getCurrentTenantId(),
            user_id: userId,
            type: 'workflow_notification',
            title,
            message,
            channel,
          };

          await service.send(input);

          logger.info(
            { channel, userId, title },
            'Notification sent via NotificationService'
          );
        } catch (error) {
          logger.error({ error, config }, 'Failed to send notification');
          throw error;
        }
      },
    };
  }

  /**
   * 创建 placeholder 通知服务（向后兼容）
   */
  private createPlaceholderNotificationService() {
    return {
      send: async (config: NotificationNodeConfig, variables: Record<string, any>) => {
        logger.info({ config, variables }, 'Notification sent (default implementation)');
      },
    };
  }

  /**
   * 创建 Webhook 服务适配器
   *
   * 当注入 WebhookService 时，使用其 trigger 方法。
   * 但 WebhookService 设计为基于预注册 webhooks 的持久化调用，
   * 而工作流的 webhook 节点是临时的 HTTP 调用，所以主要使用 safeFetch 直接调用。
   *
   * 未注入时返回 placeholder 实现
   */
  private createWebhookAdapter(): WorkflowServices['webhook'] {
    const service = this.dependencies.webhookService;

    if (!service) {
      logger.warn('WebhookService not injected, using placeholder webhook service');
      return this.createPlaceholderWebhookService();
    }

    return {
      /**
       * 调用 Webhook - 直接 HTTP 调用
       *
       * WebhookService 的 trigger 方法需要 webhook ID，适用于持久化 webhook。
       * 工作流 webhook 节点是临时调用，使用 safeFetch 直接发送请求。
       */
      async call(
        config: {
          url: string;
          method: 'GET' | 'POST' | 'PUT' | 'DELETE';
          headers?: Record<string, string>;
          body?: string;
          timeout: number;
        },
        variables: Record<string, any>
      ): Promise<any> {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

          const safeFetchOptions: RequestInit = {
            method: config.method,
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            signal: controller.signal,
          };

          if (config.body && config.method !== 'GET') {
            safeFetchOptions.body = config.body;
          }

          const response = await safeFetch(config.url, safeFetchOptions);
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new OrionError(`HTTP ${response.status}: ${response.statusText}`, 'OPERATION_FAILED')
          }

          // 尝试解析 JSON 响应
          const contentType = response.headers.get('content-type');
          let result: any;
          if (contentType && contentType.includes('application/json')) {
            result = await response.json();
          } else {
            result = { status: response.status, body: await response.text() };
          }

          logger.info(
            { url: config.url, method: config.method, status: response.status },
            'Webhook call succeeded'
          );

          return {
            success: true,
            statusCode: response.status,
            data: result,
          };
        } catch (error: any) {
          logger.error({ error, url: config.url }, 'Webhook call failed');
          throw error;
        }
      },
    };
  }

  /**
   * 创建 placeholder Webhook 服务（向后兼容）
   */
  private createPlaceholderWebhookService() {
    return {
      call: async (config: any, variables: Record<string, any>) => {
        logger.info({ config, variables }, 'Webhook called (default implementation)');
        return { success: true };
      },
    };
  }

  /**
   * 创建默认服务
   *
   * 优先级：
   * 1. 如果注入了真实服务，使用适配器桥接到 WorkflowServices 接口
   * 2. 如果未注入，使用 placeholder 默认实现（向后兼容）
   */
  private createDefaultServices(): WorkflowServices {
    return {
      approval: this.createApprovalAdapter(),
      notification: this.createNotificationAdapter(),
      webhook: this.createWebhookAdapter(),
    };
  }

  // ==================== 审批缓存管理 ====================

  /**
   * 清理审批缓存：移除过期条目，限制最大大小
   */
  private cleanupApprovalCache(): void {
    const now = Date.now();

    // 清理过期条目
    for (const [key, entry] of this.approvalCache.entries()) {
      if (entry.expiresAt < now) {
        this.approvalCache.delete(key);
      }
    }

    // 如果仍然超过限制，删除最早的条目（FIFO）
    while (this.approvalCache.size > MAX_APPROVAL_CACHE_SIZE) {
      const firstKey = this.approvalCache.keys().next().value;
      if (firstKey !== undefined) {
        this.approvalCache.delete(firstKey);
      } else {
        break;
      }
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建工作流引擎实例
 *
 * @param services 自定义服务实现（旧接口，向后兼容）
 * @param dependencies 依赖注入（新接口，推荐使用）
 */
export function createWorkflowEngine(
  services?: WorkflowServices,
  dependencies?: WorkflowEngineDependencies,
): WorkflowEngine {
  return new WorkflowEngine(services, dependencies);
}

// ==================== 默认导出 ====================

export default WorkflowEngine;
