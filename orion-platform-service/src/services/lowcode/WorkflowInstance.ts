/**
 * WorkflowInstance - 工作流实例管理器
 *
 * 负责工作流实例的创建、状态管理、历史记录跟踪
 */
import { v4 as uuidv4 } from 'uuid';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
  WorkflowHistory,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowDefinition,
} from './types';
import { WorkflowInstanceRepository } from './WorkflowRepository';

const logger = require('pino')({ name: 'WorkflowInstance' });

/**
 * 工作流实例管理器
 */
export class WorkflowInstanceManager {
  public repository: WorkflowInstanceRepository;

  constructor(repository?: WorkflowInstanceRepository) {
    this.repository = repository || new WorkflowInstanceRepository();
  }

  /**
   * 创建工作流实例
   */
  async create(
    definition: WorkflowDefinition,
    input: Record<string, any>,
    createdBy: string
  ): Promise<WorkflowInstance> {
    // 找到开始节点
    const startNode = definition.nodes.find(n => n.type === 'start');
    if (!startNode) {
      throw new Error('Workflow definition must have a start node');
    }

    // 获取开始节点的输出变量
    const initialVariables = this.mergeVariables(
      input,
      startNode.config.outputVariables || {}
    );

    // 找到开始节点的下一个节点
    const nextNodeId = this.getNextNodeId(definition, startNode.id);

    const instanceData: Omit<WorkflowInstance, 'id' | 'createdAt' | 'updatedAt'> = {
      workflowId: definition.id,
      workflowDefinitionId: definition.id,
      tenantId: definition.tenantId,
      status: 'pending',
      currentNodeId: nextNodeId || startNode.id,
      variables: initialVariables,
      history: [],
      input,
    };

    const instance = await this.repository.create(instanceData);

    // 添加开始节点进入历史
    await this.addHistory(instance.id, {
      nodeId: startNode.id,
      nodeName: startNode.name,
      nodeType: startNode.type,
      action: 'enter',
      timestamp: new Date(),
      data: { input },
    });

    logger.info({ instanceId: instance.id, workflowId: definition.id }, 'Workflow instance created');
    return instance;
  }

  /**
   * 启动工作流实例
   */
  async start(instanceId: string): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    if (instance.status !== 'pending' && instance.status !== 'suspended') {
      throw new Error(`Cannot start workflow instance with status: ${instance.status}`);
    }

    return await this.repository.update(instanceId, { status: 'running' });
  }

  /**
   * 暂停工作流实例
   */
  async suspend(instanceId: string): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    if (instance.status !== 'running') {
      throw new Error(`Cannot suspend workflow instance with status: ${instance.status}`);
    }

    logger.info({ instanceId }, 'Workflow instance suspended');
    return await this.repository.updateStatus(instanceId, 'suspended');
  }

  /**
   * 恢复工作流实例
   */
  async resume(instanceId: string): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    if (instance.status !== 'suspended') {
      throw new Error(`Cannot resume workflow instance with status: ${instance.status}`);
    }

    logger.info({ instanceId }, 'Workflow instance resumed');
    return await this.repository.update(instanceId, { status: 'running' });
  }

  /**
   * 终止工作流实例
   */
  async terminate(instanceId: string, reason?: string): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    if (instance.status === 'completed' || instance.status === 'failed' || instance.status === 'terminated') {
      throw new Error(`Cannot terminate workflow instance with status: ${instance.status}`);
    }

    const error = reason || 'Workflow terminated by user';
    logger.info({ instanceId, reason: error }, 'Workflow instance terminated');
    return await this.repository.updateStatus(instanceId, 'terminated', error);
  }

  /**
   * 完成工作流实例
   */
  async complete(instanceId: string, output?: Record<string, any>): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    logger.info({ instanceId, output }, 'Workflow instance completed');
    return await this.repository.update(instanceId, {
      status: 'completed',
      output,
      completedAt: new Date(),
    });
  }

  /**
   * 失败工作流实例
   */
  async fail(instanceId: string, error: string): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    logger.error({ instanceId, error }, 'Workflow instance failed');
    return await this.repository.updateStatus(instanceId, 'failed', error);
  }

  /**
   * 更新当前节点
   */
  async moveToNode(instanceId: string, nodeId: string, variables?: Record<string, any>): Promise<WorkflowInstance> {
    const updates: Partial<WorkflowInstance> = {
      currentNodeId: nodeId,
    };

    if (variables) {
      const instance = await this.repository.findById(instanceId);
      if (instance) {
        updates.variables = { ...instance.variables, ...variables };
      }
    }

    return await this.repository.update(instanceId, updates);
  }

  /**
   * 更新实例变量
   */
  async updateVariables(instanceId: string, variables: Record<string, any>): Promise<WorkflowInstance> {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    const mergedVariables = { ...instance.variables, ...variables };
    return await this.repository.update(instanceId, { variables: mergedVariables });
  }

  /**
   * 添加历史记录
   */
  async addHistory(
    instanceId: string,
    entry: Omit<WorkflowHistory, 'timestamp'>
  ): Promise<void> {
    await this.repository.addHistory(instanceId, {
      ...entry,
      timestamp: new Date(),
    });
  }

  /**
   * 获取实例状态
   */
  async getState(instanceId: string) {
    const instance = await this.repository.findById(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    return {
      instanceId: instance.id,
      status: instance.status,
      currentNodeId: instance.currentNodeId,
      variables: instance.variables,
      history: instance.history,
    };
  }

  /**
   * 获取实例
   */
  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    return await this.repository.findById(instanceId);
  }

  /**
   * 获取工作流的所有实例
   */
  async getInstancesByWorkflow(
    workflowId: string,
    options?: { status?: WorkflowInstanceStatus; limit?: number; offset?: number }
  ): Promise<WorkflowInstance[]> {
    return await this.repository.findByWorkflowId(workflowId, options);
  }

  /**
   * 合并变量
   */
  private mergeVariables(
    input: Record<string, any>,
    outputVariables?: Record<string, any>
  ): Record<string, any> {
    const result = { ...input };

    if (outputVariables) {
      // 支持变量引用替换，如 ${input.name} -> input.name 的值
      for (const [key, value] of Object.entries(outputVariables)) {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          const refPath = value.slice(2, -1);
          const refValue = this.getNestedValue(input, refPath);
          result[key] = refValue !== undefined ? refValue : value;
        } else {
          result[key] = value;
        }
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
   * 获取节点的下一个节点 ID
   */
  private getNextNodeId(definition: WorkflowDefinition, nodeId: string): string | null {
    const edge = definition.edges.find(e => e.source === nodeId);
    return edge ? edge.target : null;
  }

  /**
   * 清理过期的工作流实例
   * 从内存中移除已完成/失败/已取消超过指定天数的实例
   */
  cleanupExpiredInstances(retentionDate: Date): { deletedCount: number } {
    let deletedCount = 0;

    // 清理实例管理器中的过期实例
    // 注意：实例存储在 repository 中，这里清理内存缓存
    this.repository.cleanupExpiredInstances(retentionDate);

    return { deletedCount };
  }
}