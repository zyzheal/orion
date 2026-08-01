/**
 * AI Agent 管理 API Client
 *
 * 后端 API 前缀: /api/ai-agents
 * 路由文件: orion-platform-service/src/api/ai-agent-routes.ts
 */

import { api } from './client';

// ==================== 类型定义 ====================

export interface AgentConfig {
  id?: string;
  name?: string;
  type?: string;
  model?: string;
  tools?: string[];
  [key: string]: any;
}

export interface AgentInfo {
  id: string;
  config: AgentConfig;
  status: string;
}

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

export interface AgentExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

// ==================== API 客户端 ====================

export const aiAgentApi = {
  // 获取 Agent 列表
  getList: () => api.get<AgentInfo[]>('/api/ai-agents/list'),

  // 获取 Agent 详情
  getById: (id: string) => api.get<AgentInfo>(`/api/ai-agents/${id}`),

  // 获取 Agent 审计日志
  getAuditLogs: (id: string, limit = 100) =>
    api.get<AuditLogEntry[]>(`/api/ai-agents/${id}/audit-logs`, { params: { limit } }),

  // 执行 Agent
  execute: (id: string, input: Record<string, unknown>) =>
    api.post<AgentExecutionResult>(`/api/ai-agents/${id}/execute`, input),
};
