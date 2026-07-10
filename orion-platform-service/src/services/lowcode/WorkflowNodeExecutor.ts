/**
 * WorkflowNodeExecutor - 工作流节点执行器
 *
 * 职责：执行所有类型的节点（start, approval, condition, notification, webhook, end, task, sub-workflow, delay, timer）
 *
 * 设计：
 * - 无外部状态依赖，所有需要的数据通过 constructor 注入
 * - 通过 WorkflowExpressionEvaluator 处理变量渲染和条件求值
 * - 通过 WorkflowServices 接口调用审批/通知/Webhook 服务
 * - 通过回调函数访问引擎级方法（createInstance, execute）
 */

import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { OrionError } from '../../errors';
import type {
  WorkflowNode,
  WorkflowInstance,
  WorkflowDefinition,
  WorkflowExecutionContext,
  WorkflowServices,
  NodeExecutionResult,
  StartNodeConfig,
  ApprovalNodeConfig,
  ConditionNodeConfig,
  NotificationNodeConfig,
  WebhookNodeConfig,
  EndNodeConfig,
  TaskNodeConfig,
  SubWorkflowNodeConfig,
  DelayNodeConfig,
  TimerNodeConfig,
  VariableMapping,
} from './types';
import { WorkflowTimerRepository } from '../../repositories/WorkflowTimerRepository';
import { WorkflowTaskRepository } from '../../repositories/WorkflowTaskRepository';
import { WorkflowExpressionEvaluator } from './WorkflowExpressionEvaluator';

const logger = createLogger('workflow-node-executor');

export interface WorkflowNodeExecutorDependencies {
  services: WorkflowServices;
  timerRepository: WorkflowTimerRepository;
  taskRepository: WorkflowTaskRepository;
  instanceManager: any; // WorkflowInstanceManager - 避免循环导入
  expressionEvaluator: WorkflowExpressionEvaluator;
  /** 创建子流程实例的回调（由 WorkflowEngine 提供） */
  createInstance: (workflowId: string, input: Record<string, any>, createdBy: string) => Promise<WorkflowInstance>;
  /** 执行工作流实例的回调（由 WorkflowEngine 提供，用于 waitForCompletion 场景） */
  execute: (instanceId: string) => Promise<{
    success: boolean;
    instanceId: string;
    output?: Record<string, any>;
    error?: string;
    executedNodes: string[];
    executionTime: number;
    trace?: any[];
  }>;
}

/**
 * 工作流节点执行器
 */
export class WorkflowNodeExecutor {
  private services: WorkflowServices;
  private timerRepository: WorkflowTimerRepository;
  private taskRepository: WorkflowTaskRepository;
  private instanceManager: any;
  private expressionEvaluator: WorkflowExpressionEvaluator;
  private createInstance: (workflowId: string, input: Record<string, any>, createdBy: string) => Promise<WorkflowInstance>;
  private execute: (instanceId: string) => Promise<{
    success: boolean;
    instanceId: string;
    output?: Record<string, any>;
    error?: string;
    executedNodes: string[];
    executionTime: number;
    trace?: any[];
  }>;

  constructor(dependencies: WorkflowNodeExecutorDependencies) {
    this.services = dependencies.services;
    this.timerRepository = dependencies.timerRepository;
    this.taskRepository = dependencies.taskRepository;
    this.instanceManager = dependencies.instanceManager;
    this.expressionEvaluator = dependencies.expressionEvaluator;
    this.createInstance = dependencies.createInstance;
    this.execute = dependencies.execute;
  }

  // ==================== 节点执行入口 ====================

