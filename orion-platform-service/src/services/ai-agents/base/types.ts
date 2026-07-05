/**
 * AI Agent 基础类型定义
 *
 * 定义 Agent 配置、执行上下文、审计日志等核心类型
 */

import { AIGateway } from '../../ai/AIGateway';

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent 唯一标识 */
  id: string;
  /** Agent 显示名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** AI Gateway 场景标识 */
  scenario: string;
  /** 默认 Provider (sonnet/opus/haiku/gpt-4o 等) */
  provider: string;
  /** 最大并发数 */
  maxConcurrency: number;
  /** 超时时间 (毫秒) */
  timeoutMs: number;
  /** 重试配置 */
  retry: AgentRetryConfig;
  /** 依赖的工具列表 */
  requiredTools: string[];
  /** 需要的权限列表 */
  requiredPermissions: string[];
  /** 可选的模型配置 */
  modelConfig?: {
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Agent 重试配置
 */
export interface AgentRetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础退避时间 (毫秒) */
  backoffMs: number;
}

/**
 * Agent 执行上下文
 */
export interface AgentExecutionContext {
  /** 追踪 ID */
  traceId?: string;
  /** 用户 ID */
  userId?: string;
  /** 租户 ID */
  tenantId?: string;
  /** 执行时间 */
  timestamp?: string;
  /** 可选的额外上下文 */
  metadata?: Record<string, unknown>;
}

/**
 * Agent 审计日志
 */
export interface AgentAuditLog {
  /** Agent ID */
  agentId: string;
  /** 执行上下文 */
  context: AgentExecutionContext;
  /** 输入数据 */
  input: unknown;
  /** 输出数据 */
  output: unknown;
  /** 执行耗时 (毫秒) */
  durationMs: number;
  /** Token 使用量 */
  tokenUsage: AgentTokenUsage;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * Token 使用量统计
 */
export interface AgentTokenUsage {
  /** 输入 Token 数 */
  input: number;
  /** 输出 Token 数 */
  output: number;
  /** 总 Token 数 */
  total: number;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 参数 Schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** 处理函数 */
  handler: ToolHandler;
}

/**
 * 工具处理函数类型
 */
export type ToolHandler = (
  params: Record<string, unknown>,
  context: AgentExecutionContext
) => Promise<ToolResult>;

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行耗时 (毫秒) */
  durationMs?: number;
}

/**
 * 预置工具名称
 */
export type BuiltInToolName = 'pipeline' | 'deploy' | 'monitoring' | 'git' | 'log_query';

/**
 * Agent 能力定义
 */
export interface AgentCapability {
  /** 能力标识 */
  id: string;
  /** 能力描述 */
  description: string;
  /** 是否需要外部工具 */
  requiresTools: boolean;
}

/**
 * Agent 状态
 */
export type AgentStatus = 'idle' | 'running' | 'disabled' | 'error';

/**
 * Agent 信息 (用于 API 展示)
 */
export interface AgentInfo {
  id: string;
  name: string;
  enabled: boolean;
  scenario: string;
  status: AgentStatus;
  currentConcurrency: number;
  maxConcurrency: number;
}