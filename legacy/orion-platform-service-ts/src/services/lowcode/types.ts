/**
 * LowCode 工作流类型定义
 *
 * 基于设计文档：docs/superpowers/specs/2026-05-19-lowcode-platform-detailed-design.md
 * A.3.2 工作流引擎核心接口
 */

import { ApprovalFlowConfig } from '../approval/ApprovalFlowEngine';

// ==================== 工作流定义 ====================

/** 工作流定义 */
export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  version: number;
  enabled: boolean;

  // 流程定义
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // 元数据
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 工作流节点类型 */
export type WorkflowNodeType = 'start' | 'approval' | 'condition' | 'notification' | 'webhook' | 'end' | 'task' | 'sub-workflow' | 'delay' | 'timer';

/** 工作流节点 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: { x: number; y: number };
  config: StartNodeConfig | ApprovalNodeConfig | ConditionNodeConfig | NotificationNodeConfig | WebhookNodeConfig | EndNodeConfig | TaskNodeConfig | SubWorkflowNodeConfig | DelayNodeConfig | TimerNodeConfig;
}

/** 开始节点配置 */
export interface StartNodeConfig {
  type: 'start';
  outputVariables?: Record<string, any>;
}

/** 审批节点配置 - 集成 ApprovalFlowEngine */
export interface ApprovalNodeConfig {
  type: 'approval';
  // 关联的审批流程配置
  approvalFlowConfig?: ApprovalFlowConfig;
  // 审批节点本地配置
  approverType: 'user' | 'role' | 'dynamic';
  approverIds?: string[];
  approvalType: 'or' | 'and';  // 或签/会签
  timeout: number;  // 小时
  timeoutAction: 'approve' | 'reject' | 'escalate';
  rejectAction: 'to_initiator' | 'to_previous';
  // 审批结果变量名
  resultVariable?: string;
}

/** 条件分支节点配置 */
export interface ConditionNodeConfig {
  type: 'condition';
  expression: string;  // 条件表达式，如: "${amount} > 10000"
  branches: Array<{
    name: string;
    condition: string;
  }>;
}

/** 通知节点配置 */
export interface NotificationNodeConfig {
  type: 'notification';
  template: string;
  channels: Array<'dingtalk' | 'wecom' | 'feishu' | 'email'>;
  receivers: Array<{ type: 'user' | 'role' | 'variable'; value: string }>;
  // 通知内容变量
  contentVariables?: Record<string, any>;
}

/** Webhook 节点配置 */
export interface WebhookNodeConfig {
  type: 'webhook';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeout: number;  // 毫秒
  retry: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;  // 毫秒
  };
}

/** 结束节点配置 */
export interface EndNodeConfig {
  type: 'end';
  outputVariables?: Record<string, any>;
}

// ==================== 新增节点类型配置 ====================

/** 变量映射 */
export interface VariableMapping {
  source: string;
  target: string;
}

/** Task节点配置 */
export interface TaskNodeConfig {
  type: 'task';
  taskType: 'manual' | 'system';
  assigneeType: 'user' | 'role' | 'variable';
  assigneeIds?: string[];
  assigneeVariable?: string;
  title?: string;
  description?: string;
  timeout?: number;
  timeoutAction?: 'auto_complete' | 'notify' | 'escalate';
  formSchema?: Record<string, any>;
  resultVariable?: string;
}

/** SubWorkflow节点配置 */
export interface SubWorkflowNodeConfig {
  type: 'sub-workflow';
  subWorkflowId: string;
  subWorkflowVersion?: number;
  inputMappings?: VariableMapping[];
  outputMappings?: VariableMapping[];
  waitForCompletion: boolean;
  resultVariable?: string;
}

/** Delay节点配置 */
export interface DelayNodeConfig {
  type: 'delay';
  duration: number;
  durationVariable?: string;
  resumeEvent?: string;
  timeoutAction?: 'continue' | 'terminate';
  resultVariable?: string;
}

/** Timer节点配置 */
export interface TimerNodeConfig {
  type: 'timer';
  cronExpression: string;
  timezone?: string;
  maxExecutions?: number;
  inputVariables?: Record<string, any>;
  resultVariable?: string;
}

/** 工作流边/连接 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;  // 用于条件分支
  condition?: string;  // 条件分支的条件表达式
}

// ==================== 工作流实例 ====================

/** 工作流实例状态 */
export type WorkflowInstanceStatus = 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'terminated';

/** 工作流实例 */
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowDefinitionId: string;
  tenantId: string;
  status: WorkflowInstanceStatus;
  currentNodeId: string;
  variables: Record<string, any>;
  history: WorkflowHistory[];
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/** 工作流历史记录 */
export interface WorkflowHistory {
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  action: 'enter' | 'execute' | 'exit' | 'error' | 'skip';
  timestamp: Date;
  data?: Record<string, any>;
  error?: string;
  duration?: number;  // 毫秒
}

// ==================== 执行结果 ====================

/** 工作流执行结果 */
export interface WorkflowExecutionResult {
  success: boolean;
  instanceId: string;
  output?: Record<string, any>;
  error?: string;
  executedNodes: string[];
  executionTime: number;  // 毫秒
  trace?: WorkflowHistory[];
}

/** 工作流状态 */
export interface WorkflowState {
  instanceId: string;
  status: WorkflowInstanceStatus;
  currentNodeId: string;
  variables: Record<string, any>;
  history: WorkflowHistory[];
}

// ==================== 执行上下文 ====================

/** 工作流执行上下文 */
export interface WorkflowExecutionContext {
  instance: WorkflowInstance;
  definition: WorkflowDefinition;
  services: WorkflowServices;
  startTime: Date;
}

/** 工作流服务接口 */
export interface WorkflowServices {
  // 审批服务 - 集成 ApprovalFlowEngine
  approval: {
    createApproval: (config: ApprovalNodeConfig, context: Record<string, any>) => Promise<string>;
    getApprovalStatus: (approvalId: string) => Promise<'pending' | 'approved' | 'rejected'>;
    waitForApproval: (approvalId: string, timeout: number) => Promise<boolean>;
  };
  // 通知服务
  notification: {
    send: (config: NotificationNodeConfig, variables: Record<string, any>) => Promise<void>;
  };
  // Webhook 服务
  webhook: {
    call: (config: WebhookNodeConfig, variables: Record<string, any>) => Promise<any>;
  };
}

// ==================== 条件表达式 ====================

/** 条件表达式求值结果 */
export interface ConditionEvalResult {
  passed: boolean;
  matchedBranch?: string;
  evaluatedValue?: any;
}

// ==================== 工具类型 ====================

/** 工作流节点联合类型 */
export type AnyWorkflowNodeConfig =
  | StartNodeConfig
  | ApprovalNodeConfig
  | ConditionNodeConfig
  | NotificationNodeConfig
  | WebhookNodeConfig
  | EndNodeConfig
  | TaskNodeConfig
  | SubWorkflowNodeConfig
  | DelayNodeConfig
  | TimerNodeConfig;