  /**
   * 执行单个节点
   */
  async executeNode(
    node: WorkflowNode,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const nodeStartTime = Date.now();

    try {
      switch (node.type) {
        case 'start':
          return this.executeStartNode(node.config as StartNodeConfig, instance, context.definition);

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
          throw new OrionError(`Unknown node type: ${node.type}`, 'NOT_FOUND');
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

  // ==================== 节点执行方法 ====================

  /**
   * 执行开始节点
   */
  private executeStartNode(
    config: StartNodeConfig,
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): NodeExecutionResult {
    return {
      outputVariables: config.outputVariables,
      nextNodeId: this.getNextNodeId(instance, definition),
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
          nextNodeId: this.getNextNodeId(instance, context.definition),
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
      nextNodeId: this.getNextNodeId(instance, context.definition),
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
    const evalResult = this.expressionEvaluator.evaluateCondition(config.expression, instance.variables);

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
    const renderedVariables = this.expressionEvaluator.renderVariables(
      config.contentVariables || {},
      instance.variables
    );

    // 发送通知
    await context.services.notification.send(config, renderedVariables);

    return {
      outputVariables: instance.variables,
      nextNodeId: this.getNextNodeId(instance, context.definition),
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
      ? this.expressionEvaluator.renderString(config.body, instance.variables)
      : undefined;

    // 调用 Webhook
    let result: any;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.retry.maxRetries; attempt++) {
      try {
        result = await context.services.webhook.call(
          {
            type: 'webhook',
            url: this.expressionEvaluator.renderString(config.url, instance.variables),
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
      throw new OrionError(`Webhook failed after ${config.retry.maxRetries + 1} attempts: ${lastError.message}`, 'OPERATION_FAILED');
    }

    return {
      outputVariables: {
        ...instance.variables,
        _webhookResult: result,
      },
      nextNodeId: this.getNextNodeId(instance, context.definition),
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
        ? this.expressionEvaluator.renderVariables(config.outputVariables, instance.variables)
        : instance.variables,
      terminated: true,
    };
  }

  /**
   * 执行 Task 节点
   *
   * 处理人工任务和系统任务：
   * - system: 直接返回成功
   * - manual: 创建人工任务记录，挂起实例等待事件唤醒
   */
  private async executeTaskNode(
    config: TaskNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 解析处理人
    let assigneeIds: string[] = config.assigneeIds || [];

    if (config.assigneeType === 'variable' && config.assigneeVariable) {
      const variableValue = this.expressionEvaluator.getNestedValue(instance.variables, config.assigneeVariable);
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
      title: this.expressionEvaluator.renderString(config.title || 'Task', instance.variables),
      description: this.expressionEvaluator.renderString(config.description || '', instance.variables),
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
        nextNodeId: this.getNextNodeId(instance, context.definition),
      };
    }

    // 人工任务：创建任务记录并挂起实例
    const nodeId = this.findCurrentNodeId(instance) || 'unknown';

    // 持久化任务记录到数据库
    const task = await this.taskRepository.create({
      instance_id: instance.id,
      node_id: nodeId,
      task_type: 'manual',
      assignee_type: config.assigneeType === 'role' ? 'role' : 'user',
      assignee_id: assigneeIds[0],
      candidate_users: assigneeIds,
      candidate_roles: config.assigneeType === 'role' ? config.assigneeIds : undefined,
      title: this.expressionEvaluator.renderString(config.title || 'Task', instance.variables),
      description: this.expressionEvaluator.renderString(config.description || '', instance.variables),
      status: 'pending',
      priority: (config as any).priority || 'normal',
      due_date: config.timeout ? new Date(Date.now() + config.timeout * 1000) : undefined,
      form_data: {
        taskId,
        workflowInstanceId: instance.id,
        nodeId,
      },
    });

    logger.info({ taskId: task.id, assigneeIds, instanceId: instance.id }, 'Manual task created and persisted to DB, suspending instance');

    // 挂起实例，等待人工任务完成事件唤醒
    await this.instanceManager.suspend(instance.id);

    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || '_taskResult']: {
          taskId: task.id,
          taskType: 'manual',
          title: task.title,
          assigneeIds,
          status: 'pending',
          createdAt: task.created_at.toISOString(),
          instanceId: instance.id,
          nodeId,
          dueDate: task.due_date?.toISOString(),
          priority: task.priority,
        },
        // 存储唤醒事件类型，供外部系统参考
        _pendingWakeUpEvent: `workflow.task.completed.${task.id}`,
      },
      terminated: true, // 暂停执行，等待事件唤醒
    };
  }

  /**
   * 执行 SubWorkflow 节点
   *
   * 处理子流程调用：
   * - 构建子流程输入变量（使用 inputMappings）
   * - 检测循环依赖（在创建子实例之前，防止 A -> B -> A 的无限递归）
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
    const subWorkflowInput = this.expressionEvaluator.applyVariableMappings(
      config.inputMappings || [],
      instance.variables
    );

    // ==================== 循环依赖检测（在创建子实例之前）====================
    // 检查当前实例的祖先链中是否已经有相同工作流定义的实例
    const ancestorIds = await this.timerRepository.getParentChain(instance.id);
    const allInstanceIds = [instance.id, ...ancestorIds];

    // 查询祖先实例的工作流定义 ID
    const ancestorDefinitions = await this.getWorkflowDefinitionsForInstances(allInstanceIds);
    const isCircular = ancestorDefinitions.some(defId => defId === config.subWorkflowId);

    if (isCircular) {
      logger.error(
        { subWorkflowId: config.subWorkflowId, parentInstanceId: instance.id, ancestorIds },
        'Circular dependency detected: ancestor already uses same workflow definition'
      );
      return {
        outputVariables: instance.variables,
        terminated: true,
        error: `Circular dependency detected: ancestor instance already calls sub-workflow '${config.subWorkflowId}'`,
      };
    }

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

      // 记录父子实例依赖关系，用于后续检测
      await this.timerRepository.addDependency({
        parent_instance_id: instance.id,
        child_instance_id: subInstanceId,
        node_id: this.findCurrentNodeId(instance) || 'unknown',
      } as any);
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
        const mappedOutput = this.expressionEvaluator.applyVariableMappings(
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
          nextNodeId: this.getNextNodeId(instance, context.definition),
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
        nextNodeId: this.getNextNodeId(instance, context.definition),
      };
    }
  }

  /**
   * 执行 Delay 节点
   *
   * 根据 duration 或 durationVariable 计算延迟时间，执行延迟。
   * 生产环境使用数据库持久化定时器，服务重启后可恢复。
   */
  private async executeDelayNode(
    config: DelayNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 计算延迟时间
    let durationMs: number;

    if (config.durationVariable) {
      const variableValue = this.expressionEvaluator.getNestedValue(instance.variables, config.durationVariable);
      durationMs = Number(variableValue) || config.duration;
    } else {
      durationMs = config.duration * 1000; // 秒转毫秒
    }

    const scheduledAt = new Date(Date.now() + durationMs);

    // 持久化定时器到数据库
    const timer = await this.timerRepository.create({
      instance_id: instance.id,
      node_id: this.findCurrentNodeId(instance) || 'unknown',
      timer_type: 'delay',
      duration_ms: durationMs,
      scheduled_at: scheduledAt,
      resume_event: (config as any).resumeEvent,
      status: 'pending',
    });

    logger.info(
      { timerId: timer.id, durationMs, scheduledAt, instanceId: instance.id },
      'Delay node persisted to database'
    );

    // 如果延迟时间很短（<= 60s），直接等待
    // 否则挂起工作流实例，等待定时器触发
    if (durationMs <= 60000) {
      await this.sleep(durationMs);

      await this.timerRepository.updateStatus(timer.id, 'completed', {
        delayDuration: durationMs,
        completedAt: new Date().toISOString(),
      });

      return {
        outputVariables: {
          ...instance.variables,
          [config.resultVariable || '_delayResult']: {
            delayDuration: durationMs,
            completedAt: new Date().toISOString(),
          },
        },
        nextNodeId: this.getNextNodeId(instance, context.definition),
      };
    }

    // 长时间延迟：挂起实例，等待定时器调度器恢复
    await this.instanceManager.suspend(instance.id);

    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || '_delayResult']: {
          timerId: timer.id,
          scheduledAt: scheduledAt.toISOString(),
          status: 'suspended',
        },
      },
      terminated: true, // 暂停执行，等待定时器调度器恢复
    };
  }

