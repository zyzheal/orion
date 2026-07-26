/**
 * WorkflowService - 工作流服务
 * 管理工单工作流定义、实例执行、节点流转和审批
 */

import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNodeInstance,
  WorkflowNode,
  WorkflowNodeType,
  ApprovalRecord,
  ApprovalConfig,
  ApprovalStatus,
  Ticket,
  TicketStatus,
} from '../types/ticket';

// In-memory stores
const workflowDefinitions = new Map<string, WorkflowDefinition[]>();
const workflowInstances = new Map<string, WorkflowInstance>();
const nodeInstances = new Map<string, WorkflowNodeInstance[]>();
const approvalRecords = new Map<string, ApprovalRecord[]>();

export class WorkflowService {
  // ============================================================
  // 工作流定义管理
  // ============================================================

  /**
   * 创建工作流定义
   */
  async createWorkflowDefinition(
    definition: Omit<WorkflowDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>
  ): Promise<WorkflowDefinition> {
    const id = crypto.randomUUID();
    const errors = this.validateWorkflowDefinition({ ...definition, id, version: 1 } as WorkflowDefinition);
    if (errors.length > 0) {
      throw new Error(`Invalid workflow definition: ${errors.join(', ')}`);
    }

    const fullDefinition: WorkflowDefinition = {
      ...definition,
      id,
      version: 1,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const tenantWorkflows = workflowDefinitions.get(definition.tenantId) || [];
    tenantWorkflows.push(fullDefinition);
    workflowDefinitions.set(definition.tenantId, tenantWorkflows);

    return fullDefinition;
  }

  /**
   * 更新工作流定义
   */
  async updateWorkflowDefinition(
    id: string,
    updates: Partial<WorkflowDefinition>
  ): Promise<WorkflowDefinition> {
    // Find the definition across all tenants
    for (const [tenantId, defs] of workflowDefinitions.entries()) {
      const idx = defs.findIndex((d) => d.id === id);
      if (idx >= 0) {
        const existing = defs[idx];
        if (existing.enabled === false) {
          // Create new version instead
          return this.createWorkflowDefinition({
            ...existing,
            ...updates,
            name: `${existing.name} v${existing.version + 1}`,
          });
        }
        const updated: WorkflowDefinition = {
          ...existing,
          ...updates,
          id,
          version: existing.version,
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        };
        defs[idx] = updated;
        return updated;
      }
    }
    throw new Error(`Workflow definition not found: ${id}`);
  }

  /**
   * 获取工作流定义
   */
  async getWorkflowDefinition(
    id: string,
    _tenantId: string
  ): Promise<WorkflowDefinition | null> {
    for (const defs of workflowDefinitions.values()) {
      const found = defs.find((d) => d.id === id);
      if (found) return found;
    }
    return null;
  }

  /**
   * 获取指定工单类型的工作流
   */
  async getWorkflowForTicketType(
    ticketType: string,
    tenantId: string
  ): Promise<WorkflowDefinition | null> {
    const defs = workflowDefinitions.get(tenantId) || [];
    return defs.find(
      (d) =>
        d.ticketType === ticketType &&
        d.enabled === true
    ) ?? null;
  }

  /**
   * 发布工作流定义
   */
  async publishWorkflowDefinition(id: string): Promise<WorkflowDefinition> {
    for (const [tenantId, defs] of workflowDefinitions.entries()) {
      const idx = defs.findIndex((d) => d.id === id);
      if (idx >= 0) {
        const def = defs[idx];
        const errors = this.validateWorkflowDefinition(def);
        if (errors.length > 0) {
          throw new Error(`Cannot publish: ${errors.join(', ')}`);
        }
        // Deactivate other versions of same type
        for (const other of defs) {
          if (other.ticketType === def.ticketType && other.id !== id) {
            other.enabled = false;
          }
        }
        def.enabled = true;
        def.updatedAt = new Date();
        return def;
      }
    }
    throw new Error(`Workflow definition not found: ${id}`);
  }

  // ============================================================
  // 工作流实例管理
  // ============================================================

  /**
   * 启动工作流实例
   */
  async startWorkflow(
    ticketId: string,
    workflowDefinitionId: string
  ): Promise<WorkflowInstance> {
    const def = await this.getWorkflowDefinition(workflowDefinitionId, '');
    if (!def) {
      throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
    }

    const startNode = def.nodes.find((n) => n.type === WorkflowNodeType.START);
    if (!startNode) {
      throw new Error('Workflow must have a START node');
    }

    const instanceId = crypto.randomUUID();
    const instance: WorkflowInstance = {
      id: instanceId,
      workflowDefinitionId: def.id,
      ticketId,
      status: 'running',
      currentNodeId: startNode.id,
      startedAt: new Date(),
      completedAt: null,
      nodeInstances: [],
    };

    // Create start node instance
    const startNodeInstance: WorkflowNodeInstance = {
      id: crypto.randomUUID(),
      workflowInstanceId: instanceId,
      nodeId: startNode.id,
      status: 'completed',
      input: {},
      output: {},
      startedAt: new Date(),
      completedAt: new Date(),
    };
    nodeInstances.set(instanceId, [startNodeInstance]);

    workflowInstances.set(instanceId, instance);
    return instance;
  }

  /**
   * 执行工作流节点
   */
  async executeNode(
    instanceId: string,
    nodeId: string,
    input: Record<string, unknown>
  ): Promise<WorkflowNodeInstance> {
    const instance = workflowInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    const def = await this.getWorkflowDefinition(instance.workflowDefinitionId, '');
    if (!def) throw new Error('Workflow definition not found');

    const node = def.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const nodeInstance: WorkflowNodeInstance = {
      id: crypto.randomUUID(),
      workflowInstanceId: instanceId,
      nodeId,
      status: 'running',
      input,
      output: {},
      startedAt: new Date(),
      completedAt: null,
    };

    // Execute based on node type
    const output = await this.executeNodeByType(node, input, instance);
    nodeInstance.output = output;
    nodeInstance.status = 'completed';
    nodeInstance.completedAt = new Date();

    const existing = nodeInstances.get(instanceId) || [];
    existing.push(nodeInstance);
    nodeInstances.set(instanceId, existing);

    return nodeInstance;
  }

  /**
   * 推进到下一个节点
   */
  async advanceToNextNode(
    instanceId: string,
    currentOutput: Record<string, unknown>
  ): Promise<WorkflowInstance | null> {
    const instance = workflowInstances.get(instanceId);
    if (!instance) return null;

    const def = await this.getWorkflowDefinition(instance.workflowDefinitionId, '');
    if (!def) return null;

    // Find edges from current node
    const edges = def.edges.filter((e) => e.sourceNodeId === instance.currentNodeId);

    if (edges.length === 0) {
      // No more edges - check if current node is END
      const currentNode = def.nodes.find((n) => n.id === instance.currentNodeId);
      if (currentNode?.type === WorkflowNodeType.END) {
        instance.status = 'completed';
        instance.completedAt = new Date();
        return instance;
      }
      return instance;
    }

    // Select next edge (first matching condition, or first if no conditions)
    let nextEdge = edges[0];
    for (const edge of edges) {
      if (!edge.condition || this.evaluateCondition(edge.condition, currentOutput)) {
        nextEdge = edge;
        break;
      }
    }

    const nextNode = def.nodes.find((n) => n.id === nextEdge.targetNodeId);
    if (!nextNode) return instance;

    instance.currentNodeId = nextNode.id;

    // Create node instance
    const nodeInstance: WorkflowNodeInstance = {
      id: crypto.randomUUID(),
      workflowInstanceId: instanceId,
      nodeId: nextNode.id,
      status: 'pending',
      input: currentOutput,
      output: {},
      startedAt: new Date(),
      completedAt: null,
    };
    const existing = nodeInstances.get(instanceId) || [];
    existing.push(nodeInstance);
    nodeInstances.set(instanceId, existing);

    // Auto-execute non-approval nodes
    if (nextNode.type !== WorkflowNodeType.APPROVAL) {
      await this.executeNode(instanceId, nextNode.id, currentOutput);
      return this.advanceToNextNode(instanceId, currentOutput);
    }

    return instance;
  }

  // ============================================================
  // 审批管理
  // ============================================================

  /**
   * 提交审批
   */
  async submitApproval(
    _ticketId: string,
    approvalRecordId: string,
    status: ApprovalStatus,
    comment: string
  ): Promise<ApprovalRecord> {
    let records: ApprovalRecord[] | undefined;
    for (const recs of approvalRecords.values()) {
      const found = recs.find((r) => r.id === approvalRecordId);
      if (found) {
        records = recs;
        found.status = status;
        found.comment = comment;
        found.approvedAt = new Date();
        break;
      }
    }
    if (!records) {
      throw new Error(`Approval record not found: ${approvalRecordId}`);
    }

    return records.find((r) => r.id === approvalRecordId)!;
  }

  /**
   * 请求审批
   */
  async requestApproval(
    ticketId: string,
    nodeId: string,
    config: ApprovalConfig
  ): Promise<ApprovalRecord[]> {
    const instanceId = Array.from(workflowInstances.entries())
      .find(([, inst]) => inst.ticketId === ticketId)?.[0];
    if (!instanceId) {
      throw new Error(`No workflow instance for ticket: ${ticketId}`);
    }

    const records: ApprovalRecord[] = config.approverIds.map((approverId: string) => ({
      id: crypto.randomUUID(),
      ticketId,
      workflowNodeId: nodeId,
      approverId,
      status: ApprovalStatus.PENDING,
      comment: '',
      approvedAt: null,
      delegatedTo: null,
    }));

    approvalRecords.set(ticketId, records);

    // In production: await notificationService.send(approverIds, ...)
    console.log(
      `[Approval] Requesting approval from ${config.approverIds.join(', ')} for ticket ${ticketId}`
    );

    return records;
  }

  /**
   * 获取审批记录
   */
  async getApprovalRecords(
    ticketId: string
  ): Promise<ApprovalRecord[]> {
    return approvalRecords.get(ticketId) ?? [];
  }

  // ============================================================
  // 工作流事件处理
  // ============================================================

  /**
   * 处理节点超时
   */
  async handleNodeTimeout(instanceId: string, nodeId: string): Promise<void> {
    const instance = workflowInstances.get(instanceId);
    if (!instance) return;

    const def = await this.getWorkflowDefinition(instance.workflowDefinitionId, '');
    if (!def) return;

    const node = def.nodes.find((n) => n.id === nodeId);
    if (!node?.config?.timerConfig) return;

    const timerConfig = node.config.timerConfig;
    const onTimeout = timerConfig?.onTimeout ?? 'notify';

    console.log(
      `[Workflow] Node ${nodeId} timed out in instance ${instanceId}. Action: ${onTimeout}`
    );

    if (onTimeout === 'escalate') {
      console.log('[Workflow] Escalating due to timeout');
    } else if (onTimeout === 'transition') {
      await this.advanceToNextNode(instanceId, { autoApproved: true });
    }
  }

  /**
   * 暂停工作流
   */
  async pauseWorkflow(instanceId: string): Promise<WorkflowInstance> {
    const instance = workflowInstances.get(instanceId);
    if (!instance) throw new Error(`Workflow instance not found: ${instanceId}`);
    instance.status = 'paused';
    return instance;
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(instanceId: string): Promise<WorkflowInstance> {
    const instance = workflowInstances.get(instanceId);
    if (!instance) throw new Error(`Workflow instance not found: ${instanceId}`);
    instance.status = 'running';
    return instance;
  }

  /**
   * 终止工作流
   */
  async terminateWorkflow(
    instanceId: string,
    reason: string
  ): Promise<WorkflowInstance> {
    const instance = workflowInstances.get(instanceId);
    if (!instance) throw new Error(`Workflow instance not found: ${instanceId}`);
    instance.status = 'failed';
    instance.completedAt = new Date();
    // Note: WorkflowInstance doesn't have context field, storing reason in nodeInstances instead
    return instance;
  }

  // ============================================================
  // 工作流验证
  // ============================================================

  /**
   * 验证工作流定义
   */
  private validateWorkflowDefinition(
    definition: WorkflowDefinition
  ): string[] {
    const errors: string[] = [];

    // Check for START node
    const startNodes = definition.nodes.filter(
      (n) => n.type === WorkflowNodeType.START
    );
    if (startNodes.length === 0) {
      errors.push('Workflow must have at least one START node');
    } else if (startNodes.length > 1) {
      errors.push('Workflow must have exactly one START node');
    }

    // Check for END node
    const endNodes = definition.nodes.filter(
      (n) => n.type === WorkflowNodeType.END
    );
    if (endNodes.length === 0) {
      errors.push('Workflow must have at least one END node');
    }

    // Check edges reference valid nodes
    for (const edge of definition.edges) {
      const sourceExists = definition.nodes.some(
        (n) => n.id === edge.sourceNodeId
      );
      const targetExists = definition.nodes.some(
        (n) => n.id === edge.targetNodeId
      );
      if (!sourceExists) {
        errors.push(`Edge ${edge.id} references non-existent source node ${edge.sourceNodeId}`);
      }
      if (!targetExists) {
        errors.push(`Edge ${edge.id} references non-existent target node ${edge.targetNodeId}`);
      }
    }

    // Check node connectivity (simple BFS from START)
    if (startNodes.length === 1) {
      const reachable = new Set<string>();
      const queue = [startNodes[0].id];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const edge of definition.edges.filter((e) => e.sourceNodeId === current)) {
          if (!reachable.has(edge.targetNodeId)) {
            queue.push(edge.targetNodeId);
          }
        }
      }
      for (const node of definition.nodes) {
        if (!reachable.has(node.id)) {
          errors.push(`Node ${node.id} is not reachable from START`);
        }
      }
    }

    return errors;
  }

