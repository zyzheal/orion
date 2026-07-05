/**
 * AI Agent API Service
 * Auto-generated from backend ai-agent-routes.ts
 * Prefix: /api/v1/ai-agents
 */
import { api } from './client';

export interface AiAgent {
  id: string;
  tenant_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export const listAiAgent = async (params?: Record<string, unknown>): Promise<{ data: AiAgent[]; total: number }> => {
  const response = await api.get<{ data: AiAgent[]; total: number }>('/api/v1/ai-agents/list', { params });
  return { data: response.data.data, total: response.data.total };
};

export const getAiAgent = async (id: string): Promise<AiAgent> => {
  const response = await api.get<AiAgent>('/api/v1/ai-agents/' + id);
  return response.data;
};

export const getAiAgentAuditLogs = async (id: string): Promise<{ data: unknown[]; total: number }> => {
  const response = await api.get<{ data: unknown[]; total: number }>('/api/v1/ai-agents/' + id + '/audit-logs');
  return { data: response.data.data, total: response.data.total };
};

export const executeAiAgent = async (id: string, data?: Record<string, unknown>): Promise<AiAgent> => {
  const response = await api.post<AiAgent>('/api/v1/ai-agents/' + id + '/execute', data);
  return response.data;
};