  /**
   * 执行 Timer 节点
   *
   * 持久化定时器配置到数据库，由定时调度器负责触发。
   */
  private async executeTimerNode(
    config: TimerNodeConfig,
    instance: WorkflowInstance,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    // 检查是否是最后一次执行（由调度器设置）
    const isLastExecution = instance.variables?._timerResult?.isLastExecution === true;

    if (isLastExecution) {
      logger.info({ instanceId: instance.id }, 'Timer node: last execution reached, continuing without creating new timer');
      return {
        outputVariables: {
          ...instance.variables,
          [config.resultVariable || '_timerResult']: {
            status: 'completed',
            note: 'Max executions reached, workflow continues',
          },
        },
        nextNodeId: this.getNextNodeId(instance, context.definition),
      };
    }

    // 渲染输入变量
    const renderedInput = this.expressionEvaluator.renderVariables(
      config.inputVariables || {},
      instance.variables
    );

    // 持久化定时器到数据库
    const timer = await this.timerRepository.create({
      instance_id: instance.id,
      node_id: this.findCurrentNodeId(instance) || 'unknown',
      timer_type: 'timer',
      cron_expression: config.cronExpression,
      timezone: config.timezone || 'UTC',
      max_executions: config.maxExecutions,
      scheduled_at: new Date(), // 立即开始调度
      status: 'pending',
      output_variables: renderedInput,
    });

    logger.info(
      {
        timerId: timer.id,
        cronExpression: config.cronExpression,
        timezone: config.timezone,
        maxExecutions: config.maxExecutions,
        instanceId: instance.id,
      },
      'Timer node persisted to database'
    );

    // 挂起实例，等待定时调度器触发
    await this.instanceManager.suspend(instance.id);

    return {
      outputVariables: {
        ...instance.variables,
        [config.resultVariable || '_timerResult']: {
          timerId: timer.id,
          cronExpression: config.cronExpression,
          timezone: config.timezone || 'UTC',
          maxExecutions: config.maxExecutions,
          inputVariables: renderedInput,
          status: 'scheduled',
          scheduledAt: new Date().toISOString(),
        },
      },
      terminated: true, // 暂停执行，等待定时调度器
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取下一个节点 ID
   * 从工作流定义的边（edges）中查找当前节点的后继节点
   */
  private getNextNodeId(instance: WorkflowInstance, definition: WorkflowDefinition): string | null {
    const edge = definition.edges.find(e => e.source === instance.currentNodeId);
    return edge ? edge.target : null;
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

  /**
   * 获取实例的工作流定义 ID 列表
   * 用于循环依赖检测：检查祖先实例是否使用了相同的工作流定义
   */
  private async getWorkflowDefinitionsForInstances(instanceIds: string[]): Promise<string[]> {
    const definitionIds: string[] = [];
    for (const id of instanceIds) {
      try {
        const instance = await this.instanceManager.getInstance(id);
        if (instance?.workflowDefinitionId) {
          definitionIds.push(instance.workflowDefinitionId);
        }
      } catch {
        // 忽略获取失败的实例
      }
    }
    return definitionIds;
  }
}
