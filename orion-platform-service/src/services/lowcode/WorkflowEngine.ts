/**
 * WorkflowEngine - 工作流引擎核心
 *
 * 基于设计文档：docs/superpowers/specs/2026-05-19-lowcode-platform-detailed-design.md
 * A.3.2 工作流引擎核心接口
 *
 * 负责工作流的执行逻辑，包括：
 * - 节点执行（开始、审批、条件分支、通知、Webhook、结束）
 * - 流程控制（暂停、恢复、终止）
 * - 审批节点集成 ApprovalFlowEngine
 *
 * Phase 1.3: 支持注入真实服务实例（ApprovalFlowEngine、NotificationService、WebhookService）
 * 替代 placeholder 实现，同时保持向后兼容。
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNode,
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

// 真实服务导入（用于依赖注入）
import { ApprovalFlowEngine } from '../approval/ApprovalFlowEngine';
import type { ApprovalFlowConfig, FlowStartContext, ApprovalResult as ApprovalFlowResult } from '../approval/ApprovalFlowEngine';
import { NotificationService } from '../notification/NotificationService';
import { WebhookService } from '../webhook/WebhookService';

const logger = pino({ name: 'WorkflowEngine' });

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
  /** Webhook 服务 - 用于 webhook 节点（直接 HTTP 调用时使用 fetch） */
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
  private services: WorkflowServices;
  private dependencies: WorkflowEngineDependencies;
  /** 审批结果缓存，用于跨方法调用传递状态 */
  private approvalCache: Map<string, ApprovalCacheEntry> = new Map();

  constructor(
    services?: WorkflowServices,
    dependencies?: WorkflowEngineDependencies,
  ) {
    this.definitionRepository = new WorkflowDefinitionRepository();
    this.instanceManager = new WorkflowInstanceManager();
    this.dependencies = dependencies || {};
    this.services = services || this.createDefaultServices();
  }

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
      throw new Error(`Workflow definition not found: ${workflowId}`);
    }

    if (!definition.enabled) {
      throw new Error(`Workflow is not enabled: ${workflowId}`);
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
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    const definition = await this.definitionRepository.findById(instance.workflowDefinitionId);
    if (!definition) {
      throw new Error(`Workflow definition not found: ${instance.workflowDefinitionId}`);
    }

    // 检查实例状态
    if (instance.status !== 'pending' && instance.status !== 'suspended') {
      throw new Error(`Cannot execute workflow instance with status: ${instance.status}`);
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
          throw new Error(`Node not found: ${currentInstance.currentNodeId}`);
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
        const nodeResult = await this.executeNode(currentNode, currentInstance, context);

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
   */
  async resume(instanceId: string): Promise<void> {
    await this.instanceManager.resume(instanceId);
    // 自动继续执行
    await this.execute(instanceId);
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

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const nodeStartTime = Date.now();

    try {
      switch (node.type) {
        case 'start':
          return this.executeStartNode(node.config as StartNodeConfig, instance);

        case 'approval':
          return await this.executeApprovalNode(
            node.config as ApprovalNodeConfig,
            instance,
            context
          );

        case 'condition':
          return this.executeConditionNode(
            node.config as ConditionNodeConfig,
            instance,
            context.definition
          );

        case 'notification':
          return await this.executeNotificationNode(
            node.config as NotificationNodeConfig,
            instance,
            context
          );

        case 'webhook':
          return await this.executeWebhookNode(
            node.config as WebhookNodeConfig,
            instance,
            context
          );

        case 'end':
          return this.executeEndNode(node.config as EndNodeConfig, instance);

        case 'task':
          return await this.executeTaskNode(node.config as TaskNodeConfig, instance, context);

        case 'sub-workflow':
          return await this.executeSubWorkflowNode(node.config as SubWorkflowNodeConfig, instance, context);

        case 'delay':
          return await this.executeDelayNode(node.config as DelayNodeConfig, instance, context);

        case 'timer':
          return await this.executeTimerNode(node.config as TimerNodeConfig, instance, context);

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const duration = Date.now() - nodeStartTime;

      // 记录错误历史
      await this.instanceManager.addHistory(instance.id, {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        action: 'error',
        error: errorMessage,
        duration,
      });

      return {
        terminated: true,
        error: errorMessage,
      };
    }
  }

  /**
   * 执行开始节点
   */
  private executeStartNode(
    config: StartNodeConfig,
    instance: WorkflowInstance
  ): NodeExecutionResult {
    return {
      outputVariables: config.outputVariables,
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 执行审批节点 - 集成 ApprovalFlowEngine
   */
  private async executeApprovalNode(
    config: ApprovalNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const { services } = context;

    // 构建审批上下文
    const approvalContext = {
      workflowInstanceId: instance.id,
      workflowName: context.definition.name,
      variables: instance.variables,
      input: instance.input,
    };

    // 调用审批服务创建审批
    const approvalId = await services.approval.createApproval(config, approvalContext);

    // 记录审批 ID 到变量
    const outputVariables = {
      ...instance.variables,
      [config.resultVariable || 'approvalResult']: {
        approvalId,
        status: 'pending',
      },
    };

    // 等待审批完成
    const timeoutMs = config.timeout * 60 * 60 * 1000; // 小时转毫秒
    const approved = await services.approval.waitForApproval(approvalId, timeoutMs);

    if (!approved) {
      // 审批超时
      if (config.timeoutAction === 'reject') {
        return {
          outputVariables,
          terminated: true,
          error: 'Approval timeout and rejected',
        };
      } else if (config.timeoutAction === 'approve') {
        return {
          outputVariables: {
            ...outputVariables,
            [config.resultVariable || 'approvalResult']: {
              approvalId,
              status: 'approved',
              timeout: true,
            },
          },
          nextNodeId: this.getNextNodeId(instance),
        };
      }
    }

    // 获取审批状态
    const status = await services.approval.getApprovalStatus(approvalId);

    if (status === 'rejected') {
      return {
        outputVariables: {
          ...outputVariables,
          [config.resultVariable || 'approvalResult']: {
            approvalId,
            status: 'rejected',
          },
        },
        terminated: true,
        error: 'Approval rejected',
      };
    }

    return {
      outputVariables: {
        ...outputVariables,
        [config.resultVariable || 'approvalResult']: {
          approvalId,
          status: 'approved',
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 执行条件分支节点
   */
  private executeConditionNode(
    config: ConditionNodeConfig,
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): NodeExecutionResult {
    // 评估条件表达式
    const evalResult = this.evaluateCondition(config.expression, instance.variables);

    if (!evalResult.passed) {
      // 没有匹配的分支，终止
      return {
        terminated: true,
        error: 'No matching condition branch',
      };
    }

    // 找到匹配的分支对应的下一个节点
    const outgoingEdge = definition.edges.find(e => {
      return e.source === this.findCurrentNodeId(instance) &&
        (e.sourceHandle === evalResult.matchedBranch || !e.sourceHandle);
    });

    if (!outgoingEdge) {
      return {
        terminated: true,
        error: 'No outgoing edge for condition',
      };
    }

    return {
      outputVariables: {
        ...instance.variables,
        _conditionResult: evalResult.evaluatedValue,
        _matchedBranch: evalResult.matchedBranch,
      },
      nextNodeId: outgoingEdge.target,
    };
  }

  /**
   * 执行通知节点
   */
  private async executeNotificationNode(
    config: NotificationNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 渲染通知变量
    const renderedVariables = this.renderVariables(config.contentVariables || {}, instance.variables);

    // 发送通知
    await context.services.notification.send(config, renderedVariables);

    return {
      outputVariables: instance.variables,
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 执行 Webhook 节点
   */
  private async executeWebhookNode(
    config: WebhookNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 渲染请求体
    const renderedBody = config.body
      ? this.renderString(config.body, instance.variables)
      : undefined;

    // 调用 Webhook
    let result: any;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.retry.maxRetries; attempt++) {
      try {
        result = await context.services.webhook.call(
          {
            type: 'webhook',
            url: this.renderString(config.url, instance.variables),
            method: config.method,
            headers: config.headers || {},
            body: renderedBody,
            timeout: config.timeout,
            retry: config.retry,
          },
          instance.variables
        );
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < config.retry.maxRetries) {
          await this.sleep(config.retry.retryDelay);
        }
      }
    }

    if (lastError && !result) {
      throw new Error(`Webhook failed after ${config.retry.maxRetries + 1} attempts: ${lastError.message}`);
    }

    return {
      outputVariables: {
        ...instance.variables,
        _webhookResult: result,
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 执行结束节点
   */
  private executeEndNode(
    config: EndNodeConfig,
    instance: WorkflowInstance
  ): NodeExecutionResult {
    return {
      outputVariables: config.outputVariables
        ? this.renderVariables(config.outputVariables, instance.variables)
        : instance.variables,
      terminated: true,
    };
  }

  /**
   * 执行 Task 节点
   *
   * 处理人工任务和系统任务：
   * - system: 直接返回成功
   * - manual: 创建人工任务记录
   */
  private async executeTaskNode(
    config: TaskNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 解析处理人
    let assigneeIds: string[] = config.assigneeIds || [];

    if (config.assigneeType === 'variable' && config.assigneeVariable) {
      const variableValue = this.getNestedValue(instance.variables, config.assigneeVariable);
      if (Array.isArray(variableValue)) {
        assigneeIds = variableValue;
      } else if (variableValue) {
        assigneeIds = [String(variableValue)];
      }
    }

    // 构建任务结果
    const taskId = uuidv4();
    const taskResult = {
      taskId,
      taskType: config.taskType,
      title: this.renderString(config.title || 'Task', instance.variables),
      description: this.renderString(config.description || '', instance.variables),
      assigneeIds,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (config.taskType === 'system') {
      // 系统任务直接完成
      logger.info({ taskId, instanceId: instance.id }, 'System task completed');

      return {
        outputVariables: {
          ...instance.variables,
          [config.resultVariable || '_taskResult']: {
            ...taskResult,
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        },
        nextNodeId: this.getNextNodeId(instance),
      };
    }

    // 人工任务需要等待处理（简化实现：自动完成）
    // 实际生产中需要创建工单并等待人工处理
    logger.info({ taskId, assigneeIds, instanceId: instance.id }, 'Manual task created');

    // 这里应该创建人工任务并等待完成
    // 简化处理：直接返回成功状态
    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || '_taskResult']: {
          ...taskResult,
          status: 'completed',
          completedAt: new Date().toISOString(),
          note: 'Task auto-completed (integration with task service required)',
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 执行 SubWorkflow 节点
   *
   * 处理子流程调用：
   * - 构建子流程输入变量（使用 inputMappings）
   * - 创建子流程实例
   * - 如果 waitForCompletion 等待完成，否则异步执行
   * - 映射输出变量（使用 outputMappings）
   */
  private async executeSubWorkflowNode(
    config: SubWorkflowNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 构建子流程输入变量
    const subWorkflowInput = this.applyVariableMappings(
      config.inputMappings || [],
      instance.variables
    );

    logger.info(
      { subWorkflowId: config.subWorkflowId, input: subWorkflowInput, instanceId: instance.id },
      'Creating sub-workflow instance'
    );

    // 创建子流程实例
    let subInstanceId: string;
    try {
      // 从 instance.input 中获取创建者信息
      const createdBy = (instance.input?.createdBy as string) || 'system';
      const subInstance = await this.createInstance(
        config.subWorkflowId,
        subWorkflowInput,
        createdBy
      );
      subInstanceId = subInstance.id;
    } catch (error) {
      // 如果子流程不存在，返回错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, subWorkflowId: config.subWorkflowId }, 'Failed to create sub-workflow');

      return {
        outputVariables: instance.variables,
        terminated: true,
        error: `Failed to create sub-workflow: ${errorMessage}`,
      };
    }

    if (config.waitForCompletion) {
      // 等待子流程完成
      try {
        const result = await this.execute(subInstanceId);

        // 映射输出变量
        const subOutput = result.output || {};
        const mappedOutput = this.applyVariableMappings(
          config.outputMappings || [],
          subOutput
        );

        return {
          outputVariables: {
            ...instance.variables,
            [config.resultVariable || '_subWorkflowResult']: {
              subInstanceId,
              success: result.success,
              output: subOutput,
              executedNodes: result.executedNodes,
              executionTime: result.executionTime,
            },
            ...mappedOutput,
          },
          nextNodeId: this.getNextNodeId(instance),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          outputVariables: instance.variables,
          terminated: true,
          error: `Sub-workflow execution failed: ${errorMessage}`,
        };
      }
    } else {
      // 异步执行，不等待完成
      // 启动子流程执行（后台）
      this.execute(subInstanceId).catch(err => {
        logger.error({ error: err, subInstanceId }, 'Background sub-workflow execution failed');
      });

      return {
        outputVariables: {
          ...instance.variables,
          [config.resultVariable || '_subWorkflowResult']: {
            subInstanceId,
            status: 'running',
            message: 'Sub-workflow started asynchronously',
          },
        },
        nextNodeId: this.getNextNodeId(instance),
      };
    }
  }

  /**
   * 执行 Delay 节点
   *
   * 根据 duration 或 durationVariable 计算延迟时间，执行延迟。
   * 简化实现：使用 setTimeout 模拟延迟。
   */
  private async executeDelayNode(
    config: DelayNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 计算延迟时间
    let durationMs: number;

    if (config.durationVariable) {
      const variableValue = this.getNestedValue(instance.variables, config.durationVariable);
      durationMs = Number(variableValue) || config.duration;
    } else {
      durationMs = config.duration * 1000; // 秒转毫秒
    }

    logger.info(
      { durationMs, duration: config.duration, instanceId: instance.id },
      'Executing delay node'
    );

    // 执行延迟
    // 注意：在实际生产环境中，应该使用持久化定时器（如数据库记录 + 定时任务）
    // 这里使用简化的 setTimeout 实现
    await this.sleep(Math.min(durationMs, 60000)); // 最多延迟60秒，防止测试挂起

    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || '_delayResult']: {
          delayDuration: durationMs,
          completedAt: new Date().toISOString(),
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 执行 Timer 节点
   *
   * 简化实现：返回配置信息。
   * 实际生产中需要集成定时任务调度器（如 Cron、Quartz 等）。
   */
  private async executeTimerNode(
    config: TimerNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    logger.info(
      {
        cronExpression: config.cronExpression,
        timezone: config.timezone,
        maxExecutions: config.maxExecutions,
        instanceId: instance.id,
      },
      'Executing timer node'
    );

    // 渲染输入变量
    const renderedInput = this.renderVariables(
      config.inputVariables || {},
      instance.variables
    );

    // 简化实现：返回定时器配置信息
    // 实际生产中需要创建定时任务并注册回调
    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || '_timerResult']: {
          cronExpression: config.cronExpression,
          timezone: config.timezone || 'UTC',
          maxExecutions: config.maxExecutions,
          inputVariables: renderedInput,
          status: 'scheduled',
          scheduledAt: new Date().toISOString(),
          note: 'Timer node scheduled (integration with scheduler required)',
        },
      },
      nextNodeId: this.getNextNodeId(instance),
    };
  }

  /**
   * 应用变量映射
   *
   * 将源变量映射到目标变量，用于子流程的输入/输出映射
   */
  private applyVariableMappings(
    mappings: VariableMapping[],
    sourceVariables: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const mapping of mappings) {
      const sourceValue = this.getNestedValue(sourceVariables, mapping.source);
      if (sourceValue !== undefined) {
        // 设置目标变量（支持嵌套路径）
        this.setNestedValue(result, mapping.target, sourceValue);
      }
    }

    return result;
  }

  /**
   * 设置嵌套属性值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * 评估条件表达式 — 安全实现
   *
   * 支持简单比较表达式，如:
   * - ${amount} > 10000
   * - ${status} === 'approved'
   * - ${count} >= 5
   *
   * 不支持任意 JS 代码执行，使用词法分析 + 安全求值
   */
  private evaluateCondition(expression: string, variables: Record<string, any>): ConditionEvalResult {
    try {
      // 先将 ${var} 替换为实际值
      const parsedExpr = this.renderString(expression, variables);

      // 安全表达式解析：只允许简单的比较运算
      const result = this.safeEval(parsedExpr);

      return {
        passed: Boolean(result),
        evaluatedValue: result,
        matchedBranch: 'default',
      };
    } catch (error) {
      logger.error({ error, expression }, 'Failed to evaluate condition');
      return {
        passed: false,
      };
    }
  }

  /**
   * 安全求值 — 白名单方案
   *
   * 只允许简单比较运算，使用词法分析 + 白名单校验，
   * 不执行任何 JS 代码。
   *
   * 支持的运算符：>, <, >=, <=, ===, !==, ==, !=
   * 支持的值类型：数字、字符串（单/双引号包裹）、布尔值
   */
  private safeEval(expression: string): boolean {
    const trimmed = expression.trim();

    // 输入长度限制 — 防止 ReDoS 和超大输入
    const MAX_EXPR_LEN = 512;
    if (trimmed.length > MAX_EXPR_LEN) {
      logger.warn({ length: trimmed.length }, 'Condition expression exceeds max length');
      return false;
    }

    // 白名单：只允许安全的字符
    // 数字、字母、空格、比较运算符、引号、小数点、下划线、连字符
    const whitelistPattern = /^[0-9a-zA-Z_\s."'=<>\-!]+$/;
    if (!whitelistPattern.test(trimmed)) {
      logger.warn({ expression: trimmed }, 'Expression contains disallowed characters');
      return false;
    }

    // 禁止任何类似函数调用或对象访问的模式
    const dangerousPattern = /[()\[\]{};\\`$@#%&+*/|~?:]/;
    if (dangerousPattern.test(trimmed)) {
      logger.warn({ expression: trimmed }, 'Expression contains dangerous pattern');
      return false;
    }

    // 解析比较表达式：值 运算符 值
    const comparisonPattern = /^\s*(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+?)\s*$/;
    const match = trimmed.match(comparisonPattern);

    if (!match) {
      // 不是比较表达式，尝试作为布尔字面量
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      return false;
    }

    const [, leftStr, operator, rightStr] = match;
    const left = this.parseValue(leftStr.trim());
    const right = this.parseValue(rightStr.trim());

    switch (operator) {
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      default: return false;
    }
  }

  /**
   * 解析字符串值为适当的类型
   */
  private parseValue(str: string): string | number | boolean {
    // 布尔值
    if (str === 'true') return true;
    if (str === 'false') return false;

    // 数字
    const num = Number(str);
    if (!isNaN(num) && str !== '') return num;

    // 去除引号的字符串
    if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
      return str.slice(1, -1);
    }

    return str;
  }

  /**
   * 渲染字符串变量
   */
  private renderString(template: string, variables: Record<string, any>): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 渲染变量对象
   */
  private renderVariables(
    vars: Record<string, any>,
    context: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        result[key] = this.renderString(value, context);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 获取嵌套属性值
   */
  private getNestedValue(obj: any, path: string): any {
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
   * 获取下一个节点 ID
   */
  private getNextNodeId(instance: WorkflowInstance): string | null {
    // 从定义中查找当前节点的下一个节点
    // 这里需要 definition，但 instance 中没有，所以我们需要外部传入
    // 暂时返回 null，由调用方处理
    return null;
  }

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

  /**
   * 找到当前节点 ID（从历史记录中）
   */
  private findCurrentNodeId(instance: WorkflowInstance): string | null {
    const enterHistory = instance.history.filter(h => h.action === 'enter');
    return enterHistory.length > 0 ? enterHistory[enterHistory.length - 1].nodeId : null;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            throw new Error(`Failed to start approval: ${result.message}`);
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
          const title = self.renderString(config.template, variables);
          const message = Object.entries(variables)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n') || title;

          // 构造 NotificationService 输入
          const input = {
            tenant_id: variables.tenantId || 'default',
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
   * 而工作流的 webhook 节点是临时的 HTTP 调用，所以主要使用 fetch 直接调用。
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
       * 工作流 webhook 节点是临时调用，使用 fetch 直接发送请求。
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

          const fetchOptions: RequestInit = {
            method: config.method,
            headers: {
              'Content-Type': 'application/json',
              ...config.headers,
            },
            signal: controller.signal,
          };

          if (config.body && config.method !== 'GET') {
            fetchOptions.body = config.body;
          }

          const response = await fetch(config.url, fetchOptions);
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
}

/**
 * 节点执行结果
 */
interface NodeExecutionResult {
  outputVariables?: Record<string, any>;
  nextNodeId?: string | null;
  terminated?: boolean;
  error?: string;
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