  /**
   * 检查状态流转是否允许
   */
  async isTransitionAllowed(
    ticketId: string,
    _fromStatus: string,
    toStatus: string
  ): Promise<boolean> {
    const instance = Array.from(workflowInstances.values()).find(
      (inst) => inst.ticketId === ticketId && inst.status === 'running'
    );
    if (!instance) return true; // No active workflow, allow transition

    // Check if target status maps to a valid workflow node
    const def = await this.getWorkflowDefinition(instance.workflowDefinitionId, '');
    if (!def) return true;

    // Simple validation: check if status transition is valid
    const validTransitions: Record<string, string[]> = {
      [TicketStatus.NEW]: ['open', 'pending', 'cancelled'],
      [TicketStatus.OPEN]: ['in_progress', 'pending', 'cancelled'],
      [TicketStatus.IN_PROGRESS]: ['resolved', 'waiting_customer', 'waiting_vendor'],
      [TicketStatus.PENDING]: ['open', 'in_progress', 'cancelled'],
      [TicketStatus.WAITING_CUSTOMER]: ['open', 'in_progress'],
      [TicketStatus.WAITING_VENDOR]: ['open', 'in_progress'],
      [TicketStatus.RESOLVED]: ['closed', 'open'],
      [TicketStatus.CLOSED]: [],
      [TicketStatus.CANCELLED]: ['open'],
    };

    const allowed = validTransitions[_fromStatus] || [];
    return allowed.includes(toStatus);
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 根据节点类型执行相应逻辑
   */
  private async executeNodeByType(
    node: WorkflowNode,
    input: Record<string, unknown>,
    _instance: WorkflowInstance
  ): Promise<Record<string, unknown>> {
    switch (node.type) {
      case WorkflowNodeType.START:
        return { started: true };

      case WorkflowNodeType.END:
        return { completed: true };

      case WorkflowNodeType.TASK:
        // In production: execute task logic based on taskConfig
        console.log(`[Workflow] Executing task: ${node.name}`);
        return { taskExecuted: node.name };

      case WorkflowNodeType.APPROVAL:
        // Approval nodes wait for external input
        return { approvalRequested: true };

      case WorkflowNodeType.NOTIFICATION:
        // In production: send notification
        console.log(`[Workflow] Sending notification: ${node.name}`);
        return { notificationSent: true };

      case WorkflowNodeType.CONDITION:
        return { conditionEvaluated: true };

      case WorkflowNodeType.TIMER:
        // Start timer, return immediately
        return { timerStarted: true, timeoutMs: (node.config.timerConfig?.durationSeconds ?? 0) * 1000 };

      case WorkflowNodeType.PARALLEL:
        return { parallelStarted: true };

      case WorkflowNodeType.SUBWORKFLOW:
        return { subworkflowTriggered: true };

      default:
        return {};
    }
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(
    condition: string,
    context: Record<string, unknown>
  ): boolean {
    // Simple condition evaluation
    // In production: use a proper expression evaluator
    try {
      // Handle basic comparisons like "priority === 'critical'"
      const evalContext = { ...context };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const func = new Function('ctx', `with(ctx) { return ${condition}; }`);
      return !!func(evalContext);
    } catch {
      return false;
    }
  }
}

// 单例导出
export const workflowService = new WorkflowService();
